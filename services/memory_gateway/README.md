# SIYA memory gateway

A small front door for the self-hosted memory server, so the mobile app needs
no secret. It runs on the memory-server host, next to the server.

- Callers are identified by their **Tailscale device** (`tailscale whois` on the
  connection's source address). Tailscale authenticates every peer with
  WireGuard keys, so the identity cannot be faked from the tailnet or outside it.
- Only devices whose **stable node ID** is in `ALLOWED_NODE_IDS` are served, and only the four routes the
  mobile client uses (`POST /ingest`, `POST /reindex`, `GET /raw`, `POST /query`).
- The gateway adds the memory server's bearer token itself. The token lives in
  a `0600` file on the server and never reaches a client, a build, or an APK.
  Any `Authorization` header a client sends is dropped.

## Setup on the memory-server host

1. Make the memory server listen on `127.0.0.1` only (its own config), so the
   gateway is the only way in from the tailnet.
2. Store the server's token for the gateway:
   ```sh
   mkdir -p ~/.config/siya-memory-gateway && chmod 700 ~/.config/siya-memory-gateway
   # write the server's (new, rotated) token into this file with your editor
   chmod 600 ~/.config/siya-memory-gateway/token
   ```
3. Find each approved device's stable node ID (the `ID` field) with
   `tailscale status --json`. Device names are not accepted: a name can be
   renamed or taken over by a new device after the old one is removed, while a
   stable node ID is never reused.
4. Run the gateway (Node 20+), bound to the host's tailnet IP:
   ```sh
   GATEWAY_LISTEN=<tailnet-ip>:20142 \
   UPSTREAM_URL=http://127.0.0.1:20141 \
   UPSTREAM_TOKEN_FILE=~/.config/siya-memory-gateway/token \
   ALLOWED_NODE_IDS=<stable-node-id>=<label>,... \
   node services/memory_gateway/gateway.mjs
   ```
   `ALLOWED_NODE_IDS=none` runs the gateway but allows no device. It refuses
   to start with an empty or malformed allowlist, a `0.0.0.0` bind, a token
   file readable by others, or the old name-based `ALLOWED_DEVICES`.
5. Point the mobile build at it: `VITE_SIYA_MEMORY_URL=http://<tailnet-ip>:20142`
   in `mobile/app/.env`. No token variable is needed any more.

Traffic between the phone and the gateway is plain HTTP inside the tailnet,
which Tailscale encrypts end to end.

## Tests

`tests/memory-gateway.test.mjs` exercises the access decisions with a fake
`whois` and a fake memory server. They do not prove the live Tailscale setup;
check that on the host (see the rotation steps in the pull request).
