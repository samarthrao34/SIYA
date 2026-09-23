# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/registry.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 4 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: registry.pyc (Python 3.12)

'''
SIYA Desktop Control Agent — Central tool registry.

Each tool module registers handlers into a flat dict `TOOLS` mapping
tool_name -> callable(args: dict) -> dict.

Handlers return a plain dict, typically {"result": "<status string>"}.
Errors should raise ToolError(message) so main.py can map them to {error}.
Shared state such as confirmation tokens lives on the `State` object so
handlers stay stateless and easy to test.
'''
from __future__ import annotations
import importlib
import threading
from typing import Any, Callable, Dict

class ToolError(Exception):
    pass
# WARNING: Decompyle incomplete


class State:
    '''Process-wide shared state for tool handlers.'''
    
    def __init__(self = None):
        self.lock = threading.Lock()
        self.confirmations = { }


STATE = State()
TOOLS: 'Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]]' = { }

def register(name = None):
    '''Decorator to register a handler under a tool name.'''
    pass
# WARNING: Decompyle incomplete

DESKTOP_TOOL_NAMES = [
    'openApplication',
    'closeApplication',
    'openWebsite',
    'searchWeb',
    'searchYouTube',
    'searchGoogle',
    'searchGitHub',
    'createFile',
    'readFile',
    'renameFile',
    'deleteFile',
    'moveFile',
    'openFolder',
    'listFiles',
    'searchFiles',
    'volumeUp',
    'volumeDown',
    'muteToggle',
    'setVolume',
    'requestPowerAction',
    'executePowerAction',
    'minimizeWindow',
    'maximizeWindow',
    'closeWindow',
    'switchApplication',
    'locateText',
    'clickText',
    'moveMouse',
    'click',
    'doubleClick',
    'rightClick',
    'drag',
    'scroll',
    'typeText',
    'pressKey',
    'hotkey',
    'getCursorPosition',
    'getActiveWindow',
    'listVisibleWindows',
    'waitForUi',
    'observeDesktopState',
    'copySelected',
    'pasteClipboard',
    'getClipboard',
    'clearClipboard',
    'takeScreenshot',
    'saveScreenshot',
    'analyzeScreenshot',
    'readScreen',
    'viewScreen',
    'createPythonFile',
    'runPythonScript',
    'createProjectFolder',
    'writeCodeFile',
    'systemInfo',
    'gpuInfo',
    'temperatureInfo',
    'brightnessUp',
    'brightnessDown',
    'setBrightness',
    'enableAutoStart',
    'disableAutoStart',
    'getAutoStartStatus']
_MODULE_NAMES = [
    'tools_confirmation',
    'tools_applications',
    'tools_websites',
    'tools_search',
    'tools_files',
    'tools_pc',
    'tools_windows',
    'tools_targeting',
    'tools_input',
    'tools_clipboard',
    'tools_screenshot',
    'tools_coding',
    'tools_system',
    'tools_startup']

def load_all():
    for mod_name in _MODULE_NAMES:
        importlib.import_module(f'''.{mod_name}''', package = 'desktop_agent')

__all__ = [
    'TOOLS',
    'STATE',
    'DESKTOP_TOOL_NAMES',
    'ToolError',
    'register',
    'load_all']
