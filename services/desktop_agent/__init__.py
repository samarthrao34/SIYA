"""SIYA Desktop Control Agent (Linux/Hyprland/Omarchy port).

A local FastAPI service exposing JARVIS-style desktop automation tools that
SIYA's Node bridge (server/index.ts) calls over HTTP. This module package only
hosts tool code; run with:

    uvicorn desktop_agent.main:app --app-dir services --host 127.0.0.1 --port 8765

Ported from the original Windows agent to Linux, targeting Hyprland (as used by the Omarchy distro).
Same tool surface, same two-step confirmation flow for dangerous power
actions -- this is a platform port, not an expanded permission set.
"""
__version__ = "1.0.0-linux"
