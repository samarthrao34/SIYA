# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_startup.pyc (Python 3.12 bytecode).
# Status: CLEAN decompile (pycdc) — no unsupported-opcode markers, likely accurate

# Source Generated with Decompyle++
# File: tools_startup.pyc (Python 3.12)

'''
Windows auto-start management for SIYA (V2).

Manages a single registry entry under
    HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Siya
which points directly at the packaged SIYA executable. Source-development
builds fall back to start-siya-silent.bat. HKCU is used (no admin rights
required) and the change is per-user.

Tools:
  - enableAutoStart   : write the Run key + ensure the .bat exists
  - disableAutoStart  : remove the Run key
  - getAutoStartStatus: report whether the entry exists + its target

Gracefully degrades on non-Windows platforms (returns a clear message instead
of raising).
'''
from __future__ import annotations
import os
import sys
from typing import Any, Dict
from registry import ToolError, register
RUN_KEY_PATH = 'Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run'
VALUE_NAME = 'Siya'
SILENT_LAUNCHER = 'start-siya-silent.bat'

def _project_root():
    '''Return the project root (parent of the desktop_agent package).'''
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _launcher_path():
    return os.path.join(_project_root(), SILENT_LAUNCHER)


def _ensure_launcher_exists():
