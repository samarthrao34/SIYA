"""
Heart rate / blood oxygen readings from a paired LAXASFIT smartwatch.

Talks directly to the watch over BLE GATT using a reverse-engineered version
of the protocol its official app (com.lianhezhuli.laxasfit) uses -- no phone
or vendor app involved. Protocol details (Nordic UART service, packet framing,
checksum, data-type codes) were recovered by decompiling the app's APK.

Requires:
  - `bleak` (BLE library; see requirements.txt)
  - The watch's auto-test monitoring enabled (see setup notes below) so it has
    a recent logged reading to sync -- a one-off on-watch manual reading is
    NOT retained for sync, only periodic auto-logged ones are.
  - On Linux, BlueZ must be able to reach the watch over LE. Some BlueZ setups
    default to a classic BR/EDR connection for this watch instead (it also
    advertises a classic Handsfree/AVRCP/HID profile for calls), which has no
    GATT services at all. If this tool times out with no services found, the
    adapter may need `ControllerMode = le` set in /etc/bluetooth/main.conf
    (this disables classic Bluetooth system-wide while set).
"""
from __future__ import annotations

import asyncio
import os
from typing import Any, Dict, List, Optional

from .registry import ToolError, register

WATCH_ADDRESS = os.environ.get("SIYA_WATCH_MAC", "41:42:6D:09:AA:7A")

_CHAR_WRITE = "6e400002-b5a3-f393-e0a9-e50e24dcca9f"
_CHAR_NOTIFY = "6e400003-b5a3-f393-e0a9-e50e24dcca9f"

_ACK_HEADER = 0xDF
_ACK_RESPONSE_HEADER = 0xFD
_PROTOCOL_VERSION = 1
_COMMAND_ID_SPORT_INFO = 5
_KEY_SYNC_ALL_HISTORY = 1

_DATA_TYPE_HEART_RATE = 4
_DATA_TYPE_BLOOD_OXYGEN = 14

_SCAN_TIMEOUT_S = 8.0
_CONNECT_TIMEOUT_S = 7.0
_SERVICES_WAIT_S = 5.0
_SYNC_WAIT_S = 6.0
# Hard ceiling on the whole scan+connect+sync attempt. bleak's own internal
# connect timeout can raise a bare, message-less asyncio.TimeoutError if the
# watch's BLE radio is slow/flaky to complete the handshake (observed: up to
# ~30s with no useful error) -- this ensures a clear failure well before the
# server's DESKTOP_AGENT_TIMEOUT, instead of hanging.
_TOTAL_TIMEOUT_S = 20.0


def _build_packet(command_id: int, sub_key: int, payload: bytes = b"") -> bytes:
    """Mirrors the app's IssuedUtil.getSendByte() + NotifyWriteUtils.addSumCheck():
    a checksum byte (sum of the frame mod 256) is inserted right after the
    2-byte length field, shifting the command id/version/key/payload by one."""
    if not payload:
        original = bytes([_ACK_HEADER, 0, 5, command_id, _PROTOCOL_VERSION, sub_key, 0, 0])
    else:
        total_len = len(payload) + 5
        original = bytes([
            _ACK_HEADER, (total_len >> 8) & 0xFF, total_len & 0xFF,
            command_id, _PROTOCOL_VERSION, sub_key,
            (len(payload) >> 8) & 0xFF, len(payload) & 0xFF,
        ]) + payload
    checksum = sum(original) & 0xFF
    return original[:3] + bytes([checksum]) + original[3:]


def _parse_heart_rate_frame(payload: bytes) -> List[Dict[str, Any]]:
    """Mirrors HrUtils.getHrDataList(): each 8-byte entry starting at payload[4]
    holds a big-endian seconds-since-midnight timestamp (bytes 0-3) and a BPM
    count at byte 7. The app discards entries outside [40, 160] as noise."""
    if len(payload) < 4:
        return []
    count = payload[3]
    readings = []
    for i in range(count):
        start = 4 + i * 8
        entry = payload[start:start + 8]
        if len(entry) < 8:
            break
        seconds = int.from_bytes(entry[0:4], "big")
        bpm = entry[7]
        if 40 <= bpm <= 160:
            readings.append({
                "bpm": bpm,
                "time_of_day": f"{seconds // 3600:02d}:{(seconds // 60) % 60:02d}:{seconds % 60:02d}",
            })
    return readings


def _parse_blood_oxygen_frame(payload: bytes) -> Optional[Dict[str, Any]]:
    """Mirrors HealthUtils.analusis() case 14: a single SpO2 percentage byte
    at payload offset 11, with a seconds-since-midnight timestamp at 4-7."""
    if len(payload) < 12:
        return None
    seconds = int.from_bytes(payload[4:8], "big")
    return {
        "spo2_percent": payload[11],
        "time_of_day": f"{seconds // 3600:02d}:{(seconds // 60) % 60:02d}:{seconds % 60:02d}",
    }


