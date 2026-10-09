"""Lightweight local desktop observation for SIYA's event-driven runtime.

The snapshot contains metadata only: active window/app names, visible app
names, disk capacity, download file metadata, and idle time. It never
captures screen pixels, microphone audio, clipboard contents, or file
contents.

Response shape must match `DesktopSnapshot` in ../cognition/desktopPerception.ts
exactly (server/index.ts does a direct `response.json() as DesktopSnapshot` cast).
"""
from __future__ import annotations

import json
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

PARTIAL_DOWNLOAD_SUFFIXES = {".tmp", ".part", ".partial", ".crdownload"}


def collect_snapshot() -> Dict[str, Any]:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "activeWindow": _active_window(),
        "applications": _visible_applications(),
        "disk": _disk_snapshot(),
        "downloads": _download_snapshot(),
        "userIdleSeconds": _idle_seconds(),
    }


def _hyprctl_json(*args: str):
    try:
        out = subprocess.run(["hyprctl", "-j", *args], capture_output=True, text=True, timeout=2)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception:
        return None


def _active_window() -> Dict[str, Any]:
    fallback = {"title": None, "application": None, "pid": None}
    win = _hyprctl_json("activewindow")
    if not win or not isinstance(win, dict) or not win.get("address"):
        return fallback
    return {
        "title": win.get("title") or None,
        "application": win.get("class") or None,
        "pid": win.get("pid") if isinstance(win.get("pid"), int) else None,
    }


def _visible_applications() -> List[str]:
    clients = _hyprctl_json("clients")
    if not isinstance(clients, list):
        return []
    seen = []
    for c in clients:
        cls = c.get("class")
        if cls and cls not in seen:
            seen.append(cls)
    return seen


def _disk_snapshot():
    try:
        du = shutil.disk_usage(str(Path.home()))
        percent_used = round((du.used / du.total) * 100, 1) if du.total else 0.0
        return {
            "path": str(Path.home()),
            "freeBytes": du.free,
            "totalBytes": du.total,
            "percentUsed": percent_used,
        }
    except Exception:
        return None


def _download_snapshot() -> List[Dict[str, Any]]:
    downloads = Path.home() / "Downloads"
    if not downloads.is_dir():
        return []
    cutoff = time.time() - 172800  # 48h
    entries: List[Dict[str, Any]] = []
    try:
        for entry in downloads.iterdir():
            try:
                if not entry.is_file():
                    continue
                stat = entry.stat()
                if stat.st_mtime < cutoff:
                    continue
                status = "downloading" if entry.suffix.lower() in PARTIAL_DOWNLOAD_SUFFIXES else "complete"
                entries.append({
                    "name": entry.name,
                    "path": str(entry),
                    "size": stat.st_size,
                    "modifiedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "status": status,
                })
            except OSError:
                continue
    except OSError:
        return []
    entries.sort(key=lambda e: e["modifiedAt"], reverse=True)
    return entries[:20]


def _idle_seconds() -> float:
    """Best-effort idle time via hyprctl (no portable X11-free primitive on Wayland)."""
    try:
        out = subprocess.run(["hyprctl", "-j", "cursorpos"], capture_output=True, text=True, timeout=1)
        if out.returncode != 0:
            return 0
        # hyprctl has no native idle-seconds query; without a running idle daemon
        # (e.g. hypridle exposing state), we can't measure this reliably --
        # report 0 (never idle) rather than a wrong number.
        return 0
    except Exception:
        return 0


__all__ = ["collect_snapshot"]
