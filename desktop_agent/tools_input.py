"""Generic, application-independent mouse and keyboard primitives.

Keyboard (typeText/pressKey/hotkey): wtype (Wayland virtual-keyboard
protocol) -- works out of the box on Hyprland/wlroots, no root needed.

Mouse (moveMouse/click/doubleClick/rightClick/drag/scroll): cursor
*positioning* uses `hyprctl dispatch movecursor` (no extra tool needed).
Button press/release/scroll synthesis needs `ydotool` (+ its root-privileged
`ydotoold` daemon) -- there is no root-free universal solution for synthetic
mouse buttons on native Wayland. If ydotool isn't installed/configured,
those specific actions raise a clear ToolError explaining the one-time setup
needed, rather than silently failing.
"""
from __future__ import annotations

import time
from typing import Any, Dict, Tuple

from .registry import ToolError, register
from ._linux import have, run, hyprctl_dispatch, hyprctl_json, active_window, all_windows, screen_geometry

YDOTOOL_SETUP_HINT = (
    "Mouse click/drag/scroll needs 'ydotool'. One-time setup: "
    "sudo pacman -S ydotool, then enable+start its daemon "
    "(systemctl --user enable --now ydotool.service, or run 'ydotoold' as a "
    "background service) so /dev/uinput is accessible."
)


def _require_ydotool():
    if not have("ydotool"):
        raise ToolError(YDOTOOL_SETUP_HINT)


def _move_cursor(x: int, y: int) -> None:
    # `hyprctl dispatch movecursor` is intercepted/rejected in this
    # environment (a non-standard Lua bridge, not normal Hyprland behavior)
    # -- ydotool's absolute mousemove works reliably here instead, and needs
    # no Hyprland-specific dispatch at all.
    _require_ydotool()
    run(["ydotool", "mousemove", "-a", str(x), str(y)])


def _coordinate(args: Dict[str, Any], x_name: str = "x", y_name: str = "y") -> Tuple[int, int]:
    if x_name not in args or y_name not in args:
        raise ToolError(f"Both {x_name} and {y_name} are required.")
    try:
        x = int(args[x_name])
        y = int(args[y_name])
    except (TypeError, ValueError):
        raise ToolError("Mouse coordinates must be integers.")
    bounds = screen_geometry()
    if not (bounds["left"] <= x < bounds["right"]):
        raise ToolError(f"Coordinate ({x}, {y}) is outside the virtual desktop ({bounds['left']}, {bounds['top']})-({bounds['right'] - 1}, {bounds['bottom'] - 1}).")
    if not (bounds["top"] <= y < bounds["bottom"]):
        raise ToolError(f"Coordinate ({x}, {y}) is outside the virtual desktop ({bounds['left']}, {bounds['top']})-({bounds['right'] - 1}, {bounds['bottom'] - 1}).")
    return x, y


def _duration(value, maximum: float = 2.0) -> float:
    try:
        if value is None:
            return 0.0
        return max(0.0, min(maximum, float(value)))
    except (TypeError, ValueError):
        raise ToolError("Duration must be a number.")


def _button(value, allowed=("left", "middle", "right")) -> str:
    button = str(value or "left").lower()
    if button not in allowed:
        raise ToolError(f"Unsupported mouse button: {button}.")
    return button


YDOTOOL_BUTTON = {"left": "0xC0", "right": "0xC1", "middle": "0xC2"}


def _cursor_position() -> Tuple[int, int]:
    pos = hyprctl_json("cursorpos")
    if isinstance(pos, dict) and "x" in pos and "y" in pos:
        return int(pos["x"]), int(pos["y"])
    return 0, 0


def _active_window_info() -> Dict[str, Any]:
    win = active_window()
    if not win:
        return {"title": None, "pid": None, "bounds": None}
    at = win.get("at") or [0, 0]
    size = win.get("size") or [0, 0]
    return {
        "title": win.get("title") or None,
        "pid": win.get("pid"),
        "bounds": {"left": at[0], "top": at[1], "right": at[0] + size[0], "bottom": at[1] + size[1]},
    }


