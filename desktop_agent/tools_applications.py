"""
Application discovery, launch, and graceful close.

Known apps take a fast path (name -> binary map). Unknown names resolve via
PATH (shutil.which). Closing targets real running processes by name instead
of rejecting names that aren't in a hard-coded allow-list.
"""
from __future__ import annotations

import shutil
import subprocess
import time
from typing import Any, Dict

import psutil

from .registry import ToolError, register
from ._linux import hyprctl_dispatch

KNOWN_APPS: Dict[str, str] = {
    "browser": "xdg-open",
    "terminal": "foot",
    "files": "xdg-open",
    "calculator": "gnome-calculator",
    "text editor": "gedit",
    "code": "code",
    "vscode": "code",
}


@register("openApplication")
def open_application(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("application")
    if not name:
        raise ToolError("Parameter 'name' is required.")
    key = str(name).strip().lower()
    binary = KNOWN_APPS.get(key, str(name))
    path = shutil.which(binary)
    if path:
        subprocess.Popen([path], close_fds=True, start_new_session=True)
        return {"result": f"Opened application: {binary}"}
    # Fall back to letting Hyprland's exec dispatcher resolve it (covers
    # desktop-file-only launchers not directly on $PATH).
    try:
        hyprctl_dispatch("exec", str(name))
        return {"result": f"Requested launch of: {name} (via compositor exec)."}
    except ToolError:
        raise ToolError(f"Could not find or launch application '{name}'.")


@register("closeApplication")
def close_application(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("application")
    if not name:
        raise ToolError("Parameter 'name' is required.")
    force = bool(args.get("force", False))
    key = str(name).strip().lower()
    matched = []
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            pname = (proc.info.get("name") or "").lower()
            if key in pname:
                matched.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    if not matched:
        raise ToolError(f"No running process found matching '{name}'.")
    for proc in matched:
        try:
            if force:
                proc.kill()
            else:
                proc.terminate()
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    if not force:
        time.sleep(0.3)
    return {"result": f"{'Force-closed' if force else 'Closed'} {len(matched)} process(es) matching '{name}'."}


__all__ = ["open_application", "close_application"]
