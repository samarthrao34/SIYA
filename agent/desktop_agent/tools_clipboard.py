# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_clipboard.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 2 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_clipboard.pyc (Python 3.12)

'''
Clipboard control: copy / paste / read / clear.

copy_selected  -> sends Ctrl+C to whatever has focus, then reads the clipboard.
paste_clipboard-> writes `text` to the clipboard, then sends Ctrl+V.
get_clipboard  -> returns the current clipboard text.
clear_clipboard-> empties the clipboard.

pyperclip is the backend; copy/paste keystrokes use pyautogui when available.
'''
from __future__ import annotations
import time
from typing import Any, Dict
from registry import ToolError, register

def _press_copy():
    
    try:
        import pyautogui
        pyautogui.hotkey('ctrl', 'c')
        return None
    except Exception:
        pass

    
    try:
        import ctypes
        VK_CONTROL = 17
        VK_C = 67
        KEYEVENTF_KEYUP = 2
        u32 = ctypes.windll.user32
        u32.keybd_event(VK_CONTROL, 0, 0, 0)
        u32.keybd_event(VK_C, 0, 0, 0)
        time.sleep(0.03)
        u32.keybd_event(VK_C, 0, KEYEVENTF_KEYUP, 0)
        u32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
        return None
    except Exception:
        raise ToolError('Could not send copy keystroke.')



def _press_paste():
    
    try:
        import pyautogui
        pyautogui.hotkey('ctrl', 'v')
        return None
    except Exception:
        pass

    
    try:
        import ctypes
        VK_CONTROL = 17
        VK_V = 86
        KEYEVENTF_KEYUP = 2
        u32 = ctypes.windll.user32
        u32.keybd_event(VK_CONTROL, 0, 0, 0)
        u32.keybd_event(VK_V, 0, 0, 0)
        time.sleep(0.03)
        u32.keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0)
        u32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
        return None
    except Exception:
        raise ToolError('Could not send paste keystroke.')



def _read_clipboard():
    
    try:
        import pyperclip
        if not pyperclip.paste():
            pyperclip.paste()
        return ''
    except Exception:
        e = None
        raise ToolError(f'''Could not read clipboard: {e}''')
        e = None
        del e



def _write_clipboard(text = None):
    
    try:
        import pyperclip
        pyperclip.copy(text)
        return None
    except Exception:
        e = None
        raise ToolError(f'''Could not write clipboard: {e}''')
        e = None
        del e


copy_selected = (lambda args = None: _press_copy()time.sleep(float(args.get('wait', 0.35)))text = _read_clipboard()if not text:
{
'result': 'Sent copy, but the clipboard is empty.' }preview = text if None(text) <= 200 else text[:200] + '…'{
'result': f'''Copied {len(text)} characters.''',
'text': preview,
'full_length': len(text) })()
paste_clipboard = (lambda args = None: text = args.get('text')# WARNING: Decompyle incomplete
)()
get_clipboard = (lambda args = None: text = _read_clipboard()max_chars = int(args.get('max_chars', 1000))if len(text) > max_chars:
text = text[:max_chars] + '…'{
'result': 'Clipboard read.',
'text': text,
'length': len(text) })()
clear_clipboard = (lambda args = None: _write_clipboard(''){
'result': 'Clipboard cleared.' })()
__all__ = [
    'copy_selected',
    'paste_clipboard',
    'get_clipboard',
    'clear_clipboard']
