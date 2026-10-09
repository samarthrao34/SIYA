#!/usr/bin/env bash
# Inside `unshare --kill-child -r -n -p -f --mount-proc`: loopback only, private
# PIDs, empty data dir, no keys. $3 = "ipc" (Electron capture path) or "agent".
set -u
APP="$1"; OUT="$2"; MODE="$3"; H="$(dirname "$0")"
ip link set lo up
rm -rf "$OUT"; mkdir -p "$OUT/data" "$OUT/home"
node "$H/services.mjs" "$APP" "$OUT" > "$OUT/services.log" 2>&1 &
sleep 1
cd "$APP"
env -i HOME="$OUT/home" PATH=/usr/bin:/bin NODE_ENV=production SIYA_DATA_DIR="$OUT/data" \
  SIYA_API_CATALOGUE_SYNC=off SIYA_PYTHON=/nonexistent \
  SIYA_BRAIN=local SIYA_LOCAL_LLM_URL=http://127.0.0.1:9379/v1 SIYA_VOICE_URL=http://127.0.0.1:8795 \
  SIYA_TTS_ENGINE=kokoro SIYA_LOCAL_TOOLS=viewScreen,minimizeWindow,getActiveWindow \
  node "$H/launch_server.mjs" "$APP" "$OUT" "$MODE" > "$OUT/server.log" 2>&1 &
for _ in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3000/api/privacy/status && break; sleep 0.5; done
sleep 2
node "$H/client.mjs" "$APP" "$OUT" "$MODE"
