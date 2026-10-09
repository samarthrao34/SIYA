"""
Auto-start management for SIYA on Linux, using the XDG autostart spec
(the standard Linux equivalent of a Windows registry Run key): a
`.desktop` file under ~/.config/autostart/.

  enableAutoStart    : write the .desktop entry
  disableAutoStart   : remove the .desktop entry
  getAutoStartStatus : report whether the entry exists + its target
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any, Dict

from .registry import register

AUTOSTART_DIR = Path.home() / ".config" / "autostart"
DESKTOP_FILE = AUTOSTART_DIR / "siya.desktop"


def _project_root() -> Path:
    """Return the project root (services/desktop_agent -> repo root)."""
    return Path(__file__).resolve().parents[2]


def _electron_launch_target() -> str:
    """Best-effort path to the packaged SIYA app, or the dev entrypoint."""
    packaged = Path("/opt/SIYA/siya")
    if packaged.exists():
        return str(packaged)
    # Dev fallback: launch via npx electron from the project root.
    return f"npx electron {_project_root()}"


@register("enableAutoStart")
def enable_auto_start(args: Dict[str, Any]) -> Dict[str, Any]:
    AUTOSTART_DIR.mkdir(parents=True, exist_ok=True)
    target = _electron_launch_target()
    content = (
        "[Desktop Entry]\n"
        "Type=Application\n"
        "Name=SIYA\n"
        f"Exec={target}\n"
        "X-GNOME-Autostart-enabled=true\n"
        "Comment=SIYA desktop companion\n"
    )
    DESKTOP_FILE.write_text(content, encoding="utf-8")
    return {"result": f"Auto-start enabled: {DESKTOP_FILE}", "path": str(DESKTOP_FILE), "target": target}


@register("disableAutoStart")
def disable_auto_start(args: Dict[str, Any]) -> Dict[str, Any]:
    if DESKTOP_FILE.exists():
        DESKTOP_FILE.unlink()
        return {"result": "Auto-start disabled."}
    return {"result": "Auto-start was not enabled."}


@register("getAutoStartStatus")
def get_auto_start_status(args: Dict[str, Any]) -> Dict[str, Any]:
    if DESKTOP_FILE.exists():
        return {"result": f"Auto-start is enabled ({DESKTOP_FILE}).", "enabled": True, "path": str(DESKTOP_FILE)}
    return {"result": "Auto-start is not enabled.", "enabled": False, "path": None}


__all__ = ["enable_auto_start", "disable_auto_start", "get_auto_start_status"]
