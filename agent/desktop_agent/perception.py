# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/perception.pyc (Python 3.12 bytecode).
# Status: PARTIAL decompile (pycdc) — 8 unsupported-opcode gaps (Python 3.12-only bytecode pycdc can't fully translate: POP_JUMP_IF_NONE/MAKE_CELL/LOAD_FAST_AND_CLEAR etc). Structure/imports/most logic recovered; some function bodies truncated at '# WARNING: Decompyle incomplete'

# Source Generated with Decompyle++
# File: perception.pyc (Python 3.12)

"""Lightweight local desktop observation for SIYA's event-driven runtime.

The snapshot contains metadata only: active window/app names, visible app names,
disk capacity, download file metadata, and idle time. It never captures screen
pixels, microphone audio, clipboard contents, or file contents.
"""
from __future__ import annotations
import ctypes
import os
import platform
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

try:
    import psutil
    PARTIAL_DOWNLOAD_SUFFIXES = {
        '.tmp',
        '.part',
        '.partial',
        '.crdownload'}
    
    def collect_snapshot():
        return {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'activeWindow': _active_window(),
            'applications': _visible_applications(),
            'disk': _disk_snapshot(),
            'downloads': _download_snapshot(),
            'userIdleSeconds': _idle_seconds() }

    
    def _active_window():
        fallback = {
            'title': None,
            'application': None,
            'pid': None }
        if platform.system() != 'Windows':
            return fallback
    # WARNING: Decompyle incomplete

    
    def _visible_applications():
        pass
    # WARNING: Decompyle incomplete

    
    def _disk_snapshot():
        pass
    # WARNING: Decompyle incomplete

    
    def _download_snapshot():
        downloads = Path.home() / 'Downloads'
        if not downloads.is_dir():
            return []
        cutoff = None.time() - 172800
        entries = []
    # WARNING: Decompyle incomplete

    
    def _idle_seconds():
        if platform.system() != 'Windows':
            return 0
        
        try:
            
            class LASTINPUTINFO(ctypes.Structure):
                _fields_ = [
                    ('cbSize', ctypes.c_uint),
                    ('dwTime', ctypes.c_uint)]

            info = LASTINPUTINFO()
            info.cbSize = ctypes.sizeof(info)
            if not ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info)):
                return 0
                
                try:
                    tick = ctypes.windll.kernel32.GetTickCount()
                    return max(0, (tick - info.dwTime) / 1000)
                except Exception:
                    return 0



    __all__ = [
        'collect_snapshot']
    return None
except ImportError:
    psutil = None
    continue

