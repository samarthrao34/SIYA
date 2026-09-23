# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_pc.pyc (Python 3.12 bytecode).
# Status: PARTIAL decompile (pycdc) — 14 unsupported-opcode gaps (Python 3.12-only bytecode pycdc can't fully translate: POP_JUMP_IF_NONE/MAKE_CELL/LOAD_FAST_AND_CLEAR etc). Structure/imports/most logic recovered; some function bodies truncated at '# WARNING: Decompyle incomplete'

# Source Generated with Decompyle++
# File: tools_pc.pyc (Python 3.12)

'''
PC control: system volume and (gated) power actions.

Volume:
  Uses pycaw + comtypes for precise scalar control on Windows when available,
  with a graceful media-key fallback (VK_VOLUME_UP/DOWN/MUTE via keybd_event)
  through pyautogui.

Power:
  shutdown / restart / sleep / lock are DANGEROUS and require the two-step
  confirmation flow (tools_confirmation). `executePowerAction` consumes the
  token before running anything destructive.
'''
from __future__ import annotations
import ctypes
import os
import platform
import subprocess
import time
from typing import Any, Dict, Optional
from registry import ToolError, register
from tools_confirmation import ACTION_LABEL, consume_token
_vol_backend = None

def _init_pycaw():
    
    try:
        cast = cast
        POINTER = POINTER
        import ctypes
        import comtypes
        AudioUtilities = AudioUtilities
        IAudioEndpointVolume = IAudioEndpointVolume
        import pycaw.pycaw
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, comtypes.CLSCTX_ALL, None)
        volume = cast(interface, POINTER(IAudioEndpointVolume))
        return volume
    except Exception:
        return None



def _get_volume_interface():
    pass
# WARNING: Decompyle incomplete

_VOL_CACHE: 'Dict[str, Any]' = { }

def _current_volume():
    '''Returns current master volume in 0.0..1.0 (best effort).'''
    backend = _get_volume_interface()
# WARNING: Decompyle incomplete


def _set_volume_scalar(value = None):
    value = max(0, min(1, float(value)))
    backend = _get_volume_interface()
# WARNING: Decompyle incomplete

VK_VOLUME_MUTE = 173
VK_VOLUME_UP = 175
VK_VOLUME_DOWN = 174
KEYEVENTF_KEYUP = 2

def _press_vk(vk = None):
    
    try:
        ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
        time.sleep(0.03)
        ctypes.windll.user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
        return None
    except Exception:
        import pyautogui
        if vk == VK_VOLUME_UP:
            pyautogui.press('volumeup')
        elif vk == VK_VOLUME_DOWN:
            pyautogui.press('volumedown')
        elif vk == VK_VOLUME_MUTE:
            pyautogui.press('volumemute')
            return None
        return None
        return None
        return None
        except Exception:
            return None



def _set_volume_via_keys(target = None):
    '''Approximate target volume by stepping media keys. Coarse but reliable.'''
    current = _current_volume()
    diff = target - current
    steps = int(abs(diff) / 0.02) + 1
    vk = VK_VOLUME_UP if diff > 0 else VK_VOLUME_DOWN
    for _ in range(min(steps, 50)):
        _press_vk(vk)
        time.sleep(0.01)


def _toggle_mute_pycaw():
    iface = _VOL_CACHE.get('iface')
# WARNING: Decompyle incomplete

volume_up = (lambda args = None: step = float(args.get('amount', 0.1))new = min(1, _current_volume() + step)_set_volume_scalar(new){
'result': f'''Volume increased to {int(new * 100)}%.''' })()
volume_down = (lambda args = None: step = float(args.get('amount', 0.1))new = max(0, _current_volume() - step)_set_volume_scalar(new){
'result': f'''Volume decreased to {int(new * 100)}%.''' })()
set_volume = (lambda args = None: if 'percent' in args:
pct = float(args['percent'])elif 'level' in args:
pct = float(args['level'])else:
raise ToolError("Parameter 'percent' (0-100) is required.")pct = max(0, min(100, pct))_set_volume_scalar(pct / 100){
'result': f'''Volume set to {int(pct)}%.''' })()
mute_toggle = (lambda args = None: muted = _toggle_mute_pycaw()if muted:
{
'result': 'Muted.' }{
None: 'result' })()

def _run_power(action = None):
    '''Execute the actual OS power command. Caller must have confirmed first.'''
    system = platform.system()
    if action == 'lock':
        if system == 'Windows':
            ctypes.windll.user32.LockWorkStation()
            return 'Computer locked.'
        return 'Lock is only configured for Windows.'
    if action == 'sleep':
        if system == 'Windows':
            os.system('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')
            return 'Computer going to sleep.'
        subprocess.run([
            'systemctl',
            'suspend'], check = False)
        return 'Computer going to sleep.'
    if action == 'restart':
        if system == 'Windows':
            subprocess.run([
                'shutdown',
                '/r',
                '/t',
                '5'], check = False)
            return 'Computer restarting in 5 seconds.'
        subprocess.run([
            'shutdown',
            '-r',
            'now'], check = False)
        return 'Computer restarting.'
    if action == 'shutdown':
        if system == 'Windows':
            subprocess.run([
                'shutdown',
                '/s',
                '/t',
                '10'], check = False)
            return 'Computer shutting down in 10 seconds.'
        subprocess.run([
            'shutdown',
            '-h',
            'now'], check = False)
        return 'Computer shutting down.'
    raise ToolError(f'''Unknown power action \'{action}\'.''')

execute_power_action = (lambda args = None: if not args.get('action'):
args.get('action')action = ''.strip().lower()token = args.get('execute_token')DANGEROUS_ACTIONS = DANGEROUS_ACTIONSimport tools_confirmationif action not in DANGEROUS_ACTIONS:
raise ToolError(f'''Unknown power action \'{action}\'. Valid: {', '.join(sorted(DANGEROUS_ACTIONS))}.''')consume_token(action, token)msg = _run_power(action){
'result': msg,
'action': action })()
_cancel = (lambda args = None: subprocess.run([
'shutdown',
'/a'], check = False){
'result': 'Cancelled pending shutdown/restart timer.' })()
_sbc = None

def _brightness_backend():
    '''Return the screen_brightness_control module, or None if unavailable.'''
    pass
# WARNING: Decompyle incomplete


def _current_brightness():
    sbc = _brightness_backend()
# WARNING: Decompyle incomplete


def _set_brightness(pct = None):
    pct = max(0, min(100, pct))
    sbc = _brightness_backend()
# WARNING: Decompyle incomplete

brightness_up = (lambda args = None: step = float(args.get('amount', 10))current = _current_brightness()new = _set_brightness(current + step){
'result': f'''Brightness increased to {new}%.''',
'brightness': new })()
brightness_down = (lambda args = None: step = float(args.get('amount', 10))current = _current_brightness()new = _set_brightness(current - step){
'result': f'''Brightness decreased to {new}%.''',
'brightness': new })()
set_brightness = (lambda args = None: if 'percent' in args:
pct = float(args['percent'])elif 'level' in args:
pct = float(args['level'])else:
raise ToolError("Parameter 'percent' (0-100) is required.")new = _set_brightness(pct){
'result': f'''Brightness set to {new}%.''',
'brightness': new })()
__all__ = [
    'volume_up',
    'volume_down',
    'set_volume',
    'mute_toggle',
    'execute_power_action',
    'ACTION_LABEL',
    'brightness_up',
    'brightness_down',
    'set_brightness']
