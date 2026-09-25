"""
Clipboard control: copy / paste / read / clear.

copy_selected   -> sends Ctrl+C to whatever has focus, then reads the clipboard.
paste_clipboard -> writes `text` to the clipboard, then sends Ctrl+V.
get_clipboard   -> returns the current clipboard text.
clear_clipboard -> empties the clipboard.

Backend: wl-clipboard (wl-copy/wl-paste), the standard Wayland clipboard
tool. Copy/paste keystrokes use wtype.
"""
from __future__ import annotations

import subprocess
import time
from typing import Any, Dict

from .registry import ToolError, register
from ._linux import have, run


def _require_wl_clipboard():
    if not (have("wl-copy") and have("wl-paste")):
        raise ToolError("wl-clipboard (wl-copy/wl-paste) is not installed; clipboard control is unavailable.")


def _press_copy():
    if not have("wtype"):
        raise ToolError("Could not send copy keystroke: wtype is not installed.")
    run(["wtype", "-M", "ctrl", "-k", "c", "-m", "ctrl"])


def _press_paste():
    if not have("wtype"):
        raise ToolError("Could not send paste keystroke: wtype is not installed.")
    run(["wtype", "-M", "ctrl", "-k", "v", "-m", "ctrl"])


def _read_clipboard() -> str:
    _require_wl_clipboard()
    out = run(["wl-paste", "-n"])
    if out.returncode != 0:
        # wl-paste exits non-zero when the clipboard is empty -- not an error
        return ""
    return out.stdout


def _write_clipboard(text: str):
    _require_wl_clipboard()
    try:
        subprocess.run(["wl-copy"], input=text, text=True, timeout=5)
    except Exception as e:
        raise ToolError(f"Could not write clipboard: {e}")


@register("copySelected")
def copy_selected(args: Dict[str, Any]) -> Dict[str, Any]:
    _press_copy()
    time.sleep(float(args.get("wait", 0.35)))
    text = _read_clipboard()
    if not text:
        return {"result": "Sent copy, but the clipboard is empty."}
    preview = text if len(text) <= 200 else text[:200] + "…"
    return {"result": f"Copied {len(text)} characters.", "text": preview, "full_length": len(text)}


@register("pasteClipboard")
def paste_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    text = args.get("text")
    if isinstance(text, str) and text:
        _write_clipboard(text)
    _press_paste()
    return {"result": "Pasted clipboard content." if not text else f"Set clipboard to {len(text)} characters and pasted."}


@register("getClipboard")
def get_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    text = _read_clipboard()
    max_chars = int(args.get("max_chars", 1000))
    if len(text) > max_chars:
        text = text[:max_chars] + "…"
    return {"result": "Clipboard read.", "text": text, "length": len(text)}


@register("clearClipboard")
def clear_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    _write_clipboard("")
    return {"result": "Clipboard cleared."}


__all__ = ["copy_selected", "paste_clipboard", "get_clipboard", "clear_clipboard"]
