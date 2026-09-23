# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_applications.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 2 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_applications.pyc (Python 3.12)

__doc__ = 'Universal Windows application discovery, launch, and graceful close.\n\nKnown apps still take the fast path. Unknown names are resolved from PATH,\nApp Paths, installed-program registry entries, Start-menu shortcuts, and UWP\nStart apps. As a final human-style fallback SIYA uses Windows Search. Closing\ntargets real visible windows/processes instead of rejecting names that are not\nin a hard-coded allow-list.\n'
from __future__ import annotations
import os
import platform
import re
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Optional
from registry import ToolError, register
# WARNING: Decompyle incomplete