def _visible_windows(limit: int = 50):
    windows = []
    for w in all_windows()[:limit]:
        at = w.get("at") or [0, 0]
        size = w.get("size") or [0, 0]
        windows.append({
            "title": w.get("title"),
            "application": w.get("class"),
            "workspace": (w.get("workspace") or {}).get("name"),
            "bounds": {"left": at[0], "top": at[1], "right": at[0] + size[0], "bottom": at[1] + size[1]},
        })
    return windows


def _observation(include_windows: bool = False) -> Dict[str, Any]:
    x, y = _cursor_position()
    bounds = screen_geometry()
    observed = {
        "timestamp": time.time(),
        "cursor": {"x": x, "y": y},
        "active_window": _active_window_info(),
        "virtual_desktop": bounds,
    }
    if include_windows:
        observed["visible_windows"] = _visible_windows()
    return observed


@register("moveMouse")
def move_mouse(args: Dict[str, Any]) -> Dict[str, Any]:
    x, y = _coordinate(args)
    _move_cursor(x, y)
    return {"result": f"Moved cursor to ({x}, {y}).", "observation": _observation()}


@register("click")
def click(args: Dict[str, Any]) -> Dict[str, Any]:
    _require_ydotool()
    button = _button(args.get("button"))
    if "x" in args or "y" in args:
        x, y = _coordinate(args)
        _move_cursor(x, y)
    run(["ydotool", "click", YDOTOOL_BUTTON[button]])
    return {"result": "Clicked once.", "observation": _observation()}


@register("doubleClick")
def double_click(args: Dict[str, Any]) -> Dict[str, Any]:
    _require_ydotool()
    interval = max(0.03, min(0.5, float(args.get("interval", 0.12))))
    if "x" in args or "y" in args:
        x, y = _coordinate(args)
        _move_cursor(x, y)
    run(["ydotool", "click", YDOTOOL_BUTTON["left"]])
    time.sleep(interval)
    run(["ydotool", "click", YDOTOOL_BUTTON["left"]])
    return {"result": "Double-clicked.", "observation": _observation()}


@register("rightClick")
def right_click(args: Dict[str, Any]) -> Dict[str, Any]:
    forwarded = dict(args)
    forwarded["button"] = "right"
    result = click(forwarded)
    result["result"] = "Right-clicked."
    return result


@register("drag")
def drag(args: Dict[str, Any]) -> Dict[str, Any]:
    _require_ydotool()
    target_x, target_y = _coordinate(args)
    if "start_x" in args or "start_y" in args:
        start_x, start_y = _coordinate(args, "start_x", "start_y")
        _move_cursor(start_x, start_y)
        time.sleep(0.05)
    button = _button(args.get("button"), ("left", "right"))
    run(["ydotool", "mousedown", YDOTOOL_BUTTON[button]])
    _move_cursor(target_x, target_y)
    time.sleep(_duration(args.get("duration", 0.3)))
    run(["ydotool", "mouseup", YDOTOOL_BUTTON[button]])
    return {"result": f"Dragged to ({target_x}, {target_y}).", "observation": _observation()}


@register("scroll")
def scroll(args: Dict[str, Any]) -> Dict[str, Any]:
    _require_ydotool()
    try:
        amount = max(-5000, min(5000, int(args.get("amount", 0))))
    except (TypeError, ValueError):
        raise ToolError("Scroll amount must be an integer.")
    if amount == 0:
        raise ToolError("Scroll amount must not be zero.")
    if "x" in args or "y" in args:
        x, y = _coordinate(args)
        _move_cursor(x, y)
    # ydotool wheel units: positive = up, negative = down
    run(["ydotool", "wheel", "--", str(amount)])
    return {"result": f"Scrolled {amount} units.", "observation": _observation()}


@register("typeText")
def type_text(args: Dict[str, Any]) -> Dict[str, Any]:
    if not have("wtype"):
        raise ToolError("wtype is not installed; keyboard input is unavailable.")
    text = args.get("text")
    if not isinstance(text, str) or not text:
        raise ToolError("Non-empty text is required.")
    if len(text) > 10000:
        raise ToolError("Text is too long for one input action (maximum 10,000 characters).")
    run(["wtype", text])
    return {"result": f"Typed {len(text)} characters.", "observation": _observation()}


