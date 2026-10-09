#!/usr/bin/env node
/**
 * SIYA memory gateway: Tailscale-identity front door for the self-hosted
 * memory server, so no client (mobile bundle, APK) ever carries a secret.
 *
 *   phone ──tailnet──► gateway (tailnet IP) ──localhost──► memory server
 *                       │ who is this peer?  (tailscale whois)
 *                       │ allowed device + allowed route? else 403
 *                       └ adds the server-held bearer token, strips the client's
 *
 * Tailscale authenticates every peer with WireGuard keys, so `whois` on the
 * connection's source address tells us which device and user is calling; that
 * cannot be forged from inside or outside the tailnet. The upstream token is
 * read from a file on the server (mode 0600) and never leaves it.
 *
 * Run on the memory-server host (see README.md in this folder):
 *   GATEWAY_LISTEN=100.x.y.z:20142 UPSTREAM_URL=http://127.0.0.1:20141 \
 *   UPSTREAM_TOKEN_FILE=~/.config/siya-memory-gateway/token \
 *   ALLOWED_NODE_IDS=nXXXXXXXCNTRL=my-phone node services/memory_gateway/gateway.mjs
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";

/** Routes the SIYA mobile memory client uses (mobile/app/memoryClient.ts). */
export const DEFAULT_ROUTES = [
  { method: "POST", path: "/ingest" },
  { method: "POST", path: "/reindex" },
  { method: "GET", path: "/raw" },
  { method: "POST", path: "/query" },
];

const MAX_BODY_BYTES = 1_000_000;
const UPSTREAM_TIMEOUT_MS = 20_000;
const WHOIS_TTL_MS = 60_000;

function identityFrom(info) {
  const nodeId = String(info?.Node?.StableID || "");
  const device = String(info?.Node?.ComputedName || info?.Node?.Name || "").split(".")[0].toLowerCase();
  const login = String(info?.UserProfile?.LoginName || "").toLowerCase();
  return nodeId ? { nodeId, device, login } : null;
}

/** Tailscale stable node IDs, e.g. "nQdER5391E11CNTRL". Never reused. */
const STABLE_NODE_ID = /^n[A-Za-z0-9]{6,}CNTRL$/;

/**
 * Parses ALLOWED_NODE_IDS: comma-separated "<stable-node-id>=<label>" entries,
 * or the single word "none" (run, but allow no device). Device *names* are
 * not accepted: a name can be renamed or taken over by a new device after
 * the old one is removed, while a stable node ID cannot.
 */
export function parseAllowedNodes(spec) {
  const value = String(spec ?? "").trim();
  if (value.toLowerCase() === "none") return new Map();
  if (!value) throw new Error('ALLOWED_NODE_IDS is empty: set "none" to deny every device explicitly.');
  const allowed = new Map();
  for (const entry of value.split(",").map((e) => e.trim()).filter(Boolean)) {
    const [id, label = ""] = entry.split("=").map((part) => part.trim());
    if (!STABLE_NODE_ID.test(id)) throw new Error(`Not a Tailscale stable node ID: "${id}". Use the ID from \`tailscale status --json\`.`);
    allowed.set(id, label || id);
  }
  return allowed;
}

/**
 * Asks tailscaled's local API which device owns a tailnet address. This is
 * the same lookup `tailscale whois` makes, without starting the CLI (which can
 * stall for seconds inside a hardened systemd unit).
 */
