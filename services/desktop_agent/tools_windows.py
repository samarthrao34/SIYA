"""
Window management: minimize / maximize / close the active window or switch apps.

Uses hyprctl (Hyprland's IPC). Hyprland is a tiling compositor with no
traditional "minimize" concept -- minimizeWindow maps to moving the window
to Hyprland's special workspace (the closest native equivalent) rather than
raising an error.
"""
from __future__ import annotations

from typing import Any, Dict

from .registry import ToolError, register
from ._linux import hyprctl_dispatch, resolve_target_window, window_display_title


@register("minimizeWindow")
def minimize_window(args: Dict[str, Any]) -> Dict[str, Any]:
    win = resolve_target_window(args)
    title = window_display_title(win)
    hyprctl_dispatch("movetoworkspacesilent", "special:minimized")
    return {"result": f"Minimized window: {title} (moved to special workspace -- Hyprland has no traditional minimize)."}


@register("maximizeWindow")
def maximize_window(args: Dict[str, Any]) -> Dict[str, Any]:
    win = resolve_target_window(args)
    title = window_display_title(win)
    addr = win.get("address")
    if addr:
        hyprctl_dispatch("focuswindow", f"address:{addr}")
    hyprctl_dispatch("fullscreen", "1")  # "1" = maximize (not true fullscreen)
    return {"result": f"Maximized window: {title}."}


@register("closeWindow")
def close_window(args: Dict[str, Any]) -> Dict[str, Any]:
    win = resolve_target_window(args)
    title = window_display_title(win)
    addr = win.get("address")
    if not addr:
        raise ToolError("Could not resolve a window address to close.")
    hyprctl_dispatch("closewindow", f"address:{addr}")
    return {"result": f"Closed window: {title}."}


@register("switchApplication")
def switch_application(args: Dict[str, Any]) -> Dict[str, Any]:
    title = args.get("title") or args.get("application")
    if not title:
        raise ToolError("Parameter 'title' or 'application' is required.")
    win = resolve_target_window({"title": title})
    addr = win.get("address")
    if not addr:
        raise ToolError("Could not resolve a window address to switch to.")
    hyprctl_dispatch("focuswindow", f"address:{addr}")
    return {"result": f"Switched to: {window_display_title(win)}."}


__all__ = ["minimize_window", "maximize_window", "close_window", "switch_application"]
