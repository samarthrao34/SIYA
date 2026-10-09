"""
SIYA Desktop Control Agent -- central tool registry.

Each tool module registers handlers into a flat dict `TOOLS` mapping
tool_name -> callable(args: dict) -> dict.

Handlers return a plain dict, typically {"result": "<status string>"}.
Errors should raise ToolError(message) so main.py can map them to {error}.
Shared state such as confirmation tokens lives on the `STATE` object so
handlers stay stateless and easy to test.
"""
from __future__ import annotations

import importlib
import threading
from typing import Any, Callable, Dict


class ToolError(Exception):
    """Raised by a tool handler for an expected, user-facing failure."""


class State:
    """Process-wide shared state for tool handlers."""

    def __init__(self):
        self.lock = threading.Lock()
        self.confirmations: Dict[str, dict] = {}


STATE = State()
TOOLS: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}


def register(name: str):
    """Decorator to register a handler under a tool name."""

    def decorator(fn: Callable[[Dict[str, Any]], Dict[str, Any]]):
        TOOLS[name] = fn
        return fn

    return decorator


# Authoritative list -- must match server/index.ts's DESKTOP_TOOLS set exactly.
DESKTOP_TOOL_NAMES = [
    "openApplication", "closeApplication", "openWebsite",
    "searchWeb", "searchYouTube", "searchGoogle", "searchGitHub",
    "createFile", "readFile", "renameFile", "deleteFile", "moveFile",
    "openFolder", "listFiles", "searchFiles",
    "volumeUp", "volumeDown", "muteToggle", "setVolume",
    "requestPowerAction", "executePowerAction",
    "minimizeWindow", "maximizeWindow", "closeWindow", "switchApplication",
    "locateText", "clickText",
    "moveMouse", "click", "doubleClick", "rightClick", "drag", "scroll",
    "typeText", "pressKey", "hotkey", "getCursorPosition", "getActiveWindow",
    "listVisibleWindows", "waitForUi", "observeDesktopState",
    "copySelected", "pasteClipboard", "getClipboard", "clearClipboard",
    "takeScreenshot", "saveScreenshot", "analyzeScreenshot", "readScreen", "viewScreen",
    "createPythonFile", "runPythonScript", "createProjectFolder", "writeCodeFile",
    "systemInfo", "gpuInfo", "temperatureInfo",
    "brightnessUp", "brightnessDown", "setBrightness",
    "enableAutoStart", "disableAutoStart", "getAutoStartStatus",
    "getHeartRate", "getBloodOxygen",
]

_MODULE_NAMES = [
    "tools_confirmation",
    "tools_applications",
    "tools_websites",
    "tools_search",
    "tools_files",
    "tools_pc",
    "tools_windows",
    "tools_targeting",
    "tools_input",
    "tools_clipboard",
    "tools_screenshot",
    "tools_coding",
    "tools_system",
    "tools_startup",
    "tools_health",
]


def load_all():
    for mod_name in _MODULE_NAMES:
        importlib.import_module(f".{mod_name}", package="desktop_agent")


__all__ = ["TOOLS", "STATE", "DESKTOP_TOOL_NAMES", "ToolError", "register", "load_all"]
