# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_confirmation.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 4 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_confirmation.pyc (Python 3.12)

'''
Two-step confirmation flow for dangerous power actions.

Step 1: requestPowerAction(action) -> mints a single-use, short-lived token
        and tells SIYA (via the result string) to ask the user to confirm.
Step 2: executePowerAction(action, execute_token) -> validates the token and,
        only if it matches & is unexpired, performs the gated action.

A token is bound to a single action name and can be consumed exactly once.
'''
from __future__ import annotations
import secrets
import time
from typing import Any, Dict
from registry import STATE, ToolError, register
DANGEROUS_ACTIONS = {
    'lock',
    'sleep',
    'restart',
    'shutdown'}
ACTION_LABEL = {
    'shutdown': 'shut down the computer',
    'restart': 'restart the computer',
    'sleep': 'put the computer to sleep',
    'lock': 'lock the computer' }
TOKEN_TTL_SECONDS = 60

def _purge_expired():
    now = time.time()
# WARNING: Decompyle incomplete

request_power_action = (lambda args = None: if not args.get('action'):
args.get('action')action = ''.strip().lower()if action not in DANGEROUS_ACTIONS:
raise ToolError(f'''Unknown power action \'{action}\'. Valid actions: {', '.join(sorted(DANGEROUS_ACTIONS))}.''')_purge_expired()token = secrets.token_urlsafe(6)STATE.confirmations[token] = {
'action': action,
'expires': time.time() + TOKEN_TTL_SECONDS }label = ACTION_LABEL[action]{
'requires_confirmation': True,
'token': token,
'expires_in_seconds': int(TOKEN_TTL_SECONDS),
'result': f'''Dangerous action requested: {label}. A confirmation is required. Ask the user out loud to confirm they want to {label}, then call executePowerAction with action=\'{action}\' and execute_token=\'{token}\'. Token expires in {int(TOKEN_TTL_SECONDS)} seconds.''' })()

def consume_token(action = None, token = None):
    '''Validate & consume a confirmation token for the given action.

    Raises ToolError if missing/expired/mismatched. Called by tools_pc.
    '''
    _purge_expired()
    if not token:
        raise ToolError(f'''No confirmation token supplied for {ACTION_LABEL.get(action, action)}. Call requestPowerAction first and ask the user to confirm.''')
    entry = STATE.confirmations.get(token)
# WARNING: Decompyle incomplete

__all__ = [
    'DANGEROUS_ACTIONS',
    'ACTION_LABEL',
    'request_power_action',
    'consume_token']