_WTYPE_KEY_ALIASES = {
    "enter": "Return", "return": "Return", "esc": "Escape", "escape": "Escape",
    "tab": "Tab", "space": "space", "backspace": "BackSpace", "delete": "Delete",
    "up": "Up", "down": "Down", "left": "Left", "right": "Right",
    "home": "Home", "end": "End", "pageup": "Prior", "pagedown": "Next",
}


def _wtype_key(key: str) -> str:
    return _WTYPE_KEY_ALIASES.get(key.lower(), key)


@register("pressKey")
def press_key(args: Dict[str, Any]) -> Dict[str, Any]:
    if not have("wtype"):
        raise ToolError("wtype is not installed; keyboard input is unavailable.")
    key = str(args.get("key") or "").strip()
    if not key:
        raise ToolError("Unsupported keyboard key: (empty).")
    presses = max(1, min(20, int(args.get("presses", 1))))
    interval = max(0.0, min(0.5, float(args.get("interval", 0.05))))
    mapped = _wtype_key(key)
    for i in range(presses):
        run(["wtype", "-k", mapped])
        if i < presses - 1:
            time.sleep(interval)
    return {"result": f"Pressed {key} {presses} time(s).", "observation": _observation()}


@register("hotkey")
def hotkey(args: Dict[str, Any]) -> Dict[str, Any]:
    if not have("wtype"):
        raise ToolError("wtype is not installed; keyboard input is unavailable.")
    raw_keys = args.get("keys")
    if not isinstance(raw_keys, list) or not (2 <= len(raw_keys) <= 5):
        raise ToolError("Hotkey requires an array of 2 to 5 keys.")
    cmd = ["wtype"]
    for k in raw_keys[:-1]:
        cmd += ["-M", _wtype_key(str(k)).lower()]
    cmd += ["-k", _wtype_key(str(raw_keys[-1]))]
    for k in raw_keys[:-1]:
        cmd += ["-m", _wtype_key(str(k)).lower()]
    run(cmd)
    return {"result": f"Pressed hotkey: {'+'.join(str(k) for k in raw_keys)}.", "observation": _observation()}


@register("getCursorPosition")
def get_cursor_position(_args: Dict[str, Any]) -> Dict[str, Any]:
    observation = _observation()
    return {"result": f"Cursor is at ({observation['cursor']['x']}, {observation['cursor']['y']}).", "observation": observation}


@register("getActiveWindow")
def get_active_window(_args: Dict[str, Any]) -> Dict[str, Any]:
    info = _active_window_info()
    return {"result": f"Active window: {info['title'] or '(none)'}.", "active_window": info}


@register("listVisibleWindows")
def list_visible_windows(args: Dict[str, Any]) -> Dict[str, Any]:
    limit = max(1, min(100, int(args.get("limit", 50))))
    windows = _visible_windows(limit)
    return {"result": f"Found {len(windows)} visible windows.", "windows": windows}


@register("waitForUi")
def wait_for_ui(args: Dict[str, Any]) -> Dict[str, Any]:
    delay = max(0.05, min(5.0, float(args.get("seconds", 0.5))))
    previous_title = str(args.get("previous_title") or "")
    time.sleep(delay)
    observation = _observation(include_windows=bool(args.get("include_windows", False)))
    current_title = observation["active_window"].get("title") or ""
    return {
        "result": f"Waited {delay:.2f}s and observed the UI.",
        "changed": bool(current_title != previous_title),
        "observation": observation,
    }


@register("observeDesktopState")
def observe_desktop_state(args: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "result": "Observed current desktop metadata.",
        "observation": _observation(include_windows=bool(args.get("include_windows", True))),
    }


__all__ = [
    "move_mouse", "click", "double_click", "right_click", "drag", "scroll",
    "type_text", "press_key", "hotkey", "get_cursor_position", "get_active_window",
    "list_visible_windows", "wait_for_ui", "observe_desktop_state",
]
