# Recovered via pycdc (zrax/pycdc) decompilation of desktop_agent/tools_system.pyc (Python 3.12 bytecode).
# Status: MOSTLY CLEAN decompile (pycdc) — 4 unsupported-opcode gap(s), rest is real recovered code

# Source Generated with Decompyle++
# File: tools_system.pyc (Python 3.12)

'''
System information: CPU, RAM, disk usage, GPU (best-effort), temperature.

All read-only. psutil powers the core metrics; GPU stats come from
nvidia-ml-py3 (pynvml) when an NVIDIA GPU is present, and degrade gracefully
otherwise. Temperature is best-effort via psutil.sensors_temperatures (Linux)
or WMI on Windows when available.
'''
from __future__ import annotations
import platform
from typing import Any, Dict
from registry import register

def _bytes_human(n = None):
    for unit in ('B', 'KB', 'MB', 'GB', 'TB', 'PB'):
        if n < 1024:
            
            return ('B', 'KB', 'MB', 'GB', 'TB', 'PB'), f'''{n:.1f}{unit}'''
    return f'''{n:.1f}EB'''

system_info = (lambda args = None: import psutilcpu_percent = psutil.cpu_percent(interval = 0.3)cpu_count_logical = psutil.cpu_count(logical = True)if not psutil.cpu_count(logical = False):
psutil.cpu_count(logical = False)cpu_count_physical = cpu_count_logicalvm = psutil.virtual_memory()ram_total = vm.totalram_used = vm.usedram_percent = vm.percentdisks = { }seen = set()try:
for part in psutil.disk_partitions(all = False):
mp = part.mountpointif mp in seen:
continueseen.add(mp)du = psutil.disk_usage(mp)disks[mp] = {
'total': _bytes_human(du.total),
'used': _bytes_human(du.used),
'free': _bytes_human(du.free),
'percent': du.percent }try:
continueboot = psutil.boot_time()import datetime as _dtuptime = _dt.datetime.now() - _dt.datetime.fromtimestamp(boot){
'result': f'''CPU {cpu_percent}% ({cpu_count_physical} cores / {cpu_count_logical} threads). RAM {ram_percent}% ({_bytes_human(ram_used)}/{_bytes_human(ram_total)}). {len(disks)} disk(s) monitored. Uptime {uptime}.''',
'cpu': {
'percent': cpu_percent,
'physical_cores': cpu_count_physical,
'logical_cores': cpu_count_logical },
'ram': {
'percent': ram_percent,
'used': _bytes_human(ram_used),
'total': _bytes_human(ram_total) },
'disks': disks,
'uptime_seconds': int(uptime.total_seconds()),
'os': platform.platform() }except Exception:
try:
continuetry:
passexcept Exception:
continue)()

def _gpu_stats():
    
    try:
        import pynvml
        NVML_TEMPERATURE_GPU = NVML_TEMPERATURE_GPU
        NVML_CLOCK_GRAPHICS = NVML_CLOCK_GRAPHICS
        NVML_CLOCK_MEM = NVML_CLOCK_MEM
        nvmlInit = nvmlInit
        nvmlDeviceGetCount = nvmlDeviceGetCount
        nvmlDeviceGetHandleByIndex = nvmlDeviceGetHandleByIndex
        nvmlDeviceGetName = nvmlDeviceGetName
        nvmlDeviceGetUtilizationRates = nvmlDeviceGetUtilizationRates
        nvmlDeviceGetMemoryInfo = nvmlDeviceGetMemoryInfo
        nvmlDeviceGetTemperature = nvmlDeviceGetTemperature
        nvmlDeviceGetClockInfo = nvmlDeviceGetClockInfo
        import pynvml
        gpus = []
        
        try:
            nvmlInit()
            count = nvmlDeviceGetCount()
            for i in range(count):
                h = nvmlDeviceGetHandleByIndex(i)
                util = nvmlDeviceGetUtilizationRates(h)
                mem = nvmlDeviceGetMemoryInfo(h)
                gpus.append({
                    'index': i,
                    'name': nvmlDeviceGetName(h).decode() if isinstance(nvmlDeviceGetName(h), bytes) else str(nvmlDeviceGetName(h)),
                    'gpu_utilization_percent': util.gpu,
                    'memory_utilization_percent': util.memory,
                    'memory_total': _bytes_human(mem.total),
                    'memory_used': _bytes_human(mem.used),
                    'memory_free': _bytes_human(mem.free),
                    'temperature_c': nvmlDeviceGetTemperature(h, NVML_TEMPERATURE_GPU) })
            return gpus
            except Exception:
                return 
        except Exception:
            return 



gpu_info = (lambda args = None: gpus = _gpu_stats()if not gpus:
{
'result': 'No NVIDIA GPU stats available via pynvml (no NVIDIA GPU, driver missing, or nvidia-ml-py3 not installed).',
'gpus': [] }summary = (lambda .0: pass# WARNING: Decompyle incomplete
)(gpus())
    return {
        'result': summary,
        'gpus': gpus }
)()
temperature_info = (lambda args = None: gpus = _gpu_stats()temps = { }for g in gpus:
temps[f'''gpu{g['index']}'''] = g['temperature_c']try:
import psutilsensors = psutil.sensors_temperatures() if hasattr(psutil, 'sensors_temperatures') else { }if not sensors:
sensorsfor name, entries in { }.items():
for entry in entries[:1]:
temps[name] = entry.currentif not temps:
{
'result': 'Temperature reading unavailable. On Windows, CPU temps need LibreHardwareMonitor or admin access; GPU temps need an NVIDIA GPU.',
'temperatures': { } }summary = (lambda .0: pass# WARNING: Decompyle incomplete
)(temps.items()())
        return {
            'result': f'''Temperatures: {summary}.''',
            'temperatures': temps }
    except Exception:
        continue

)()
__all__ = [
    'system_info',
    'gpu_info',
    'temperature_info']
