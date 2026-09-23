# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_coding.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 2 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_coding.pyc (Python 3.12)

__doc__ = '\nCoding assistance: create code files, run Python scripts, scaffold projects.\n\n  createPythonFile   -> write a .py file (uses createFile semantics w/ safety)\n  writeCodeFile      -> write an arbitrary-language file with proper extension\n  createProjectFolder-> make a folder structure (with optional subfolders)\n  runPythonScript    -> execute a .py file with the known-good interpreter,\n                        capturing stdout/stderr and exit code.\n\nThe Python interpreter used for running scripts is auto-detected so it works\neven when the bare `python` shim is broken (common on this machine).\n'
from __future__ import annotations
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from registry import ToolError, register
from tools_files import _ensure_safe
# WARNING: Decompyle incomplete
