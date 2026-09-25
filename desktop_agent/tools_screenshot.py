"""
Screenshot & screen-reading: capture, save, OCR, and read on-screen text.

  takeScreenshot     -> capture full screen, return metadata (+ base64 if asked)
  saveScreenshot     -> capture & write to a file under ~/Pictures/Screenshots
  analyzeScreenshot  -> capture, run OCR (pytesseract), return extracted text
  readScreen         -> OCR the active window region + name the active window
  viewScreen         -> explicit SIYA screen-vision: capture the active
                        display/window, return an optimized JPEG + dimensions
                        + active window title. A temp copy is created only
                        when keep_file is true.

Capture backend: grim (Wayland screenshot tool). OCR requires the Tesseract
OCR engine + pytesseract; if either is missing, OCR tools return a graceful
'unavailable' message instead of crashing -- non-OCR capture still works.

Response field names (image_base64, width, height) match exactly what
server.ts expects (see requiresImageCapture / the /api/screen-vision route).
"""
from __future__ import annotations

import base64
import io
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from .registry import ToolError, register
from ._linux import have, run, active_window, hyprctl_json

try:
    from PIL import Image
    _PIL_OK = True
except ImportError:
    _PIL_OK = False

try:
    import pytesseract
    _PYTESSERACT_OK = True
except ImportError:
    _PYTESSERACT_OK = False


def _require_grim():
    if not have("grim"):
        raise ToolError("grim is not installed; screen capture is unavailable.")


def _require_pil():
    if not _PIL_OK:
        raise ToolError("Pillow is not installed; image processing is unavailable.")


def _capture(geometry: Optional[str] = None) -> "Image.Image":
    """Capture the full screen, or a region if `geometry` ('X,Y WxH') is given."""
    _require_grim()
    _require_pil()
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        tmp_path = f.name
    try:
        cmd = ["grim"]
        if geometry:
            cmd += ["-g", geometry]
        cmd.append(tmp_path)
        out = run(cmd, timeout=10)
        if out.returncode != 0:
            raise ToolError(f"grim capture failed: {out.stderr.strip()}")
        return Image.open(tmp_path).convert("RGB").copy()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _active_window_geometry() -> Optional[Tuple[str, str]]:
    """Return (grim_geometry_string, window_title) for the focused window, or None."""
    win = active_window()
    if not win:
        return None
    at = win.get("at")
    size = win.get("size")
    if not at or not size:
        return None
    geom = f"{at[0]},{at[1]} {size[0]}x{size[1]}"
    return geom, (win.get("title") or win.get("class") or "active window")


def _resize_max_dim(img: "Image.Image", max_dim: int) -> "Image.Image":
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    scale = max_dim / max(w, h)
    return img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)


def _image_to_b64_jpeg(img: "Image.Image", quality: int = 78) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _run_ocr(img: "Image.Image") -> str:
    if not _PYTESSERACT_OK:
        return ""
    if not have("tesseract"):
        return ""
    try:
        return pytesseract.image_to_string(img)
    except Exception:
        return ""


def _trim_ocr(text: str, max_chars: int) -> str:
    text = text.strip()
    if len(text) > max_chars:
        return text[:max_chars] + f"\n…[truncated, {len(text) - max_chars} more chars]"
    return text


@register("takeScreenshot")
def take_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    max_dim = max(320, min(1920, int(args.get("max_dim", 1280))))
    include_image = bool(args.get("include_image", False))
    img = _capture()
    img = _resize_max_dim(img, max_dim)
    result: Dict[str, Any] = {
        "result": f"Captured screenshot ({img.width}x{img.height}).",
        "width": img.width,
        "height": img.height,
    }
    if include_image:
        result["image_base64"] = _image_to_b64_jpeg(img)
    return result


@register("saveScreenshot")
def save_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    _require_pil()
    img = _capture()
    out_dir = Path.home() / "Pictures" / "Screenshots"
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = args.get("filename") or f"siya-{int(time.time())}.png"
    if not str(filename).lower().endswith(".png"):
        filename = f"{filename}.png"
    path = out_dir / str(filename)
    img.save(path, format="PNG")
    return {"result": f"Saved screenshot: {path}", "path": str(path), "width": img.width, "height": img.height}


@register("analyzeScreenshot")
def analyze_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    max_chars = int(args.get("max_chars", 4000))
    img = _capture()
    text = _run_ocr(img)
    if not text:
        return {"result": "OCR unavailable (tesseract/pytesseract not installed) or no text detected.", "text": ""}
    trimmed = _trim_ocr(text, max_chars)
    return {"result": f"Extracted {len(text)} characters of on-screen text.", "text": trimmed}


@register("readScreen")
def read_screen(args: Dict[str, Any]) -> Dict[str, Any]:
    max_chars = int(args.get("max_chars", 4000))
    geom_info = _active_window_geometry()
    if geom_info:
        geom, title = geom_info
        img = _capture(geom)
    else:
        img = _capture()
        title = "active window"
    text = _run_ocr(img)
    if not text:
        return {"result": f"Active window: {title}. OCR unavailable or no text detected.", "title": title, "text": ""}
    trimmed = _trim_ocr(text, max_chars)
    return {"result": f"Active window '{title}': extracted {len(text)} characters.", "title": title, "text": trimmed}


@register("viewScreen")
def view_screen(args: Dict[str, Any]) -> Dict[str, Any]:
    max_dim = max(320, min(1920, int(args.get("max_dim", 1024))))
    keep_file = bool(args.get("keep_file", False))
    geom_info = _active_window_geometry()
    title = geom_info[1] if geom_info else None
    # Capture the whole display, not just the focused window -- matches the
    # original design intent ("capture the display containing the foreground
    # application"), giving SIYA full visual context, not a cropped window.
    img = _capture()
    img = _resize_max_dim(img, max_dim)
    result: Dict[str, Any] = {
        "result": f"Captured screen ({img.width}x{img.height}).",
        "width": img.width,
        "height": img.height,
        "image_base64": _image_to_b64_jpeg(img),
        "active_window_title": title,
    }
    if keep_file:
        tmp_dir = Path(tempfile.gettempdir())
        path = tmp_dir / f"siya-screen-vision-{int(time.time())}.jpg"
        img.save(path, format="JPEG", quality=78)
        result["path"] = str(path)
        _cleanup_old_temp_files(tmp_dir, max_age_s=3600)
    return result


def _cleanup_old_temp_files(tmp_dir: Path, max_age_s: int = 3600):
    """Best-effort reaping of stale siya-screen-vision temp files."""
    try:
        now = time.time()
        for f in tmp_dir.glob("siya-screen-vision-*.jpg"):
            try:
                if now - f.stat().st_mtime > max_age_s:
                    f.unlink()
            except OSError:
                continue
    except OSError:
        pass


__all__ = ["take_screenshot", "save_screenshot", "analyze_screenshot", "read_screen", "view_screen"]
