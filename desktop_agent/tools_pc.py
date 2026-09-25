"""
PC control: system volume, brightness, and (gated) power actions.

Volume:  wpctl (PipeWire/WirePlumber), standard on Arch/Omarchy.
Brightness: brightnessctl.
Power: shutdown / restart / sleep / lock are DANGEROUS and require the
  two-step confirmation flow (tools_confirmation). executePowerAction
  consumes the token before running anything destructive.
"""
from __future__ import annotations

import re
import subprocess
from typing import Any, Dict

from .registry import ToolError, register
from ._linux import have, run
from .tools_confirmation import DANGEROUS_ACTIONS, ACTION_LABEL, consume_token

SINK = "@DEFAULT_AUDIO_SINK@"


def _require_wpctl():
    if not have("wpctl"):
        raise ToolError("wpctl (PipeWire/WirePlumber) is not installed; volume control is unavailable.")


def _current_volume_percent() -> float:
    _require_wpctl()
    out = run(["wpctl", "get-volume", SINK])
    if out.returncode != 0:
        raise ToolError(f"Could not read volume: {out.stderr.strip()}")
    m = re.search(r"([\d.]+)", out.stdout)
    if not m:
        raise ToolError("Could not parse volume output.")
    return round(float(m.group(1)) * 100, 1)


def _set_volume_percent(pct: float):
    _require_wpctl()
    pct = max(0.0, min(100.0, pct))
    out = run(["wpctl", "set-volume", SINK, f"{pct / 100:.4f}"])
    if out.returncode != 0:
        raise ToolError(f"Could not set volume: {out.stderr.strip()}")


@register("volumeUp")
def volume_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 0.1)) * 100
    new = min(100, _current_volume_percent() + step)
    _set_volume_percent(new)
    return {"result": f"Volume increased to {int(new)}%.", "volume_percent": new}


@register("volumeDown")
def volume_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 0.1)) * 100
    new = max(0, _current_volume_percent() - step)
    _set_volume_percent(new)
    return {"result": f"Volume decreased to {int(new)}%.", "volume_percent": new}


@register("setVolume")
def set_volume(args: Dict[str, Any]) -> Dict[str, Any]:
    if "percent" in args:
        pct = float(args["percent"])
    elif "level" in args:
        pct = float(args["level"])
    else:
        raise ToolError("Parameter 'percent' (0-100) is required.")
    pct = max(0.0, min(100.0, pct))
    _set_volume_percent(pct)
    return {"result": f"Volume set to {int(pct)}%.", "volume_percent": pct}


@register("muteToggle")
def mute_toggle(args: Dict[str, Any]) -> Dict[str, Any]:
    _require_wpctl()
    out = run(["wpctl", "set-mute", SINK, "toggle"])
    if out.returncode != 0:
        raise ToolError(f"Could not toggle mute: {out.stderr.strip()}")
    state_out = run(["wpctl", "get-volume", SINK])
    muted = "[MUTED]" in state_out.stdout
    return {"result": "Muted." if muted else "Unmuted.", "muted": muted}


def _run_power(action: str) -> str:
    """Execute the actual OS power command. Caller must have confirmed first."""
    if action == "lock":
        if have("hyprlock"):
            subprocess.Popen(["hyprlock"], close_fds=True)
        elif have("loginctl"):
            run(["loginctl", "lock-session"])
        else:
            raise ToolError("No lock mechanism found (hyprlock or loginctl).")
        return "Computer locked."
    if action == "sleep":
        run(["systemctl", "suspend"])
        return "Computer going to sleep."
    if action == "restart":
        run(["systemctl", "reboot"])
        return "Computer restarting."
    if action == "shutdown":
        run(["systemctl", "poweroff"])
        return "Computer shutting down."
    raise ToolError(f"Unknown power action '{action}'.")


@register("executePowerAction")
def execute_power_action(args: Dict[str, Any]) -> Dict[str, Any]:
    action = str(args.get("action") or "").strip().lower()
    token = args.get("execute_token")
    if action not in DANGEROUS_ACTIONS:
        raise ToolError(f"Unknown power action '{action}'. Valid: {', '.join(sorted(DANGEROUS_ACTIONS))}.")
    consume_token(action, token)
    msg = _run_power(action)
    return {"result": msg, "action": action}


def _require_brightnessctl():
    if not have("brightnessctl"):
        raise ToolError("brightnessctl is not installed; brightness control is unavailable.")


def _current_brightness_percent() -> float:
    _require_brightnessctl()
    out = run(["brightnessctl", "-m", "info"])
    if out.returncode != 0:
        raise ToolError(f"Could not read brightness: {out.stderr.strip()}")
    # machine-readable: device,class,current,percent,max
    parts = out.stdout.strip().split(",")
    if len(parts) < 4:
        raise ToolError("Could not parse brightness output.")
    return float(parts[3].rstrip("%"))


def _set_brightness_percent(pct: float) -> float:
    _require_brightnessctl()
    pct = max(1.0, min(100.0, pct))  # avoid 0% blanking the screen entirely
    out = run(["brightnessctl", "set", f"{int(pct)}%"])
    if out.returncode != 0:
        raise ToolError(f"Could not set brightness: {out.stderr.strip()}")
    return pct


@register("brightnessUp")
def brightness_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 10))
    new = _set_brightness_percent(_current_brightness_percent() + step)
    return {"result": f"Brightness increased to {int(new)}%.", "brightness": new}


@register("brightnessDown")
def brightness_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 10))
    new = _set_brightness_percent(_current_brightness_percent() - step)
    return {"result": f"Brightness decreased to {int(new)}%.", "brightness": new}


@register("setBrightness")
def set_brightness(args: Dict[str, Any]) -> Dict[str, Any]:
    if "percent" in args:
        pct = float(args["percent"])
    elif "level" in args:
        pct = float(args["level"])
    else:
        raise ToolError("Parameter 'percent' (0-100) is required.")
    new = _set_brightness_percent(pct)
    return {"result": f"Brightness set to {int(new)}%.", "brightness": new}


__all__ = [
    "volume_up", "volume_down", "set_volume", "mute_toggle", "execute_power_action",
    "ACTION_LABEL", "brightness_up", "brightness_down", "set_brightness",
]
