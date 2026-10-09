#!/usr/bin/env bash
set -u
APP="$1"; OUT="$2"
ip link set lo up
rm -rf "$OUT"; mkdir -p "$OUT"
cd "$APP"
render() {
  local name="$1"; shift
  local data; data=$(mktemp -d "$OUT/data-$name.XXXX")
  env -i HOME="$OUT/home" PATH=/usr/bin:/bin NODE_ENV=production SIYA_DATA_DIR="$data" \
    SIYA_API_CATALOGUE_SYNC=off SIYA_PYTHON=/nonexistent "$@" node dist/server.cjs > "$OUT/server-$name.log" 2>&1 &
  local pid=$!
  for _ in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:3000/api/privacy/status && break; sleep 0.5; done
  curl -s http://127.0.0.1:3000/api/privacy/status > "$OUT/status-$name.json"
  timeout 40 chromium --headless=new --no-sandbox --disable-gpu --user-data-dir="$OUT/chrome-$name" \
    --virtual-time-budget=12000 --dump-dom http://127.0.0.1:3000/ > "$OUT/dom-$name.html" 2>/dev/null
  timeout 40 chromium --headless=new --no-sandbox --disable-gpu --user-data-dir="$OUT/chrome2-$name" \
    --window-size=1100,2600 --virtual-time-budget=12000 --screenshot="$OUT/consent-$name.png" http://127.0.0.1:3000/ >/dev/null 2>&1
  kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}
render gemini
render gemini-typesafe TYPESAFE_API_KEY=dummy-not-real
render local-edge SIYA_BRAIN=local GEMINI_API_KEY=dummy-not-real
render local-remote SIYA_BRAIN=local SIYA_TTS_ENGINE=kokoro SIYA_LOCAL_LLM_URL=http://192.168.50.9:9379/v1
echo done
