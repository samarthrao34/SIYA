"""Shared Linux/Hyprland helpers used across tool modules.

Kept separate from registry.py so tool modules can `from ._linux import x`
without circular imports.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from typing import Any, Dict, List, Optional

from .registry import ToolError


def have(binary: str) -> bool:
    return shutil.which(binary) is not None


def run(cmd: List[str], timeout: float = 5.0, check: bool = False) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=check)
    except FileNotFoundError:
        raise ToolError(f"Required command '{cmd[0]}' is not installed.")
    except subprocess.TimeoutExpired:
        raise ToolError(f"Command '{cmd[0]}' timed out.")
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Command '{cmd[0]}' failed: {e.stderr or e}")


def hyprctl_json(*args: str):
    if not have("hyprctl"):
        raise ToolError("hyprctl is not available -- this doesn't look like a Hyprland session.")
    out = run(["hyprctl", "-j", *args])
    if out.returncode != 0:
        raise ToolError(f"hyprctl {' '.join(args)} failed: {out.stderr.strip()}")
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        raise ToolError(f"hyprctl {' '.join(args)} returned invalid JSON.")


def hyprctl_dispatch(*args: str) -> str:
    if not have("hyprctl"):
        raise ToolError("hyprctl is not available -- this doesn't look like a Hyprland session.")
    out = run(["hyprctl", "dispatch", *args])
    if out.returncode != 0:
        raise ToolError(f"hyprctl dispatch {' '.join(args)} failed: {out.stderr.strip()}")
    return out.stdout.strip()


def active_window() -> Optional[Dict[str, Any]]:
    win = hyprctl_json("activewindow")
    if not isinstance(win, dict) or not win.get("address"):
        return None
    return win


def all_windows() -> List[Dict[str, Any]]:
    clients = hyprctl_json("clients")
    return clients if isinstance(clients, list) else []


def find_window_by_title(query: str) -> Optional[Dict[str, Any]]:
    q = query.strip().lower()
    if not q:
        return None
    for w in all_windows():
        title = (w.get("title") or "").lower()
        cls = (w.get("class") or "").lower()
        if q in title or q in cls:
            return w
    return None


def resolve_target_window(args: Dict[str, Any]) -> Dict[str, Any]:
    """Pick the window to operate on: explicit title/application, or the focused one."""
    title = args.get("title") or args.get("application")
    if title:
        win = find_window_by_title(str(title))
        if not win:
            raise ToolError(f"No visible window with title containing '{title}'.")
        return win
    win = active_window()
    if not win:
        raise ToolError("No active window found.")
    return win


def window_display_title(win: Dict[str, Any]) -> str:
    return win.get("title") or win.get("class") or "active window"


def screen_geometry() -> Dict[str, int]:
    """Bounding box across all monitors (virtual desktop), from `hyprctl monitors`."""
    monitors = hyprctl_json("monitors")
    if not isinstance(monitors, list) or not monitors:
        return {"left": 0, "top": 0, "right": 1920, "bottom": 1080}
    left = min(m["x"] for m in monitors)
    top = min(m["y"] for m in monitors)
    right = max(m["x"] + m["width"] for m in monitors)
    bottom = max(m["y"] + m["height"] for m in monitors)
    return {"left": left, "top": top, "right": right, "bottom": bottom}
