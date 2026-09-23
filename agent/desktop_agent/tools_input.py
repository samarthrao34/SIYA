# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_input.pyc (Python 3.12 bytecode).
# Status: PARTIAL decompile (pycdc) — 8 unsupported-opcode gaps (Python 3.12-only bytecode pycdc can't fully translate: POP_JUMP_IF_NONE/MAKE_CELL/LOAD_FAST_AND_CLEAR etc). Structure/imports/most logic recovered; some function bodies truncated at '# WARNING: Decompyle incomplete'

# Source Generated with Decompyle++
# File: tools_input.pyc (Python 3.12)

"""Generic, application-independent mouse and keyboard primitives.

Every mutating primitive is deliberately short and bounded, leaves PyAutoGUI's
corner fail-safe enabled, and returns a fresh metadata observation.  This lets
SIYA use an observe -> act -> verify loop instead of firing blind click chains.
"""
from __future__ import annotations
import platform
import time
from typing import Any, Dict, Iterable, Tuple
from registry import ToolError, register

def _pyautogui():
    
    try:
        import pyautogui
        pyautogui.FAILSAFE = True
        pyautogui.PAUSE = 0.04
        return pyautogui
    except ImportError:
        error = None
        raise ToolError('Generic input control requires the pyautogui package.'), error
        error = None
        del error



def _desktop_bounds():
    '''Return left, top, right, bottom for the Windows virtual desktop.'''
    if platform.system() == 'Windows':
        
        try:
            import win32api
            import win32con
            left = win32api.GetSystemMetrics(win32con.SM_XVIRTUALSCREEN)
            top = win32api.GetSystemMetrics(win32con.SM_YVIRTUALSCREEN)
            width = win32api.GetSystemMetrics(win32con.SM_CXVIRTUALSCREEN)
            height = win32api.GetSystemMetrics(win32con.SM_CYVIRTUALSCREEN)
            return (left, top, left + width, top + height)
            size = _pyautogui().size()
            return (0, 0, int(size.width), int(size.height))
        except Exception:
            continue



def _coordinate(args = None, x_name = None, y_name = None):
    if x_name not in args or y_name not in args:
        raise ToolError(f'''Both {x_name} and {y_name} are required.''')
    
    try:
        y = int(args[y_name])
        x = int(args[x_name])
        (left, top, right, bottom) = _desktop_bounds()
        if  <= left, x or left, x < right:
            pass
        
    if not  <= top, y or top, y < bottom:
        pass
    

    raise ToolError(f'''Coordinate ({x}, {y}) is outside the virtual desktop ({left}, {top})-({right - 1}, {bottom - 1}).''')
    return (x, y)
    except (TypeError, ValueError):
        raise ToolError('Mouse coordinates must be integers.'), error
        None = None
        del error


def _duration(value = None, maximum = None):
    
    try:
        if not value:
            value
        return max(0, min(maximum, float(0)))
    except (TypeError, ValueError):
        error = None
        raise ToolError('Duration must be a number.'), error
        error = None
        del error



def _button(value = None, allowed = None):
    if not value:
        value
    button = str('left').lower()
    if button not in set(allowed):
        raise ToolError(f'''Unsupported mouse button: {button}.''')
    return button


def _active_window():
    if platform.system() != 'Windows':
        return {
            'title': None,
            'pid': None,
            'bounds': None }
    
    try:
        import win32gui
        import win32process
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return {
                'title': None,
                'pid': None,
                'bounds': None }
        (_, pid) = None.GetWindowThreadProcessId(hwnd)
        (left, top, right, bottom) = win32gui.GetWindowRect(hwnd)
        if not win32gui.GetWindowText(hwnd):
            win32gui.GetWindowText(hwnd)
        return {
            'title': None,
            'pid': int(pid),
            'bounds': {
                'left': left,
                'top': top,
                'right': right,
                'bottom': bottom } }
    except Exception:
        return 



def _visible_windows(limit = None):
    pass
# WARNING: Decompyle incomplete


def _observation(include_windows = None):
    gui = _pyautogui()
    point = gui.position()
    (left, top, right, bottom) = _desktop_bounds()
    observed = {
        'timestamp': time.time(),
        'cursor': {
            'x': int(point.x),
            'y': int(point.y) },
        'active_window': _active_window(),
        'virtual_desktop': {
            'left': left,
            'top': top,
            'right': right,
            'bottom': bottom } }
    if include_windows:
        observed['visible_windows'] = _visible_windows()
    return observed

