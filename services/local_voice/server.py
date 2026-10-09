"""SIYA local voice service: speech detection (Silero VAD) + speech synthesis.

Runs fully offline on the CPU so the GPU stays free for Gemma. The Node server
(server/localLive.ts) is the only client:

  GET  /health  -> {"ok": true, ...}
  POST /tts     {"text", "voice"?, "speed"?} -> raw PCM16 mono 24 kHz (SIYA's
                playback format, identical to what Gemini Live used to send)
  WS   /vad     binary PCM16 mono 16 kHz frames in (the mic stream the app
                already sends); JSON events out:
                  {"type": "speech_start"}
                  {"type": "speech_end", "audio": <base64 16 kHz WAV>, "duration": s}
                  {"type": "speech_discard"}   (too short to be real speech)

Start:  services/local_voice/.venv/bin/python services/local_voice/server.py
Config: SIYA_VOICE_PORT (8795), SIYA_TTS_ENGINE (edge | kokoro),
        SIYA_VOICE_SPEED, SIYA_VOICE (Kokoro voice name)
"""
from __future__ import annotations

import asyncio
import base64
import io
import os
import re
import threading
import wave
from pathlib import Path

import numpy as np
import onnxruntime as ort
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

HERE = Path(__file__).resolve().parent
MODELS = HERE / "models"
PORT = int(os.environ.get("SIYA_VOICE_PORT", "8795"))

# ---------------------------------------------------------------- TTS engines
#
# SIYA_TTS_ENGINE picks the voice:
#   edge    (default) Microsoft's hi-IN-SwaraNeural via edge-tts: a natural
#           human Hindi voice, free, no key. Online: SIYA's reply text is sent
#           to Microsoft. edge-tts uses Edge's read-aloud service unofficially,
#           so it may break; for a product use the same voice via Azure Speech.
#   kokoro  Kokoro-82M hf_alpha/hf_beta on the CPU. Robotic in Hindi, but
#           offline; also the automatic fallback so SIYA is never mute.

ENGINE = os.environ.get("SIYA_TTS_ENGINE", "edge").lower()
OUT_SR = 24000  # SIYA's playback rate (what Gemini Live used to send)
tts_lock = threading.Lock()  # one synthesis at a time; they would only fight for CPU

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\u2600-\u27BF\uFE0F\u200D]+", flags=re.UNICODE
)


def clean_for_speech(text: str) -> str:
    text = EMOJI.sub("", text)
    text = re.sub(r"[*_#`>\[\]]", "", text)  # markdown debris
    text = re.sub(r"\s+", " ", text).strip()
    return text


class KokoroEngine:
    name = "kokoro"

    def __init__(self) -> None:
        from kokoro_onnx import Kokoro

        self.model = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
        self.voices = set(self.model.get_voices())
        self.default_voice = os.environ.get("SIYA_VOICE", "hf_alpha")

    def synth(self, text: str, voice: str | None, speed: float) -> tuple[np.ndarray, int]:
        # espeak's Hindi phonemizer reads Devanagari natively and switches to
        # English phonemes for Latin-script words; romanized Hindi would come
        # out English-accented, which is why prompts ask for Devanagari.
        lang = "hi" if DEVANAGARI.search(text) else "en-us"
        voice = voice if voice in self.voices else self.default_voice
        return self.model.create(text, voice=voice, speed=speed, lang=lang)


class EdgeEngine:
    name = "edge"
    TIMEOUT_S = 6.0

    def __init__(self) -> None:
        import edge_tts  # noqa: F401  (fail at startup if it is missing)

        self.default_voice = os.environ.get("SIYA_EDGE_VOICE", "hi-IN-SwaraNeural")
        self.voices = {self.default_voice, "hi-IN-SwaraNeural", "hi-IN-MadhurNeural"}

    def synth(self, text: str, voice: str | None, speed: float) -> tuple[np.ndarray, int]:
        import asyncio as aio

        import edge_tts
        import soundfile as sf

        voice = voice if voice in self.voices else self.default_voice
        rate = f"{round((speed - 1.0) * 100):+d}%"

        async def fetch() -> bytes:
            mp3 = bytearray()
            async for chunk in edge_tts.Communicate(text, voice, rate=rate).stream():
                if chunk["type"] == "audio":
                    mp3 += chunk["data"]
            return bytes(mp3)

        mp3 = aio.run(aio.wait_for(fetch(), self.TIMEOUT_S))
        if not mp3:
            raise RuntimeError("edge-tts returned no audio")
        audio, sr = sf.read(io.BytesIO(mp3), dtype="float32")
        return audio, sr


