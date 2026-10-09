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
 *   ALLOWED_DEVICES=my-phone node services/memory_gateway/gateway.mjs
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

/** `tailscale whois --json <addr>` → { device, login } or null if unknown. */
export function tailscaleWhois(address) {
  return new Promise((resolve) => {
    execFile("tailscale", ["whois", "--json", address], { timeout: 3_000 }, (error, stdout) => {
      if (error) return resolve(null);
      try {
        const info = JSON.parse(stdout);
        const device = String(info?.Node?.ComputedName || info?.Node?.Name || "").split(".")[0].toLowerCase();
        const login = String(info?.UserProfile?.LoginName || "").toLowerCase();
        resolve(device ? { device, login } : null);
      } catch {
        resolve(null);
      }
    });
  });
}

/**
 * Builds the request handler. Every dependency is injectable so the access
 * decisions can be tested without Tailscale or a real memory server.
 */
export function createGatewayHandler({
  whois = tailscaleWhois,
  readToken,
  upstreamUrl,
  allowedDevices,
  routes = DEFAULT_ROUTES,
  fetchImpl = fetch,
  log = (line) => console.log(line),
  now = () => Date.now(),
}) {
  const allowed = new Set(allowedDevices.map((d) => d.trim().toLowerCase()).filter(Boolean));
  if (allowed.size === 0) throw new Error("ALLOWED_DEVICES is empty: refusing to start an open gateway.");
  const upstream = new URL(upstreamUrl);
  const cache = new Map();

  async function identify(address) {
    const hit = cache.get(address);
    if (hit && now() - hit.at < WHOIS_TTL_MS) return hit.identity;
    const identity = await whois(address);
    cache.set(address, { identity, at: now() });
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
    if (!allowed.has(identity.device)) return deny(res, 403, "Device is not allowed.", identity.device);

    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return deny(res, 413, "Request too large.", identity.device);
      chunks.push(chunk);
    }

    let token;
    try {
      token = readToken();
    } catch {
      return deny(res, 500, "Gateway token unavailable.", identity.device);
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
      log(`allow ${upstreamRes.status} ${identity.device} ${req.method} ${url.pathname}`);
      res.writeHead(upstreamRes.status, {
        "Content-Type": upstreamRes.headers.get("content-type") || "application/octet-stream",
      });
      res.end(body);
    } catch {
      deny(res, 502, "Memory server unreachable.", identity.device);
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

  const handler = createGatewayHandler({
    readToken: () => fs.readFileSync(tokenFile, "utf8").trim(),
    upstreamUrl: process.env.UPSTREAM_URL || "http://127.0.0.1:20141",
    allowedDevices: (process.env.ALLOWED_DEVICES || "").split(","),
  });
  http.createServer((req, res) => void handler(req, res)).listen(port, host, () => {
    console.log(`SIYA memory gateway listening on ${host}:${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main();