move_mouse = (lambda args = None: (x, y) = _coordinate(args)_pyautogui().moveTo(x, y, duration = _duration(args.get('duration', 0.2))){
'result': f'''Moved cursor to ({x}, {y}).''',
'observation': _observation() })()
click = (lambda args = None: gui = _pyautogui()if 'x' in args or 'y' in args:
(x, y) = _coordinate(args)gui.click(x = x, y = y, button = _button(args.get('button')))else:
gui.click(button = _button(args.get('button'))){
'result': 'Clicked once.',
'observation': _observation() })()
double_click = (lambda args = None: gui = _pyautogui()interval = max(0.03, min(0.5, float(args.get('interval', 0.12))))if 'x' in args or 'y' in args:
(x, y) = _coordinate(args)gui.doubleClick(x = x, y = y, interval = interval, button = 'left')else:
gui.doubleClick(interval = interval, button = 'left'){
'result': 'Double-clicked.',
'observation': _observation() })()
right_click = (lambda args = None: forwarded = dict(args)forwarded['button'] = 'right'result = click(forwarded)result['result'] = 'Right-clicked.'result)()
drag = (lambda args = None: gui = _pyautogui()(target_x, target_y) = _coordinate(args)if 'start_x' in args or 'start_y' in args:
(start_x, start_y) = _coordinate(args, 'start_x', 'start_y')gui.moveTo(start_x, start_y, duration = min(0.5, _duration(args.get('duration', 0.4))))gui.dragTo(target_x, target_y, duration = _duration(args.get('duration', 0.5)), button = _button(args.get('button'), ('left', 'right'))){
'result': f'''Dragged to ({target_x}, {target_y}).''',
'observation': _observation() })()
scroll = (lambda args = None: try:
amount = max(-5000, min(5000, int(args.get('amount', 0))))if amount == 0:
raise ToolError('Scroll amount must not be zero.')gui = _pyautogui()if 'x' in args or 'y' in args:
(x, y) = _coordinate(args)gui.scroll(amount, x = x, y = y)else:
gui.scroll(amount){
'result': f'''Scrolled {amount} units.''',
'observation': _observation() }except (TypeError, ValueError):
error = Noneraise ToolError('Scroll amount must be an integer.'), errorerror = Nonedel error)()
type_text = (lambda args = None: text = args.get('text')if not isinstance(text, str) or text:
raise ToolError('Non-empty text is required.')if len(text) > 10000:
raise ToolError('Text is too long for one input action (maximum 10,000 characters).')interval = max(0, min(0.25, float(args.get('interval', 0.01))))_pyautogui().write(text, interval = interval){
'result': f'''Typed {len(text)} characters.''',
'observation': _observation() })()
press_key = (lambda args = None: gui = _pyautogui()if not args.get('key'):
args.get('key')key = str('').lower()if key not in gui.KEYBOARD_KEYS:
if not key:
keyraise ToolError(f'''Unsupported keyboard key: {'(empty)'}.''')presses = max(1, min(20, int(args.get('presses', 1))))gui.press(key, presses = presses, interval = max(0, min(0.5, float(args.get('interval', 0.05))))){
'result': f'''Pressed {key} {presses} time(s).''',
'observation': _observation() })()
hotkey = (lambda args = None: gui = _pyautogui()raw_keys = args.get('keys')if isinstance(raw_keys, list):
if not  <= 2, len(raw_keys) or 2, len(raw_keys) <= 5:
raise ToolError('Hotkey requires an array of 2 to 5 keys.')raise ToolError('Hotkey requires an array of 2 to 5 keys.')# WARNING: Decompyle incomplete
)()
get_cursor_position = (lambda _args = None: observation = _observation()# WARNING: Decompyle incomplete
)()
get_active_window = (lambda _args = None: pass# WARNING: Decompyle incomplete
)()
list_visible_windows = (lambda args = None: limit = max(1, min(100, int(args.get('limit', 50))))windows = _visible_windows(limit){
'result': f'''Found {len(windows)} visible windows.''',
'windows': windows })()
wait_for_ui = (lambda args = None: delay = max(0.05, min(5, float(args.get('seconds', 0.5))))if not args.get('previous_title'):
args.get('previous_title')previous_title = str('')time.sleep(delay)observation = _observation(include_windows = bool(args.get('include_windows', False)))if not observation['active_window'].get('title'):
observation['active_window'].get('title')current_title = str('')if previous_title:
previous_title{
'result': f'''Waited {delay:.2f}s and observed the UI.''',
'changed': bool(current_title != previous_title),
'observation': observation })()
observe_desktop_state = (lambda args = None: {
'result': 'Observed current desktop metadata.',
'observation': _observation(include_windows = bool(args.get('include_windows', True))) })()
__all__ = [
    'move_mouse',
    'click',
    'double_click',
    'right_click',
    'drag',
    'scroll',
    'type_text',
    'press_key',
    'hotkey',
    'get_cursor_position',
    'get_active_window',
    'list_visible_windows',
    'wait_for_ui',
    'observe_desktop_state']
