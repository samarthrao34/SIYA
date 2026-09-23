#!/usr/bin/env bash
set -euo pipefail

ADB="${ADB:-$HOME/.local/lib/android-sdk/platform-tools/adb}"
if [[ ! -x "$ADB" ]]; then
  echo "Android platform tools are missing at $ADB" >&2
  exit 1
fi

"$ADB" start-server >/dev/null
if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "No authorized Android phone found. Connect it by USB and allow USB debugging." >&2
  exit 1
fi

"$ADB" reverse tcp:3000 tcp:3000
echo "Siya phone connection is ready."
