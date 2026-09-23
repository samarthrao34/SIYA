# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_websites.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 2 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_websites.pyc (Python 3.12)

__doc__ = "\nWebsite control: open named sites or arbitrary URLs in the default browser.\n\nUses the OS default-browser handler so the user's real Chrome/Edge/Firefox\nopens at the requested destination.\n"
from __future__ import annotations
import webbrowser
import platform
import time
from typing import Any, Dict
from urllib.parse import quote
from registry import ToolError, register
# WARNING: Decompyle incomplete
