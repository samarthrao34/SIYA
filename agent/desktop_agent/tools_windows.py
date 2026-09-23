# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_windows.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 4 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_windows.pyc (Python 3.12)

"""
Window management: minimize / maximize / close the active window or switch apps.

Uses win32gui for the foreground window and pygetwindow for title-based lookups,
with graceful degradation if a backend isn't present.
"""
from __future__ import annotations
import platform
import subprocess
import time
from typing import Any, Dict, Optional
from registry import ToolError, register
SW_MINIMIZE = 6
SW_MAXIMIZE = 3
SW_RESTORE = 9
SW_HIDE = 0

def _get_foreground_window():
    if platform.system() != 'Windows':
        return None
    
    try:
        import win32gui
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return None
            
            try:
                return hwnd
            except Exception:
                return None




def _window_title(hwnd = None):
    
    try:
        import win32gui
        return win32gui.GetWindowText(hwnd)
    except Exception:
        return ''



def _show_window(hwnd = None, cmd = None):
    
    try:
        import win32gui
        win32gui.ShowWindow(hwnd, cmd)
        return None
    except Exception:
        e = None
        raise ToolError(f'''Could not change window state: {e}''')
        e = None
        del e



def _close_window_hwnd(hwnd = None):
    
    try:
        import win32con
        import win32gui
        win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
        return None
    except Exception:
        e = None
        raise ToolError(f'''Could not close window: {e}''')
        e = None
        del e



def _find_window_by_title(query = None):
    '''Return the hwnd of the first window whose title contains query.'''
    pass
# WARNING: Decompyle incomplete


def _focus(hwnd = None):
    
    try:
        import win32gui
        win32gui.SetForegroundWindow(hwnd)
        return None
    except Exception:
        _show_window(hwnd, SW_RESTORE)
        time.sleep(0.1)
        import win32gui
        win32gui.SetForegroundWindow(hwnd)
        return None
        except Exception:
            e = None
            raise ToolError(f'''Could not focus window: {e}''')
            e = None
            del e



def _resolve_target(args = None):
    '''Pick the hwnd to operate on: explicit title, or the foreground window.'''
    if not args.get('title'):
        args.get('title')
    title = args.get('application')
    if title:
        hwnd = _find_window_by_title(str(title))
        if not hwnd:
            raise ToolError(f'''No visible window with title containing \'{title}\'.''')
        return (hwnd, str(title))
    hwnd = None()
    if not hwnd:
        raise ToolError('No active window found.')
    return (hwnd, _window_title(hwnd))

minimize_window = (lambda args = None: (hwnd, title) = _resolve_target(args)_show_window(hwnd, SW_MINIMIZE)if not title:
title{
'result': f'''Minimized window: {'active window'}.''' })()
maximize_window = (lambda args = None: (hwnd, title) = _resolve_target(args)_show_window(hwnd, SW_MAXIMIZE)if not title:
title{
'result': f'''Maximized window: {'active window'}.''' })()
close_window = (lambda args = None: (hwnd, title) = _resolve_target(args)_close_window_hwnd(hwnd)if not title:
title{
'result': f'''Closed window: {'active window'}.''' })()
switch_application = (lambda args = None: pass# WARNING: Decompyle incomplete
)()
__all__ = [
    'minimize_window',
    'maximize_window',
    'close_window',
    'switch_application']
