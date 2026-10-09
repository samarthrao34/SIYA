"""
Two-step confirmation flow for dangerous power actions.

Step 1: requestPowerAction(action) -> mints a single-use, short-lived token
        and tells SIYA (via the result string) to ask the user to confirm.
Step 2: executePowerAction(action, execute_token) -> validates the token and,
        only if it matches & is unexpired, performs the gated action.

A token is bound to a single action name and can be consumed exactly once.
This is a safety rail from the original design -- kept intact deliberately,
not bypassed, per explicit user choice to match (not exceed) the prior
Windows agent's permission model.
"""
from __future__ import annotations

import secrets
import time
from typing import Any, Dict

from .registry import STATE, ToolError, register

DANGEROUS_ACTIONS = {"lock", "sleep", "restart", "shutdown"}
ACTION_LABEL = {
    "shutdown": "shut down the computer",
    "restart": "restart the computer",
    "sleep": "put the computer to sleep",
    "lock": "lock the computer",
}
TOKEN_TTL_SECONDS = 60


def _purge_expired():
    now = time.time()
    with STATE.lock:
        expired = [tok for tok, entry in STATE.confirmations.items() if entry["expires"] < now]
        for tok in expired:
            del STATE.confirmations[tok]


@register("requestPowerAction")
def request_power_action(args: Dict[str, Any]) -> Dict[str, Any]:
    action = str(args.get("action") or "").strip().lower()
    if action not in DANGEROUS_ACTIONS:
        raise ToolError(f"Unknown power action '{action}'. Valid actions: {', '.join(sorted(DANGEROUS_ACTIONS))}.")
    _purge_expired()
    token = secrets.token_urlsafe(6)
    with STATE.lock:
        STATE.confirmations[token] = {"action": action, "expires": time.time() + TOKEN_TTL_SECONDS}
    label = ACTION_LABEL[action]
    return {
        "requires_confirmation": True,
        "token": token,
        "expires_in_seconds": int(TOKEN_TTL_SECONDS),
        "result": (
            f"Dangerous action requested: {label}. A confirmation is required. Ask the user out "
            f"loud to confirm they want to {label}, then call executePowerAction with "
            f"action='{action}' and execute_token='{token}'. Token expires in {int(TOKEN_TTL_SECONDS)} seconds."
        ),
    }


def consume_token(action: str, token: str) -> None:
    """Validate & consume a confirmation token for the given action.

    Raises ToolError if missing/expired/mismatched. Called by tools_pc.
    """
    _purge_expired()
    if not token:
        raise ToolError(f"No confirmation token supplied for {ACTION_LABEL.get(action, action)}. Call requestPowerAction first and ask the user to confirm.")
    with STATE.lock:
        entry = STATE.confirmations.get(token)
        if not entry:
            raise ToolError("That confirmation token is invalid or has expired. Call requestPowerAction again.")
        if entry["action"] != action:
            raise ToolError(f"Confirmation token was issued for '{entry['action']}', not '{action}'.")
        del STATE.confirmations[token]  # single-use


__all__ = ["DANGEROUS_ACTIONS", "ACTION_LABEL", "request_power_action", "consume_token"]