export function localApiWhois(address, socketPath = process.env.TAILSCALE_SOCKET || "/run/tailscale/tailscaled.sock") {
  return new Promise((resolve) => {
    const req = http.get(
      {
        socketPath,
        path: `/localapi/v0/whois?addr=${encodeURIComponent(address)}`,
        headers: { Host: "local-tailscaled.sock" },
        timeout: 2_000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(identityFrom(JSON.parse(body)));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

/** `tailscale whois --json <addr>` → { device, login } or null if unknown. */
export function cliWhois(address) {
  return new Promise((resolve) => {
    execFile("tailscale", ["whois", "--json", address], { timeout: 5_000 }, (error, stdout) => {
      if (error) return resolve(null);
      try {
        resolve(identityFrom(JSON.parse(stdout)));
      } catch {
        resolve(null);
      }
    });
  });
}

/** Local API first, CLI as a fallback. */
export async function tailscaleWhois(address) {
  return (await localApiWhois(address)) || (await cliWhois(address));
}

/**
 * Builds the request handler. Every dependency is injectable so the access
 * decisions can be tested without Tailscale or a real memory server.
 */
export function createGatewayHandler({
  whois = tailscaleWhois,
  readToken,
  upstreamUrl,
  allowedNodes,
  routes = DEFAULT_ROUTES,
  fetchImpl = fetch,
  log = (line) => console.log(line),
  now = () => Date.now(),
}) {
  const allowed = allowedNodes instanceof Map ? allowedNodes : parseAllowedNodes(allowedNodes);
  const upstream = new URL(upstreamUrl);
  const cache = new Map();

  async function identify(address) {
    const hit = cache.get(address);
    if (hit && now() - hit.at < WHOIS_TTL_MS) return hit.identity;
    const identity = await whois(address);
    // Only successful lookups are cached: a slow or failed lookup is retried
    // on the next request instead of locking a device out for the TTL.
    if (identity) cache.set(address, { identity, at: now() });
    return identity;
  }

  function deny(res, status, reason, who) {
    log(`deny ${status} ${who} ${reason}`);
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: reason }));
  }

  return async function handle(req, res) {
    const peer = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
    const url = new URL(req.url || "/", "http://gateway.invalid");
    const route = routes.find((r) => r.method === req.method && r.path === url.pathname);
    if (!route) return deny(res, 404, "Unknown route.", peer);

    const identity = await identify(peer);
    if (!identity) return deny(res, 403, "Caller is not an identified tailnet device.", peer);
    const who = `${identity.device} (${identity.nodeId})`;
    if (!allowed.has(identity.nodeId)) return deny(res, 403, "Device is not allowed.", who);

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Answer, then drop the connection so the client stops uploading.
        res.setHeader("Connection", "close");
        deny(res, 413, "Request too large.", who);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }

    let token;
    try {
      token = readToken();
    } catch {
      return deny(res, 500, "Gateway token unavailable.", who);
    }

    const target = new URL(url.pathname + url.search, upstream);
    const headers = { Authorization: `Bearer ${token}` };
    if (req.headers["content-type"]) headers["Content-Type"] = String(req.headers["content-type"]);
    try {
      const upstreamRes = await fetchImpl(target, {
        method: req.method,
        headers,
        body: req.method === "GET" ? undefined : Buffer.concat(chunks),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const body = Buffer.from(await upstreamRes.arrayBuffer());
      log(`allow ${upstreamRes.status} ${allowed.get(identity.nodeId)} ${who} ${req.method} ${url.pathname}`);
      res.writeHead(upstreamRes.status, {
        "Content-Type": upstreamRes.headers.get("content-type") || "application/octet-stream",
      });
      res.end(body);
    } catch {
      deny(res, 502, "Memory server unreachable.", who);
    }
  };
}

function main() {
  const listen = process.env.GATEWAY_LISTEN || "";
  const [host, port] = [listen.slice(0, listen.lastIndexOf(":")), Number(listen.slice(listen.lastIndexOf(":") + 1))];
  if (!host || !port) throw new Error("Set GATEWAY_LISTEN to <tailnet-ip>:<port>.");
  if (host === "0.0.0.0" || host === "::") throw new Error("Bind to the tailnet IP only, never all interfaces.");
  const tokenFile = (process.env.UPSTREAM_TOKEN_FILE || "").replace(/^~(?=\/)/, process.env.HOME || "~");
  if (!tokenFile) throw new Error("Set UPSTREAM_TOKEN_FILE.");
  const mode = fs.statSync(tokenFile).mode & 0o077;
  if (mode) throw new Error(`${tokenFile} must not be readable by group or others (chmod 600).`);

  if (process.env.ALLOWED_DEVICES) {
    throw new Error("ALLOWED_DEVICES (device names) is no longer accepted; use ALLOWED_NODE_IDS with stable node IDs.");
  }
  const allowedNodes = parseAllowedNodes(process.env.ALLOWED_NODE_IDS);
  console.log(`allowed devices: ${allowedNodes.size === 0 ? "none" : [...allowedNodes.values()].join(", ")}`);
  const handler = createGatewayHandler({
    readToken: () => fs.readFileSync(tokenFile, "utf8").trim(),
    upstreamUrl: process.env.UPSTREAM_URL || "http://127.0.0.1:20141",
    allowedNodes,
  });
  http.createServer((req, res) => void handler(req, res)).listen(port, host, () => {
    console.log(`SIYA memory gateway listening on ${host}:${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
