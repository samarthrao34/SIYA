"""
SIYA Desktop Control Agent -- FastAPI entrypoint.

Single dispatch endpoint POST /execute { tool, args } -> { result } | { error }.
SIYA's Node bridge (server/index.ts) calls this over HTTP on 127.0.0.1:8765.

Run:
    uvicorn desktop_agent.main:app --app-dir services --host 127.0.0.1 --port 8765
or:
    cd services && python -m desktop_agent.main
"""
from __future__ import annotations

import logging
import os
import traceback
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import __version__
from .registry import DESKTOP_TOOL_NAMES, TOOLS, ToolError, load_all
from .perception import collect_snapshot

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("siya.desktop")

load_all()
log.info("Loaded %d desktop tools: %s", len(TOOLS), ", ".join(sorted(TOOLS)))
_missing = sorted(set(DESKTOP_TOOL_NAMES) - set(TOOLS))
if _missing:
    log.warning("Tools expected by server/index.ts but not registered: %s", ", ".join(_missing))

app = FastAPI(
    title="SIYA Desktop Control Agent",
    version=__version__,
    description="JARVIS-style desktop automation backend for SIYA (Linux/Hyprland port).",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecuteRequest(BaseModel):
    tool: str
    args: Dict[str, Any] = {}


class ExecuteResponse(BaseModel):
    ok: bool
    result: Any = None
    error: str | None = None
    tool: str | None = None


def _short_args(args: Dict[str, Any]) -> str:
    """Log argument names only; values may contain personal or secret data."""
    return "{keys=[" + ", ".join(sorted(args.keys())) + "]}"


@app.get("/health")
def health():
    return {
        "status": "ok",
        "name": "SIYA Desktop Control Agent",
        "version": __version__,
        "tools": sorted(TOOLS.keys()),
        "tool_count": len(TOOLS),
    }


@app.get("/tools")
def list_tools():
    return {"tools": sorted(TOOLS.keys()), "count": len(TOOLS)}


@app.get("/observe")
def observe():
    return collect_snapshot()


@app.post("/execute", response_model=ExecuteResponse)
def execute(req: ExecuteRequest):
    tool = req.tool
    args = req.args or {}
    log.info("EXEC tool=%s args=%s", tool, _short_args(args))
    if tool not in TOOLS:
        known = ", ".join(sorted(TOOLS.keys()))
        return ExecuteResponse(ok=False, error=f"Unknown tool '{tool}'. Known tools: {known}", tool=tool)
    handler = TOOLS[tool]
    try:
        out = handler(args)
        result_text = str(out.get("result", out)) if isinstance(out, dict) else str(out)
        log.info("DONE tool=%s -> %s", tool, result_text[:160])
        return ExecuteResponse(ok=True, result=out, tool=tool)
    except ToolError as e:
        log.warning("ToolError in %s: %s", tool, e)
        return ExecuteResponse(ok=False, error=str(e), tool=tool)
    except Exception as e:  # noqa: BLE001 -- must never 500, always report gracefully
        log.error("Unhandled error in %s: %s\n%s", tool, e, traceback.format_exc())
        return ExecuteResponse(ok=False, error=f"Internal error: {e}", tool=tool)


def main():
    """Allow `python -m desktop_agent.main` to launch uvicorn."""
    import uvicorn

    host = os.environ.get("SIYA_AGENT_HOST", "127.0.0.1")
    port = int(os.environ.get("SIYA_AGENT_PORT", "8765"))
    log.info("Launching uvicorn on %s:%d", host, port)
    uvicorn.run("desktop_agent.main:app", host=host, port=port, reload=False, log_level="info")


if __name__ == "__main__":
    main()
