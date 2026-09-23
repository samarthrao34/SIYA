/*
 * Recovered from SIYA-Setup-1.0.1.exe (dist/assets/index-qnLjC2CG.js).
 * De-minified (no sourcemap existed) — reformatted with prettier and the
 * top-level class renamed (Fx -> LiveSession) for readability. Internal
 * local variable names inside methods are still the original minified
 * short names; behavior is preserved verbatim.
 *
 * ts-nocheck below: the class assigns its fields inside grouped
 * comma-expressions in the constructor (minifier output), which defeats
 * TypeScript's constructor-based property inference. Left untyped rather
 * than guessing every field's type.
 */
// @ts-nocheck

// Audio codec helpers (PCM16 <-> Float32, base64 <-> ArrayBuffer) for the
// Gemini Live mic/playback pipeline. These were missing entirely from the
// de-minified output (not vendor-symbol aliases -- genuine local functions
// that the first recovery pass dropped). Recovered verbatim by locating the
// exact `getChannelData(0)` call site in the original minified bundle
// (dist/assets/index-qnLjC2CG.js) and reading the real function bodies
// straight from it, not reconstructed from usage.
function Bx(a) {
  const i = new ArrayBuffer(a.length * 2),
    s = new DataView(i);
  let o = 0;
  for (let r = 0; r < a.length; r++, o += 2) {
    let h = Math.max(-1, Math.min(1, a[r]));
    s.setInt16(o, h < 0 ? h * 32768 : h * 32767, true);
  }
  return i;
}
function Ux(a) {
  const i = new Int16Array(a.buffer, a.byteOffset, a.byteLength / 2),
    s = new Float32Array(i.length);
  for (let o = 0; o < i.length; o++) s[o] = i[o] / 32768;
  return s;
}
function Hx(a) {
  let i = "";
  const s = new Uint8Array(a),
    o = s.byteLength;
  for (let r = 0; r < o; r++) i += String.fromCharCode(s[r]);
  return window.btoa(i);
}
function qx(a) {
  const i = window.atob(a),
    s = i.length,
    o = new Uint8Array(s);
  for (let r = 0; r < s; r++) o[r] = i.charCodeAt(r);
  return o;
}