def load_engine(name: str):
    if name == "edge":
        return EdgeEngine()
    return KokoroEngine()


try:
    engine = load_engine(ENGINE)
except Exception as exc:  # a broken optional engine must not leave SIYA mute
    print(f"[voice] {ENGINE} failed to load ({exc}); falling back to kokoro", flush=True)
    engine = KokoroEngine()
VOICES = engine.voices
DEFAULT_SPEED = float(os.environ.get("SIYA_VOICE_SPEED", "0.95" if engine.name == "edge" else "0.92"))


def finish_audio(audio: np.ndarray, sr: int) -> bytes:
    """Resample to 24 kHz, keep peaks below clipping, and fade the edges so
    sentence clips butt together without clicks."""
    audio = np.asarray(audio, dtype=np.float32).reshape(-1)
    if audio.size == 0:
        return b""
    if sr != OUT_SR:
        import soxr

        audio = soxr.resample(audio, sr, OUT_SR, quality="HQ")
    # Online voices pad each clip with ~0.5 s of silence; between streamed
    # sentences that becomes dead air. Keep a short natural margin only.
    voiced = np.flatnonzero(np.abs(audio) > 0.01)
    if voiced.size:
        margin = int(OUT_SR * 0.06)
        audio = audio[max(0, voiced[0] - margin): voiced[-1] + margin]
    peak = float(np.abs(audio).max())
    if peak > 0.89:
        audio = audio * (0.89 / peak)
    fade = min(len(audio) // 2, int(OUT_SR * 0.008))
    if fade > 0:
        ramp = np.linspace(0.0, 1.0, fade, dtype=np.float32)
        audio[:fade] *= ramp
        audio[-fade:] *= ramp[::-1]
    return (audio * 32767).astype("<i2").tobytes()


fallback_engine = None
primary_down_until = 0.0  # after a failure (e.g. offline) skip the primary for a minute


def synthesize(text: str, voice: str | None, speed: float) -> bytes:
    global fallback_engine, primary_down_until
    import time

    text = clean_for_speech(text)
    if not text:
        return b""
    with tts_lock:
        audio = None
        if engine.name == "kokoro" or time.monotonic() >= primary_down_until:
            try:
                audio, sr = engine.synth(text, voice, speed)
            except Exception as exc:
                if engine.name == "kokoro":
                    raise
                primary_down_until = time.monotonic() + 60
                print(f"[voice] {engine.name} failed ({exc!r}); using kokoro for 60 s", flush=True)
        if audio is None:
            fallback_engine = fallback_engine or KokoroEngine()
            audio, sr = fallback_engine.synth(text, None, 0.92)
    return finish_audio(audio, sr)


# ---------------------------------------------------------------- VAD (Silero)

class SileroVAD:
    """Silero VAD v5 via ONNX Runtime (16 kHz, 512-sample windows)."""

    WINDOW = 512
    CONTEXT = 64

    def __init__(self) -> None:
        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        self.session = ort.InferenceSession(
            str(MODELS / "silero_vad.onnx"), sess_options=opts, providers=["CPUExecutionProvider"]
        )
        self.sr = np.array(16000, dtype=np.int64)
        self.reset()

    def reset(self) -> None:
        self.state = np.zeros((2, 1, 128), dtype=np.float32)
        self.context = np.zeros((1, self.CONTEXT), dtype=np.float32)

    def prob(self, window: np.ndarray) -> float:
        x = np.concatenate([self.context, window.reshape(1, -1)], axis=1)
        out, self.state = self.session.run(None, {"input": x, "state": self.state, "sr": self.sr})
        self.context = x[:, -self.CONTEXT:]
        return float(out[0][0])


START_PROB = 0.5
END_PROB = 0.35
START_WINDOWS = 3          # ~96 ms of speech opens a turn
END_SILENCE_MS = int(os.environ.get("SIYA_VAD_SILENCE_MS", "700"))
MIN_SPEECH_MS = 300        # shorter than this is a cough / click, not a turn
PREROLL_MS = 300
MAX_UTTERANCE_S = 25       # Gemma's audio window is ~30 s


def wav_b64(pcm16: bytes) -> str:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(pcm16)
    return base64.b64encode(buf.getvalue()).decode()


class Endpointer:
    """Turns a continuous mic stream into complete utterances."""

    def __init__(self) -> None:
        self.vad = SileroVAD()
        self.pending = np.zeros(0, dtype=np.float32)
        self.preroll: list[np.ndarray] = []
        self.speech: list[np.ndarray] = []
        self.in_speech = False
        self.voiced = 0
        self.silence_windows = 0
        self.speech_windows = 0

    def reset(self) -> None:
        self.__init__()

    def feed(self, pcm16: bytes) -> list[dict]:
        events: list[dict] = []
        samples = np.frombuffer(pcm16, dtype="<i2").astype(np.float32) / 32768.0
        self.pending = np.concatenate([self.pending, samples])
        win_ms = SileroVAD.WINDOW / 16  # 32 ms
        while len(self.pending) >= SileroVAD.WINDOW:
            window = self.pending[: SileroVAD.WINDOW]
            self.pending = self.pending[SileroVAD.WINDOW:]
            p = self.vad.prob(window)
            if not self.in_speech:
                self.preroll.append(window)
                self.preroll = self.preroll[-int(PREROLL_MS / win_ms):]
                self.voiced = self.voiced + 1 if p >= START_PROB else 0
                if self.voiced >= START_WINDOWS:
                    self.in_speech = True
                    self.speech = list(self.preroll)
                    self.speech_windows = self.voiced
                    self.silence_windows = 0
                    events.append({"type": "speech_start"})
                continue
            self.speech.append(window)
            if p < END_PROB:
                self.silence_windows += 1
            else:
                self.silence_windows = 0
                self.speech_windows += 1
            ended = self.silence_windows * win_ms >= END_SILENCE_MS
            too_long = len(self.speech) * win_ms >= MAX_UTTERANCE_S * 1000
            if ended or too_long:
                events.append(self._finish())
        return events

    def _finish(self) -> dict:
        speech_ms = self.speech_windows * SileroVAD.WINDOW / 16
        audio = np.concatenate(self.speech) if self.speech else np.zeros(0, dtype=np.float32)
        self.in_speech = False
        self.speech = []
        self.preroll = []
        self.voiced = 0
        self.silence_windows = 0
        self.speech_windows = 0
        if speech_ms < MIN_SPEECH_MS:
            return {"type": "speech_discard"}
        pcm = (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()
        return {"type": "speech_end", "audio": wav_b64(pcm), "duration": round(len(audio) / 16000, 2)}


# ---------------------------------------------------------------- HTTP / WS

app = FastAPI(title="SIYA local voice")


class TTSRequest(BaseModel):
    text: str
    voice: str | None = None
    speed: float | None = None


@app.get("/health")
def health() -> dict:
    return {"ok": True, "engine": engine.name, "speed": DEFAULT_SPEED, "voices": sorted(VOICES)}


@app.post("/tts")
async def tts(req: TTSRequest) -> Response:
    voice = req.voice if req.voice in VOICES else None
    speed = min(1.4, max(0.6, req.speed or DEFAULT_SPEED))
    try:
        pcm = await asyncio.to_thread(synthesize, req.text, voice, speed)
    except Exception as exc:  # phonemizer edge cases must not kill the service
        return JSONResponse({"error": str(exc)}, status_code=500)
    return Response(pcm, media_type="application/octet-stream")


@app.websocket("/vad")
async def vad(ws: WebSocket) -> None:
    await ws.accept()
    ep = Endpointer()
    try:
        while True:
            msg = await ws.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("bytes"):
                for event in await asyncio.to_thread(ep.feed, msg["bytes"]):
                    await ws.send_json(event)
            elif msg.get("text") and '"reset"' in msg["text"]:
                ep.reset()
    except WebSocketDisconnect:
        pass


def warmup() -> None:
    synthesize("हाँ.", None, DEFAULT_SPEED)
    synthesize("Okay.", None, DEFAULT_SPEED)


if __name__ == "__main__":
    warmup()
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
