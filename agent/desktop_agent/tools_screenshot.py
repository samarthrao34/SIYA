# Recovered via marshal/bytecode introspection of desktop_agent/tools_screenshot.pyc (Python 3.12).
# Status: STUB — pycdc segfaults decompiling this module (control-flow edge case, confirmed even after
# isolating each function separately). Docstrings and signatures below are VERBATIM from the bytecode's
# constant pool (not inferred); function bodies are NOT recovered. See README.md and _disassembly/tools_screenshot.dis.

"""
Screenshot & screen-reading: capture, save, OCR, and read on-screen text.

  takeScreenshot    -> capture full screen, return metadata (+ small base64)
  saveScreenshot    -> capture & write to a file under the Screenshots folder
  analyzeScreenshot-> capture, run OCR (pytesseract), return extracted text
  readScreen        -> OCR the active window region + name the active window
  viewScreen        -> explicit SIYA screen-vision: capture the active display,
                       return an optimized JPEG + dimensions + active window
                       title. A temp copy is created only when requested.

OCR requires the Tesseract OCR engine + the pytesseract wrapper. If either is
missing, the OCR tools return a graceful 'unavailable' message instead of
crashing; non-OCR capture still works.
"""

def _capture():
    """Capture the full virtual screen as a PIL Image."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _capture_region_gdi(bbox):
    """Capture a physical Windows rectangle through GDI.

    Pillow's ``ImageGrab`` can fail after PyInstaller freezing even though it
    works from source. GDI uses the pywin32 modules already shipped for SIYA's
    desktop controls and behaves identically in source and frozen runtimes.
    """
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _capture_region_mss(bbox):
    """Capture a physical rectangle with the headless-safe MSS backend."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _capture_region(bbox):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _foreground_monitor_bbox(hwnd):
    """Return the physical bounds of the display containing ``hwnd``."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _is_siya_window(title):
    """Match only SIYA's own packaged window, not arbitrary browser pages."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _capture_active_display():
    """Capture the display containing the user's foreground application.

    Capturing only the foreground *window* made typed requests photograph
    SIYA itself, because the user had to focus SIYA to type the question.
    The packaged app window is therefore hidden for the duration of this one
    capture and restored immediately; the newly exposed foreground display is
    then captured in full. Voice requests made while another app is focused do
    not hide or modify that app.
    """
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _active_window_bbox():
    """Return (left, top, right, bottom) of the foreground window, or None."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _active_window_title():
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _image_to_b64(img, fmt, quality):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _image_size_kb(img):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _run_ocr(img):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _find_tesseract_exe():
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _trim_ocr(text, max_chars):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def take_screenshot(args):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def save_screenshot(args):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def analyze_screenshot(args):
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def read_screen(args):
    """OCR the active window and report its title + visible text."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _cleanup_old_temp_files(max_age_s):
    """Best-effort reaping of stale siya-screen-vision temp files."""
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def _save_temp_frame(img, prefix):
    """Write a downsized JPEG of the captured image into the temp dir.

    Returns a dict with the saved path, file size, and the JPEG bytes
    separately so the caller can choose whether to keep or delete it.
    """
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

def view_screen(args):
    """Capture the screen for the AI to see.

    The SIYA Node bridge calls this only when the user has explicitly asked
    to look at / analyse / read their screen. The function:

      1. Captures the full display containing the foreground application;
         falls back to the primary display.
      2. Optionally stores a downsized JPEG under the OS temp directory only
         when ``keep_file`` is true.
      3. Returns the JPEG as base64 plus metadata so the bridge can hand it
         to the multimodal model as visual context.
      4. Reaps any stale temp files left over from previous calls.
    """
    ...  # STUB: body not recoverable — pycdc segfaults on this module (see ../_disassembly/tools_screenshot.dis for raw bytecode)