export class LiveSession {
  constructor(i) {
    ((this.ws = null),
      (this.inputAudioCtx = null),
      (this.outputAudioCtx = null),
      (this.micStream = null),
      (this.micSourceNode = null),
      (this.micProcessorNode = null),
      (this.inputAnalyser = null),
      (this.outputAnalyser = null),
      (this.outputGainNode = null),
      (this.nextStartTime = 0),
      (this.activeSources = []),
      (this.userSpeaking = !1),
      (this.voiceFrames = 0),
      (this.lastVoiceAt = 0),
      (this.outputSpeechStartedAt = 0),
      (this.voiceThreshold = 0.014),
      (this.voiceStartFrames = 1),
      (this.voiceStopDelayMs = 500),
      (this.bargeInGuardMs = 700),
      (this.bargeInStartFrames = 4),
      (this.bargeInVoiceThreshold = 0.045),
      (this.currentState = "disconnected"),
      (this.isActivated = !1),
      (this.useMicrophone = !0),
      (this.liveReady = !1),
      (this.outputReady = !1),
      (this.pendingTextMessages = []),
      (this.onStateChange = i.onStateChange),
      (this.onTranscription = i.onTranscription),
      (this.onToolCall = i.onToolCall),
      (this.onError = i.onError),
      (this.onMemorySync = i.onMemorySync),
      (this.onScreenVisionState = i.onScreenVisionState),
      (this.onHealthReading = i.onHealthReading),
      (this.onHealthSyncStatus = i.onHealthSyncStatus));
  }
  setState(i) {
    ((this.currentState = i), this.onStateChange(i));
  }
  getState() {
    return this.currentState;
  }
  sendVideoFrame(i, s = {}) {
    this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.currentState !== "disconnected" &&
      this.ws.send(JSON.stringify({ type: "video", video: i, ...s }));
  }
  sendText(i) {
    const s = i.trim();
    if (s) {
      if (
        (this.currentState === "speaking" &&
          (this.emitConversationEvent("user_interrupted_siya"),
          this.handleInterruption()),
        this.ws &&
          this.ws.readyState === WebSocket.OPEN &&
          this.liveReady &&
          this.outputReady &&
          this.currentState !== "disconnected")
      ) {
        this.ws.send(JSON.stringify({ type: "text", text: s }));
        return;
      }
      this.pendingTextMessages.push(s);
    }
  }
  flushPendingTextMessages() {
    if (!(
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.liveReady ||
      !this.outputReady
    ))
      for (const i of this.pendingTextMessages.splice(0))
        this.ws.send(JSON.stringify({ type: "text", text: i }));
  }
  async connect(i = !0) {
    if (!this.isActivated) {
      ((this.isActivated = !0),
        (this.useMicrophone = i),
        this.setState("connecting"));
      try {
        const s = window.location.protocol === "https:" ? "wss:" : "ws:";
        ((this.ws = new WebSocket(`${s}//${window.location.host}/live`)),
          (this.ws.binaryType = "blob"),
          (this.ws.onopen = async () => {
            var o;
            console.log("[Siya] Connected to server side WS bridge");
            try {
              if (!this.isActivated) return;
              const r = window.AudioContext || window.webkitAudioContext;
              if (!r)
                throw new Error(
                  "Holographic audio link unsupported: Web Audio API missing in browser.",
                );
              if (
                ((this.inputAudioCtx = new r({ sampleRate: 16e3 })),
                (this.outputAudioCtx = new r({ sampleRate: 24e3 })),
                this.inputAudioCtx.state === "suspended" &&
                  (await this.inputAudioCtx.resume().catch(() => {})),
                this.outputAudioCtx.state === "suspended" &&
                  (await this.outputAudioCtx.resume().catch(() => {})),
                (this.outputGainNode = this.outputAudioCtx.createGain()),
                (this.outputAnalyser = this.outputAudioCtx.createAnalyser()),
                (this.outputAnalyser.fftSize = 256),
                (this.outputAnalyser.smoothingTimeConstant = 0.8),
                this.outputGainNode.connect(this.outputAnalyser),
                this.outputAnalyser.connect(this.outputAudioCtx.destination),
                (this.outputReady = !0),
                this.flushPendingTextMessages(),
                !this.useMicrophone)
              ) {
                (this.setState("listening"), this.flushPendingTextMessages());
                return;
              }
              if (!((o = navigator.mediaDevices) != null && o.getUserMedia))
                throw new Error(
                  "Microphone access is unavailable in this browser. Open SIYA in Chrome at http://localhost:3000 and allow microphone access.",
                );
              const h = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: !0,
                  noiseSuppression: !0,
                  autoGainControl: !0,
                },
              });
              if (
                !this.isActivated ||
                !this.inputAudioCtx ||
                !this.outputAudioCtx
              ) {
                h.getTracks().forEach((f) => {
                  try {
                    f.stop();
                  } catch {}
                });
                return;
              }
              ((this.micStream = h),
                (this.inputAnalyser = this.inputAudioCtx.createAnalyser()),
                (this.inputAnalyser.fftSize = 256),
                (this.micSourceNode =
                  this.inputAudioCtx.createMediaStreamSource(this.micStream)),
                this.micSourceNode.connect(this.inputAnalyser));
              const onMicFrame = (d) => {
                if (
                  this.currentState === "disconnected" ||
                  this.currentState === "connecting"
                )
                  return;
                if (!this.updateVoiceActivity(d)) return;
                const m = Bx(d),
                  y = Hx(m);
                this.ws &&
                  this.ws.readyState === WebSocket.OPEN &&
                  this.ws.send(JSON.stringify({ audio: y }));
              };
              // AudioWorkletNode runs mic capture on the dedicated audio
              // thread, so frames keep flowing on schedule even when the
              // main thread is busy (e.g. 3D rendering) -- unlike the
              // deprecated ScriptProcessorNode, which processes on the main
              // thread and can silently drop callbacks under load, causing
              // exactly the "sometimes doesn't hear me" symptom. Falls back
              // to ScriptProcessorNode if AudioWorklet is unavailable.
              try {
                if (!this.inputAudioCtx.audioWorklet)
                  throw new Error("AudioWorklet unsupported");
                await this.inputAudioCtx.audioWorklet.addModule(
                  "/pcm-capture-worklet.js",
                );
                this.micProcessorNode = new AudioWorkletNode(
                  this.inputAudioCtx,
                  "pcm-capture-processor",
                );
                this.micProcessorNode.port.onmessage = (e) =>
                  onMicFrame(e.data);
                this.micSourceNode.connect(this.micProcessorNode);
              } catch (workletError) {
                console.warn(
                  "AudioWorklet mic capture unavailable, falling back to ScriptProcessorNode:",
                  workletError,
                );
                this.micProcessorNode = this.inputAudioCtx.createScriptProcessor(
                  1024,
                  1,
                  1,
                );
                this.micSourceNode.connect(this.micProcessorNode);
                this.micProcessorNode.connect(this.inputAudioCtx.destination);
                this.micProcessorNode.onaudioprocess = (f) =>
                  onMicFrame(f.inputBuffer.getChannelData(0));
              }
              this.setState("listening");
            } catch (r) {
              (console.error(
                "Audio Context or Microphone Initialization Failed:",
                r,
              ),
                this.onError(
                  `Permission error: ${r.message || "Microphone required for holographic Live link."}`,
                ),
                this.disconnect());
            }
          }),
          (this.ws.onmessage = async (o) => {
            try {
              const r = JSON.parse(o.data);
              if (r.type === "error") {
                (this.onError(r.error),
                  this.disconnect(),
                  r.code === "INVALID_API_KEY" &&
                    console.warn(
                      "[Siya] Gemini rejected the configured API key.",
                    ));
                return;
              }
              if (r.type === "status") {
                (console.log("[Siya WS Status]:", r.status),
                  r.status === "connecting_gemini" ||
                    (r.status === "connected"
                      ? ((this.liveReady = !0),
                        this.setState("listening"),
                        this.flushPendingTextMessages())
                      : r.status === "session_closed" && this.disconnect()));
                return;
              }
              if (
                (r.type === "audio" &&
                  r.audio &&
                  this.playAudioPCMChunk(r.audio),
                r.type === "interrupted" && this.handleInterruption(),
                r.type === "turnComplete" &&
                  setTimeout(() => {
                    this.activeSources.length === 0 &&
                      this.currentState === "speaking" &&
                      this.setState("listening");
                  }, 100),
                r.type === "transcription" &&
                  this.onTranscription(r.role, r.text),
                r.type === "memory_sync" &&
                  r.memories &&
                  this.onMemorySync &&
                  this.onMemorySync(r.memories),
                r.type === "health_reading" &&
                  r.reading &&
                  this.onHealthReading &&
                  this.onHealthReading(r.reading),
                r.type === "health_sync_status" &&
                  this.onHealthSyncStatus &&
                  this.onHealthSyncStatus(r.tool, r.status, r.error),
                r.type === "toolCall")
              ) {
                const { callId: h, name: f, args: d } = r;
                this.onToolCall(f, d, (g) => {
                  this.ws &&
                    this.ws.readyState === WebSocket.OPEN &&
                    this.ws.send(
                      JSON.stringify({
                        type: "toolResponse",
                        id: h,
                        name: f,
                        output: g,
                      }),
                    );
                });
              }
              r.type === "screenVisionState" &&
                this.onScreenVisionState &&
                this.onScreenVisionState(r.state, {
                  activeWindow: r.activeWindow ?? null,
                  error: r.error ?? null,
                });
            } catch (r) {
              console.error("Error reading server packet:", r);
            }
          }),
          (this.ws.onerror = (o) => {
            (console.error("WebSocket transport error:", o),
              this.onError(
                "Holographic network link lost. Please check connection.",
              ),
              this.disconnect());
          }),
          (this.ws.onclose = () => {
            (console.log("WebSocket connection closed"), this.disconnect());
          }));
      } catch (s) {
        (console.error("Connection establish sequence failed:", s),
          this.onError(s.message || "Failed to initialize active channel."),
          this.disconnect());
      }
    }
  }
  handleInterruption() {
    (console.log("[Audio] Interruption signal received; flushing play logs."),
      this.activeSources.forEach((i) => {
        try {
          i.stop();
        } catch {}
      }),
      (this.activeSources = []),
      (this.nextStartTime = 0),
      (this.outputSpeechStartedAt = 0),
      this.setState("listening"));
  }
  updateVoiceActivity(i) {
    let s = 0;
    for (let m = 0; m < i.length; m++) s += i[m] * i[m];
    const o = Math.sqrt(s / Math.max(1, i.length)),
      r = performance.now(),
      h = this.currentState === "speaking" || this.activeSources.length > 0;
    if (
      h &&
      this.outputSpeechStartedAt > 0 &&
      r - this.outputSpeechStartedAt < this.bargeInGuardMs
    )
      return ((this.voiceFrames = 0), !1);
    const f = h ? this.readOutputRms() : 0,
      d = h
        ? Math.max(this.bargeInVoiceThreshold, Math.min(0.1, f * 0.32 + 0.012))
        : this.voiceThreshold,
      g = h ? this.bargeInStartFrames : this.voiceStartFrames;
    if (o >= d) {
      if (
        ((this.lastVoiceAt = r),
        (this.voiceFrames += 1),
        !this.userSpeaking && this.voiceFrames >= g)
      ) {
        const m = h;
        ((this.userSpeaking = !0),
          m &&
            (this.emitConversationEvent("user_interrupted_siya", o),
            this.handleInterruption()),
          this.emitConversationEvent("user_started_speaking", o));
      }
      return !h || this.userSpeaking;
    }
    return (
      (this.voiceFrames = 0),
      this.userSpeaking &&
        r - this.lastVoiceAt >= this.voiceStopDelayMs &&
        ((this.userSpeaking = !1),
        this.emitConversationEvent("user_stopped_speaking", o)),
      !h || this.userSpeaking
    );
  }
  readOutputRms() {
    if (!this.outputAnalyser) return 0;
    const i = new Uint8Array(this.outputAnalyser.fftSize);
    this.outputAnalyser.getByteTimeDomainData(i);
    let s = 0;
    for (let o = 0; o < i.length; o++) {
      const r = (i[o] - 128) / 128;
      s += r * r;
    }
    return Math.sqrt(s / Math.max(1, i.length));
  }
  emitConversationEvent(i, s) {
    !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      this.ws.send(
        JSON.stringify({ type: "conversationEvent", event: i, rms: s }),
      );
  }
  playAudioPCMChunk(i) {
    if (!(!this.outputAudioCtx || !this.outputGainNode))
      try {
        ((this.currentState !== "speaking" ||
          this.activeSources.length === 0) &&
          (this.outputSpeechStartedAt = performance.now()),
          this.setState("speaking"));
        const s = qx(i),
          o = Ux(s),
          r = this.outputAudioCtx.createBuffer(1, o.length, 24e3);
        r.getChannelData(0).set(o);
        const h = this.outputAudioCtx.createBufferSource();
        ((h.buffer = r), h.connect(this.outputGainNode));
        const f = this.outputAudioCtx.currentTime;
        (this.nextStartTime < f && (this.nextStartTime = f + 0.03),
          h.start(this.nextStartTime),
          (this.nextStartTime += r.duration),
          (h.onended = () => {
            const d = this.activeSources.indexOf(h);
            (d > -1 && this.activeSources.splice(d, 1),
              this.activeSources.length === 0 &&
                this.currentState === "speaking" &&
                ((this.outputSpeechStartedAt = 0), this.setState("listening")));
          }),
          this.activeSources.push(h));
      } catch (s) {
        console.error("PCM Chunk buffering/playback failed:", s);
      }
  }
  disconnect() {
    if (
      ((this.isActivated = !1),
      (this.liveReady = !1),
      (this.outputReady = !1),
      this.setState("disconnected"),
      this.ws)
    ) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    if (
      (this.micStream &&
        (this.micStream.getTracks().forEach((i) => {
          try {
            i.stop();
          } catch {}
        }),
        (this.micStream = null)),
      this.micProcessorNode)
    ) {
      try {
        this.micProcessorNode.disconnect();
      } catch {}
      this.micProcessorNode = null;
    }
    if (this.micSourceNode) {
      try {
        this.micSourceNode.disconnect();
      } catch {}
      this.micSourceNode = null;
    }
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch {}
      this.inputAudioCtx = null;
    }
    if (this.outputAudioCtx) {
      try {
        this.outputAudioCtx.close();
      } catch {}
      this.outputAudioCtx = null;
    }
    ((this.activeSources = []),
      (this.nextStartTime = 0),
      (this.userSpeaking = !1),
      (this.voiceFrames = 0),
      (this.lastVoiceAt = 0),
      (this.outputSpeechStartedAt = 0),
      (this.pendingTextMessages = []),
      (this.inputAnalyser = null),
      (this.outputAnalyser = null),
      (this.outputGainNode = null));
  }
}
