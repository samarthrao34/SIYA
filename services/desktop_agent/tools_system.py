"""
System information: CPU, RAM, disk usage, GPU (best-effort), temperature.

All read-only. psutil powers the core metrics. GPU stats come from
`nvidia-smi` when an NVIDIA GPU is present (this machine has hybrid
Intel+NVIDIA graphics), falling back to `lspci` for vendor/model detection
otherwise. Temperature is best-effort via psutil.sensors_temperatures.
"""
from __future__ import annotations

import platform
import re
import subprocess
from typing import Any, Dict, List

import psutil

from .registry import register
from ._linux import have


def _bytes_human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}EB"


@register("systemInfo")
def system_info(args: Dict[str, Any]) -> Dict[str, Any]:
    cpu_percent = psutil.cpu_percent(interval=0.3)
    cpu_count_logical = psutil.cpu_count(logical=True) or 0
    cpu_count_physical = psutil.cpu_count(logical=False) or cpu_count_logical
    vm = psutil.virtual_memory()
    disks: Dict[str, Any] = {}
    seen = set()
    for part in psutil.disk_partitions(all=False):
        mp = part.mountpoint
        if mp in seen:
            continue
        seen.add(mp)
        try:
            du = psutil.disk_usage(mp)
        except (PermissionError, OSError):
            continue
        disks[mp] = {
            "total": _bytes_human(du.total),
            "used": _bytes_human(du.used),
            "free": _bytes_human(du.free),
            "percent": du.percent,
        }
    boot = psutil.boot_time()
    import datetime as _dt
    uptime = _dt.datetime.now() - _dt.datetime.fromtimestamp(boot)
    return {
        "result": (
            f"CPU {cpu_percent}% ({cpu_count_physical} cores / {cpu_count_logical} threads). "
            f"RAM {vm.percent}% ({_bytes_human(vm.used)}/{_bytes_human(vm.total)}). "
            f"{len(disks)} disk(s) monitored. Uptime {uptime}."
        ),
        "cpu": {"percent": cpu_percent, "physical_cores": cpu_count_physical, "logical_cores": cpu_count_logical},
        "ram": {"percent": vm.percent, "used": _bytes_human(vm.used), "total": _bytes_human(vm.total)},
        "disks": disks,
        "uptime_seconds": int(uptime.total_seconds()),
        "os": platform.platform(),
    }


def _nvidia_gpu_stats() -> List[Dict[str, Any]]:
    if not have("nvidia-smi"):
        return []
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=index,name,utilization.gpu,utilization.memory,memory.total,memory.used,memory.free,temperature.gpu",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5,
        )
        if out.returncode != 0:
            return []
        gpus = []
        for line in out.stdout.strip().splitlines():
            parts = [p.strip() for p in line.split(",")]
            if len(parts) != 8:
                continue
            idx, name, gpu_util, mem_util, mem_total, mem_used, mem_free, temp = parts
            gpus.append({
                "index": int(idx),
                "name": name,
                "gpu_utilization_percent": float(gpu_util),
                "memory_utilization_percent": float(mem_util),
                "memory_total": _bytes_human(float(mem_total) * 1024 * 1024),
                "memory_used": _bytes_human(float(mem_used) * 1024 * 1024),
                "memory_free": _bytes_human(float(mem_free) * 1024 * 1024),
                "temperature_c": float(temp),
            })
        return gpus
    except Exception:
        return []


def _lspci_gpu_names() -> List[str]:
    if not have("lspci"):
        return []
    try:
        out = subprocess.run(["lspci"], capture_output=True, text=True, timeout=5)
        names = []
        for line in out.stdout.splitlines():
            if re.search(r"VGA compatible controller|3D controller", line):
                names.append(line.split(": ", 1)[-1].strip())
        return names
    except Exception:
        return []


@register("gpuInfo")
def gpu_info(args: Dict[str, Any]) -> Dict[str, Any]:
    gpus = _nvidia_gpu_stats()
    if gpus:
        summary = "; ".join(f"{g['name']}: {g['gpu_utilization_percent']}% util, {g['temperature_c']}°C" for g in gpus)
        return {"result": summary, "gpus": gpus}
    names = _lspci_gpu_names()
    if names:
        return {"result": f"Detected GPU(s): {', '.join(names)} (live utilization unavailable without nvidia-smi).", "gpus": [{"name": n} for n in names]}
    return {"result": "No GPU information available.", "gpus": []}


@register("temperatureInfo")
def temperature_info(args: Dict[str, Any]) -> Dict[str, Any]:
    temps: Dict[str, float] = {}
    for g in _nvidia_gpu_stats():
        temps[f"gpu{g['index']}"] = g["temperature_c"]
    if hasattr(psutil, "sensors_temperatures"):
        try:
            sensors = psutil.sensors_temperatures() or {}
            for name, entries in sensors.items():
                for entry in entries[:1]:
                    temps[name] = entry.current
        except Exception:
            pass
    if not temps:
        return {"result": "Temperature reading unavailable on this system.", "temperatures": {}}
    summary = ", ".join(f"{k}: {v}°C" for k, v in temps.items())
    return {"result": f"Temperatures: {summary}.", "temperatures": temps}


__all__ = ["system_info", "gpu_info", "temperature_info"]
