"""
High-accuracy, text-targeted desktop pointing.

The generic `click` tool accepts coordinates and is useful for canvases, but
coordinates inferred by a vision model are not precise enough for adjacent
UI labels. These tools resolve an exact visible label via OCR at action
time and click its center. They deliberately refuse to click when the label
is absent or ambiguous.

Note: the original Windows agent tried UI Automation first, falling back to
OCR. Linux has no directly-equivalent accessible cross-toolkit UI Automation
API wired up here, so this port is OCR-only -- still accurate for most
text-labeled buttons/links, just without the native-control fast path.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple

from .registry import ToolError, register
from ._linux import have, resolve_target_window, window_display_title
from .tools_screenshot import _capture, _PYTESSERACT_OK

try:
    import pytesseract
except ImportError:
    pytesseract = None


def _normalize(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", str(value).casefold()))


def _ocr_word_boxes(img) -> List[Dict[str, Any]]:
    if not (_PYTESSERACT_OK and have("tesseract")):
        raise ToolError("OCR is unavailable (tesseract/pytesseract not installed) -- cannot target text.")
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    words = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        if not text:
            continue
        words.append({
            "text": text,
            "left": data["left"][i], "top": data["top"][i],
            "width": data["width"][i], "height": data["height"][i],
        })
    return words


def _match_ocr_words(words: List[Dict[str, Any]], text: str) -> List[Tuple[int, int, int, int]]:
    """Find consecutive word sequences matching `text`, return their union rects."""
    target_tokens = _normalize(text).split()
    if not target_tokens:
        return []
    normalized_words = [_normalize(w["text"]) for w in words]
    matches = []
    n = len(target_tokens)
    for start in range(len(words) - n + 1):
        if normalized_words[start:start + n] == target_tokens:
            group = words[start:start + n]
            left = min(w["left"] for w in group)
            top = min(w["top"] for w in group)
            right = max(w["left"] + w["width"] for w in group)
            bottom = max(w["top"] + w["height"] for w in group)
            matches.append((left, top, right, bottom))
    return matches


def _locate(args: Dict[str, Any]):
    text = args.get("text")
    if not isinstance(text, str) or not _normalize(text):
        raise ToolError("A non-empty visible text label is required.")
    win = resolve_target_window(args) if (args.get("title") or args.get("application")) else None
    title = window_display_title(win) if win else "screen"
    offset_x, offset_y = 0, 0
    if win:
        at = win.get("at") or [0, 0]
        offset_x, offset_y = at[0], at[1]
        size = win.get("size") or [0, 0]
        img = _capture(f"{at[0]},{at[1]} {size[0]}x{size[1]}")
    else:
        img = _capture()
    words = _ocr_word_boxes(img)
    matches = _match_ocr_words(words, text)
    if not matches:
        visible_preview = " ".join(w["text"] for w in words[:40])
        suffix = f" Visible text included: {visible_preview}" if visible_preview else ""
        raise ToolError(f"Exact label '{text}' was not found in {title}. No click was made.{suffix}")
    occurrence = int(args.get("occurrence", 0))
    occurrence = max(0, min(occurrence, len(matches) - 1))
    left, top, right, bottom = matches[occurrence]
    center_x = offset_x + (left + right) // 2
    center_y = offset_y + (top + bottom) // 2
    return {"text": text, "rect": (left + offset_x, top + offset_y, right + offset_x, bottom + offset_y)}, center_x, center_y, title, len(matches)


@register("locateText")
def locate_text(args: Dict[str, Any]) -> Dict[str, Any]:
    match, x, y, title, count = _locate(args)
    return {
        "result": f"Located exact visible label '{match['text']}' in {title} at ({x}, {y}) without clicking.",
        "match": match, "x": x, "y": y, "occurrences_found": count, "clicked": False,
    }


@register("clickText")
def click_text(args: Dict[str, Any]) -> Dict[str, Any]:
    # Deferred import to avoid a module-load cycle (tools_input imports
    # nothing from here, but importing at module scope risks load-order
    # issues since both modules are loaded via registry.load_all()).
    from .tools_input import click as _click

    match, x, y, title, count = _locate(args)
    _click({"x": x, "y": y, "button": args.get("button", "left")})
    return {
        "result": f"Clicked exact visible label '{match['text']}' in {title} at ({x}, {y}).",
        "match": match, "x": x, "y": y, "occurrences_found": count, "clicked": True,
    }


__all__ = ["locate_text", "click_text"]
