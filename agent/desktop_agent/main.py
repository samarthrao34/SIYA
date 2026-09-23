# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/main.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 2 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: main.pyc (Python 3.12)

"""
SIYA Desktop Control Agent — FastAPI entrypoint.

Single dispatch endpoint POST /execute { tool, args } -> { result } | { error }.
SIYA's Node bridge (server.ts) calls this over HTTP on 127.0.0.1:8765.

Run:
    uvicorn desktop_agent.main:app --host 127.0.0.1 --port 8765
or:
    python -m desktop_agent.main
"""
from __future__ import annotations
import logging
import os
import sys
import traceback
from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from  import __version__
from registry import DESKTOP_TOOL_NAMES, TOOLS, ToolError, load_all
from perception import collect_snapshot
logging.basicConfig(level = logging.INFO, format = '[%(asctime)s] [%(levelname)s] %(message)s', datefmt = '%H:%M:%S')
log = logging.getLogger('siya.desktop')
load_all()
log.info('Loaded %d desktop tools: %s', len(TOOLS), ', '.join(sorted(TOOLS)))
lifespan = (lambda app = None: pass# WARNING: Decompyle incomplete
)()
app = FastAPI(title = 'SIYA Desktop Control Agent', version = __version__, description = 'JARVIS-style desktop automation backend for SIYA.', lifespan = lifespan)
app.add_middleware(CORSMiddleware, allow_origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000'], allow_credentials = False, allow_methods = [
    '*'], allow_headers = [
    '*'])

class ExecuteRequest(BaseModel):
    tool: 'str' = 'ExecuteRequest'
    args: 'Dict[str, Any]' = { }


class ExecuteResponse(BaseModel):
    ok: 'bool' = 'ExecuteResponse'
    result: 'Any' = None
    tool: 'str' = None

health = (lambda : {
'status': 'ok',
'name': 'SIYA Desktop Control Agent',
'version': __version__,
'tools': sorted(TOOLS.keys()),
'tool_count': len(TOOLS) })()
list_tools = (lambda : {
'tools': sorted(TOOLS.keys()),
'count': len(TOOLS) })()
observe = (lambda : collect_snapshot())()
execute = (lambda req = None: tool = req.toolif not req.args:
req.argsargs = { }log.info('EXEC tool=%s args=%s', tool, _short_args(args))if tool not in TOOLS:
known = ', '.join(sorted(TOOLS.keys()))ExecuteResponse(ok = False, error = f'''Unknown tool \'{tool}\'. Known tools: {known}''', tool = tool)handler = None[tool]try:
out = handler(args)result_text = ''if isinstance(out, dict):
result_text = str(out.get('result', out))else:
result_text = str(out)log.info('DONE tool=%s -> %s', tool, result_text[:160])ExecuteResponse(ok = True, result = out, tool = tool)except ToolError:
e = Nonelog.warning('ToolError in %s: %s', tool, e.message)del eNoneNone = del eexcept Exception:
e = Nonelog.error('Unhandled error in %s: %s\n%s', tool, e, traceback.format_exc())del eNoneNone = del e)()

def _short_args(args = None):
    '''Log argument names only; values may contain personal or secret data.'''
    return '{keys=[' + ', '.join(sorted(args.keys())) + ']}'


def main():
    '''Allow `python -m desktop_agent.main` to launch uvicorn.'''
    import uvicorn
    host = os.environ.get('SIYA_AGENT_HOST', '127.0.0.1')
    port = int(os.environ.get('SIYA_AGENT_PORT', '8765'))
    log.info('Launching uvicorn on %s:%d', host, port)
    uvicorn.run('desktop_agent.main:app', host = host, port = port, reload = False, log_level = 'info')

if __name__ == '__main__':
    main()
    return None
