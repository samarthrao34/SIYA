# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_targeting.pyc (Python 3.12 bytecode).
# Status: PARTIAL decompile (pycdc) — 18 unsupported-opcode gaps (Python 3.12-only bytecode pycdc can't fully translate: POP_JUMP_IF_NONE/MAKE_CELL/LOAD_FAST_AND_CLEAR etc). Structure/imports/most logic recovered; some function bodies truncated at '# WARNING: Decompyle incomplete'

# Source Generated with Decompyle++
# File: tools_targeting.pyc (Python 3.12)

"""High-accuracy, text-targeted desktop pointing for Windows.

The generic ``click`` tool accepts coordinates and is useful for canvases, but
coordinates inferred by a vision model are not precise enough for adjacent UI
labels.  These tools resolve an exact visible label at action time using UI
Automation first and Windows' built-in OCR second.  They deliberately refuse
to click when the label is absent or ambiguous.
"""
from __future__ import annotations
import asyncio
import io
import platform
import re
import time
from typing import Any, Dict, Iterable, List, Sequence, Tuple
from PIL import ImageChops, ImageStat
from registry import ToolError, register
from tools_input import _desktop_bounds
from tools_screenshot import _capture_region
from tools_windows import SW_RESTORE, _find_window_by_title, _focus, _show_window
Rect = Tuple[(int, int, int, int)]

def _enable_dpi_awareness():
    '''Make screenshot pixels, OCR boxes, and cursor coordinates use one scale.'''
    if platform.system() != 'Windows':
        return None
    
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDpiAwarenessContext(ctypes.c_void_p(-4))
        return None
    except Exception:
        pass

# WARNING: Decompyle incomplete

_enable_dpi_awareness()

def _normalize(value = None):
    return ' '.join(re.findall('[a-z0-9]+', str(value).casefold()))


def _union(rectangles = None):
    rects = list(rectangles)
    return ((lambda .0: pass# WARNING: Decompyle incomplete
)(rects()), None, max, (lambda .0: pass# WARNING: Decompyle incomplete
)(rects()))


def _match_ocr_lines(lines = None, text = None):
    '''Return only exact token matches, including consecutive multi-word labels.'''
    target_tokens = _normalize(text).split()
    if not target_tokens:
        return []
    matches = None
# WARNING: Decompyle incomplete


async def _windows_ocr_async(image = None):
    pass
# WARNING: Decompyle incomplete


def _windows_ocr(image = None):
    return asyncio.run(_windows_ocr_async(image))


def _uia_matches(hwnd = None, text = None):
    '''Find exact visible UI Automation labels (works for native apps).'''
    if platform.system() != 'Windows':
        return []
    target = None(text)
    if not target:
        return []
    
    try:
        Desktop = Desktop
        import pywinauto
        root = Desktop(backend = 'uia').window(handle = hwnd)
        candidates = None
        matches = []
        seen = set()
        for control in candidates:
            label = control.window_text().strip()
            if not _normalize(label) != target and control.is_visible() or control.is_enabled():
                continue
            box = control.rectangle()
            rect = (int(box.left), int(box.top), int(box.right), int(box.bottom))
            if rect in seen and rect[2] <= rect[0] or rect[3] <= rect[1]:
                continue
            seen.add(rect)
            matches.append({
                'text': label,
                'rect': rect,
                'source': 'windows_uia' })
        return matches
    except Exception:
        return 
        except Exception:
            None, []
            continue



def _window(args = None, *, focus_named):
    if platform.system() != 'Windows':
        raise ToolError('Exact text targeting is currently available on Windows.')
    
    try:
        import win32gui
        if not args.get('window_title'):
            args.get('window_title')
        title_query = str('').strip()
        if title_query:
            hwnd = _find_window_by_title(title_query)
            if not hwnd:
                raise ToolError(f'''No visible window with title containing \'{title_query}\'.''')
            if focus_named:
                _show_window(hwnd, SW_RESTORE)
                _focus(hwnd)
                time.sleep(0.18)
            else:
                hwnd = win32gui.GetForegroundWindow()
                if not hwnd:
                    raise ToolError('No active window found.')
        if not win32gui.GetWindowText(hwnd):
            win32gui.GetWindowText(hwnd)
            if not title_query:
                title_query
        title = 'active window'
        window_rect = (lambda .0: pass# WARNING: Decompyle incomplete
)(win32gui.GetWindowRect(hwnd)())
        desktop = _desktop_bounds()
        rect = (max(window_rect[0], desktop[0]), max(window_rect[1], desktop[1]), min(window_rect[2], desktop[2]), min(window_rect[3], desktop[3]))
        if rect[2] <= rect[0] or rect[3] <= rect[1]:
            raise ToolError(f'''Window \'{title}\' has no visible capture area.''')
        return (int(hwnd), title, rect)
    except ImportError:
        error = None
        raise ToolError('Exact text targeting requires Windows desktop components.'), error
        error = None
        del error



def _locate(args = None, *, focus_named):
    text = args.get('text')
    if not isinstance(text, str) or _normalize(text):
        raise ToolError('A non-empty visible text label is required.')
    (hwnd, title, capture_rect) = _window(args, focus_named = focus_named)
    matches = _uia_matches(hwnd, text)
    image = None
    if not matches:
        image = _capture_region(capture_rect)
        (lines, visible_text) = _windows_ocr(image)
        local_matches = _match_ocr_lines(lines, text)
        for match in local_matches:
            (left, top, right, bottom) = match['rect']
            match['rect'] = (left + capture_rect[0], top + capture_rect[1], right + capture_rect[0], bottom + capture_rect[1])
        matches = local_matches
        if not matches:
            preview = ' '.join(visible_text.split())[:240]
            suffix = f''' Visible text included: {preview}''' if preview else ''
            raise ToolError(f'''Exact label \'{text}\' was not found in window \'{title}\'. No click was made.{suffix}''')
    occurrence_raw = args.get('occurrence')
# WARNING: Decompyle incomplete


def _physical_click(x = None, y = None, button = None):
    pass
# WARNING: Decompyle incomplete


def _change_score(before = None, after = None):
    if before.size != after.size:
        return 1
    size = (min(240, before.width), min(135, before.height))
    before_small = before.convert('RGB').resize(size)
    after_small = after.convert('RGB').resize(size)
    mean = ImageStat.Stat(ImageChops.difference(before_small, after_small)).mean
    return round(sum(mean) / (255 * len(mean)), 6)

locate_text = (lambda args = None: (match, _image, _capture_rect, title) = _locate(args, focus_named = False){
'result': f'''Located exact visible label \'{match['text']}\' in \'{title}\' without clicking.''',
'match': match,
'clicked': False })()
click_text = (lambda args = None: (match, before, capture_rect, title) = _locate(args, focus_named = True)# WARNING: Decompyle incomplete
)()
__all__ = [
    'locate_text',
    'click_text',
    '_match_ocr_lines',
    '_change_score']