async def _sync_watch(want_type: int, timeout_s: float) -> Dict[str, Any]:
    try:
        from bleak import BleakClient, BleakScanner
    except ImportError as e:
        raise ToolError(
            "The 'bleak' BLE library isn't installed. Run: "
            "pip3 install --user --break-system-packages bleak"
        ) from e

    device = await BleakScanner.find_device_by_address(WATCH_ADDRESS, timeout=_SCAN_TIMEOUT_S)
    if device is None:
        raise ToolError(
            f"Couldn't find the watch ({WATCH_ADDRESS}) over Bluetooth. "
            "Make sure it's charged, nearby, and its screen/Bluetooth is awake."
        )

    heart_rate_readings: List[Dict[str, Any]] = []
    blood_oxygen_reading: Optional[Dict[str, Any]] = None
    reassembly: Optional[bytearray] = None
    reassembly_target = 0
    got_result = asyncio.Event()

    def on_notify(_handle, data: bytearray):
        nonlocal reassembly, reassembly_target
        raw = bytes(data)
        if reassembly is not None:
            reassembly.extend(raw)
            if len(reassembly) < reassembly_target:
                return
            raw = bytes(reassembly[:reassembly_target])
            reassembly = None
        elif not raw:
            return
        elif raw[0] == _ACK_HEADER:
            length_field = (raw[1] << 8) | raw[2]
            total_frame_len = length_field + 4
            if len(raw) < total_frame_len:
                reassembly = bytearray(raw)
                reassembly_target = total_frame_len
                return
        elif raw[0] != _ACK_HEADER:
            return  # an ACK (0xFD) frame -- nothing to parse here

        if raw[0] != _ACK_HEADER or len(raw) < 9:
            return
        data_type = raw[6]
        payload_len = (raw[7] << 8) | raw[8]
        payload = raw[9:9 + payload_len]
        if data_type == _DATA_TYPE_HEART_RATE:
            heart_rate_readings.extend(_parse_heart_rate_frame(payload))
            if want_type == _DATA_TYPE_HEART_RATE and heart_rate_readings:
                got_result.set()
        elif data_type == _DATA_TYPE_BLOOD_OXYGEN:
            nonlocal blood_oxygen_reading
            parsed = _parse_blood_oxygen_frame(payload)
            if parsed:
                blood_oxygen_reading = parsed
                if want_type == _DATA_TYPE_BLOOD_OXYGEN:
                    got_result.set()

    async with BleakClient(device, timeout=_CONNECT_TIMEOUT_S) as client:
        for _ in range(20):
            if list(client.services):
                break
            await asyncio.sleep(_SERVICES_WAIT_S / 20)
        else:
            raise ToolError(
                "Connected to the watch but no BLE services were found -- it likely "
                "connected over classic Bluetooth instead of LE. This watch needs the "
                "adapter restricted to LE-only (ControllerMode = le in "
                "/etc/bluetooth/main.conf) to expose its health-data GATT services."
            )

        await client.start_notify(_CHAR_NOTIFY, on_notify)
        await client.write_gatt_char(
            _CHAR_WRITE,
            _build_packet(_COMMAND_ID_SPORT_INFO, _KEY_SYNC_ALL_HISTORY),
            response=False,
        )
        try:
            await asyncio.wait_for(got_result.wait(), timeout=timeout_s)
        except asyncio.TimeoutError:
            pass
        await client.stop_notify(_CHAR_NOTIFY)

    return {"heart_rate": heart_rate_readings, "blood_oxygen": blood_oxygen_reading}


async def _sync_watch_with_ceiling(want_type: int, timeout_s: float) -> Dict[str, Any]:
    try:
        return await asyncio.wait_for(_sync_watch(want_type, timeout_s), timeout=_TOTAL_TIMEOUT_S)
    except asyncio.TimeoutError as e:
        raise ToolError(
            f"Couldn't reach the watch within {_TOTAL_TIMEOUT_S:.0f}s -- its BLE connection "
            "can be flaky. Try again in a moment, or wake its screen and bring it closer."
        ) from e


def _run_sync(want_type: int, timeout_s: float) -> Dict[str, Any]:
    try:
        return asyncio.run(_sync_watch_with_ceiling(want_type, timeout_s))
    except ToolError:
        raise
    except Exception as e:  # noqa: BLE001
        message = str(e) or type(e).__name__
        raise ToolError(f"Bluetooth sync with the watch failed: {message}") from e


@register("getHeartRate")
def get_heart_rate(args: Dict[str, Any]) -> Dict[str, Any]:
    data = _run_sync(_DATA_TYPE_HEART_RATE, _SYNC_WAIT_S)
    readings = data["heart_rate"]
    if not readings:
        return {
            "result": (
                "No recent heart rate reading synced from the watch. Auto-monitoring "
                "may not have taken a measurement yet (it logs periodically), or the "
                "reading window hasn't produced new data since the last sync."
            ),
            "readings": [],
        }
    latest = readings[-1]
    return {
        "result": f"Latest heart rate: {latest['bpm']} BPM (logged at {latest['time_of_day']}).",
        "bpm": latest["bpm"],
        "time_of_day": latest["time_of_day"],
        "readings": readings,
    }


@register("getBloodOxygen")
def get_blood_oxygen(args: Dict[str, Any]) -> Dict[str, Any]:
    data = _run_sync(_DATA_TYPE_BLOOD_OXYGEN, _SYNC_WAIT_S)
    reading = data["blood_oxygen"]
    if not reading:
        return {
            "result": (
                "No recent blood oxygen (SpO2) reading synced from the watch. "
                "Auto-monitoring may not have taken a measurement yet."
            ),
            "reading": None,
        }
    return {
        "result": f"Latest blood oxygen: {reading['spo2_percent']}% SpO2 (logged at {reading['time_of_day']}).",
        "spo2_percent": reading["spo2_percent"],
        "time_of_day": reading["time_of_day"],
    }


__all__ = ["get_heart_rate", "get_blood_oxygen"]
