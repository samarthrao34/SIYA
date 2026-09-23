# Recovered via pycdc decompilation of run_agent.pyc (Python 3.12 bytecode). Status: CLEAN decompile — no unsupported-opcode markers.

# Source Generated with Decompyle++
# File: run_agent.pyc (Python 3.12)

'''
SIYA Desktop Control Agent — frozen entrypoint.

This is the script PyInstaller freezes into `siya-agent.exe`. It runs the
FastAPI agent with uvicorn using the app *object* (not an import string), which
is the reliable way to launch inside a PyInstaller bundle. Logs are written to
the per-user data directory so failures are never silent, even with no console.

Run (frozen):   siya-agent.exe
Run (dev):      python run_agent.py
Environment:
    SIYA_AGENT_HOST   default 127.0.0.1
    SIYA_AGENT_PORT   default 8765
    SIYA_DATA_DIR     where logs/ is written (default: cwd)
'''
from __future__ import annotations
import logging
import os
import sys
from pathlib import Path

def _resolve_data_dir():
    if not os.environ.get('SIYA_DATA_DIR'):
        os.environ.get('SIYA_DATA_DIR')
    data = os.getcwd()
    logs = Path(data) / 'logs'
    
    try:
        logs.mkdir(parents = True, exist_ok = True)
        return Path(data)
    except Exception:
        return Path(data)



def _configure_logging(data_dir = None):
    handlers = []
    
    try:
        handlers.append(logging.FileHandler(data_dir / 'logs' / 'agent.log', encoding = 'utf-8'))
        handlers.append(logging.StreamHandler(sys.stdout))
        logging.basicConfig(level = logging.INFO, format = '[%(asctime)s] [%(levelname)s] %(name)s: %(message)s', datefmt = '%Y-%m-%d %H:%M:%S', handlers = handlers, force = True)
        return None
    except Exception:
        continue



def main():
    data_dir = _resolve_data_dir()
    _configure_logging(data_dir)
    log = logging.getLogger('siya.agent.boot')
    host = os.environ.get('SIYA_AGENT_HOST', '127.0.0.1')
    port = int(os.environ.get('SIYA_AGENT_PORT', '8765'))
    frozen = getattr(sys, 'frozen', False)
    log.info('Starting SIYA agent (frozen=%s) on %s:%d', frozen, host, port)
    
    try:
        app = app
        import desktop_agent.main
        import uvicorn
        
        try:
            uvicorn.run(app, host = host, port = port, log_level = 'info', log_config = None, access_log = False)
            return None
            except Exception:
                log.exception('Fatal: could not import agent application.')
                raise 
        except Exception:
            log.exception('Fatal: uvicorn exited with an error.')
            raise 



if __name__ == '__main__':
    main()
    return None
