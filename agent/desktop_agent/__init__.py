# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/__init__.pyc (Python 3.12 bytecode).
# Status: CLEAN decompile (pycdc) — no unsupported-opcode markers, likely accurate

# Source Generated with Decompyle++
# File: __init__.pyc (Python 3.12)

"""SIYA Desktop Control Agent.

A local FastAPI service exposing JARVIS-style desktop automation tools that
SIYA's Node bridge (server.ts) calls over HTTP. This module package only
hosts tool code; run with:

    uvicorn desktop_agent.main:app --host 127.0.0.1 --port 8765
"""
__version__ = '1.0.0'
