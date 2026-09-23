// Standalone mobile Gemini Live session. Adapted from src/api/liveSession.ts:
// the mic capture, audio-codec, playback, and barge-in/voice-activity logic
// are reused verbatim (pure client-side signal processing, no server
// involved). What's different is the transport -- instead of opening our own
// ws://.../live relay to server.ts (which then drives ai.live.connect on the
// Node side), this connects DIRECTLY to Gemini from the browser using
// @google/genai's browser build (resolved automatically by its package.json
// "browser" export condition), and handles the small set of mobile-safe
// tools (changeBackground / getCurrentTime / convertCurrency) inline instead
// of routing through the desktop agent, which doesn't exist here.

import { GoogleGenAI, Modality, StartSensitivity, EndSensitivity, type LiveServerMessage, type Session } from "@google/genai";
import { loadSettings } from "../src/settings/settingsStore";
import { publishAvatarEvent } from "../runtime/avatarEvents.js";
import { amplitudeFrames } from "../runtime/speechTimeline.js";
import { buildSystemInstruction, MOBILE_FUNCTION_DECLARATIONS } from "./persona";
import { saveMemoryCard, updateProfileFact, recallMemory, formatRecalledMemory } from "./memoryClient";
import { ensureEmotionDetector, detectEmotion, EmotionSmoother, type EmotionReading } from "../src/vision/emotionDetector";

function floatToPCM16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  for (let i = 0, offset = 0; i < samples.length; i++, offset += 2) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 32768 : clamped * 32767, true);
  }
  return buffer;
}
function pcm16ToFloat(buffer: ArrayBufferLike): Float32Array {
  const ints = new Int16Array(buffer);
  const floats = new Float32Array(ints.length);
  for (let i = 0; i < ints.length; i++) floats[i] = ints[i] / 32768;
  return floats;
}
function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}
function base64ToBytes(b64: string): Uint8Array {
  const binary = window.atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
function readLiveAudio(message: LiveServerMessage): string | undefined {
  return message.serverContent?.modelTurn?.parts?.find(
    (part) => part.inlineData?.data && (!part.inlineData.mimeType || part.inlineData.mimeType.startsWith("audio/")),
  )?.inlineData?.data;
}

export type SessionState = "disconnected" | "connecting" | "listening" | "speaking";

interface MobileLiveSessionCallbacks {
  onStateChange: (state: SessionState) => void;
  onTranscription: (role: "user" | "model", text: string) => void;
  onError: (message: string) => void;
  onCameraChange?: (on: boolean) => void;
  onEmotionChange?: (reading: EmotionReading | null) => void;
}

export class MobileLiveSession {
  private geminiSession: Session | null = null;
  private inputAudioCtx: AudioContext | null = null;
  outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private micProcessorNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  inputAnalyser: AnalyserNode | null = null;
  outputAnalyser: AnalyserNode | null = null;
  private outputGainNode: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private userSpeaking = false;
  private voiceFrames = 0;
  private lastVoiceAt = 0;
  private outputSpeechStartedAt = 0;
  private readonly voiceThreshold = 0.014;
  private readonly voiceStartFrames = 1;
  private readonly voiceStopDelayMs = 500;
  private readonly bargeInGuardMs = 700;
  private readonly bargeInStartFrames = 4;
  private readonly bargeInVoiceThreshold = 0.045;
  private currentState: SessionState = "disconnected";
  private isActivated = false;
  private liveReady = false;
  private connectionGeneration = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private playbackGeneration = 0;
  private avatarUtteranceId: string | null = null;
  private avatarResponseSequence = 0;
  private retiredAvatarUtterances = new Set<string>();
  private siyaSpeechObserved = false;

  private camStream: MediaStream | null = null;
  private camVideoEl: HTMLVideoElement | null = null;
  private camCanvas: HTMLCanvasElement | null = null;
  private camInterval: ReturnType<typeof setInterval> | null = null;
  private emotionDetectorRef: Awaited<ReturnType<typeof ensureEmotionDetector>> | null = null;
  private emotionSmoother: EmotionSmoother | null = null;
  private lastEmotionLabel: string | null = null;
  private lastEmotionNoteAt = 0;
  camOn = false;

  constructor(
    private readonly apiKey: string,
    private readonly callbacks: MobileLiveSessionCallbacks,
  ) {}

  private setState(state: SessionState) {
    this.currentState = state;
    this.callbacks.onStateChange(state);
    publishAvatarEvent({ type: "state", state });
  }
  getState() {
    return this.currentState;
  }

  async connect() {
    if (this.isActivated) return;
    this.isActivated = true;
    this.setState("connecting");
    const generation = ++this.connectionGeneration;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error("Web Audio API is unavailable in this browser.");
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      if (this.inputAudioCtx.state === "suspended") await this.inputAudioCtx.resume().catch(() => {});
      if (this.outputAudioCtx.state === "suspended") await this.outputAudioCtx.resume().catch(() => {});
      this.outputGainNode = this.outputAudioCtx.createGain();
      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.8;
      this.outputGainNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.outputAudioCtx.destination);
      publishAvatarEvent({ type: "audioContext", context: this.outputAudioCtx, gain: this.outputGainNode });

      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access is unavailable in this browser.");
      }
      const micDeviceId = loadSettings().micDeviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          ...(micDeviceId ? { deviceId: { exact: micDeviceId } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (generation !== this.connectionGeneration) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.micStream = stream;
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.micSourceNode = this.inputAudioCtx.createMediaStreamSource(stream);
      this.micSourceNode.connect(this.inputAnalyser);

      const onMicFrame = (samples: Float32Array) => {
        if (this.currentState === "disconnected" || this.currentState === "connecting") return;
        if (!this.updateVoiceActivity(samples)) return;
        const pcm = floatToPCM16(samples);
        const b64 = bufferToBase64(pcm);
        this.geminiSession?.sendRealtimeInput({ audio: { data: b64, mimeType: "audio/pcm;rate=16000" } });
      };
      try {
        if (!this.inputAudioCtx.audioWorklet) throw new Error("AudioWorklet unsupported");
        await this.inputAudioCtx.audioWorklet.addModule("/pcm-capture-worklet.js");
        if (generation !== this.connectionGeneration) return;
        const worklet = new AudioWorkletNode(this.inputAudioCtx, "pcm-capture-processor");
        worklet.port.onmessage = (e) => onMicFrame(e.data);
        this.micSourceNode.connect(worklet);
        this.micProcessorNode = worklet;
      } catch (workletError) {
        if (generation !== this.connectionGeneration) return;
        console.warn("AudioWorklet unavailable, falling back to ScriptProcessorNode:", workletError);
        const processor = this.inputAudioCtx.createScriptProcessor(1024, 1, 1);
        this.micSourceNode.connect(processor);
        processor.connect(this.inputAudioCtx.destination);
        processor.onaudioprocess = (e) => onMicFrame(e.inputBuffer.getChannelData(0));
        this.micProcessorNode = processor;
      }

      // Compact, targeted pull from the memory graph -- not the whole corpus,
      // just whatever a broad "who is this person, what's going on" query
      // surfaces. Never blocks the connection: a slow/unreachable memory
      // server just means she starts this session without it.
      const recalled = await recallMemory("Samarth identity preferences ongoing situation recent conversations").catch(() => []);
      if (generation !== this.connectionGeneration) return;
      const recalledBlock = formatRecalledMemory(recalled);

      const ai = new GoogleGenAI({ apiKey: this.apiKey });
      this.geminiSession = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: loadSettings().voiceName || "Leda" } } },
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              prefixPaddingMs: 150,
              silenceDurationMs: 500,
            },
          },
          systemInstruction: buildSystemInstruction(recalledBlock),
          tools: [{ functionDeclarations: MOBILE_FUNCTION_DECLARATIONS }],
        },
        callbacks: {
          onopen: () => {
            if (generation !== this.connectionGeneration) return;
            this.liveReady = true;
            this.reconnectAttempts = 0;
            this.setState("listening");
          },
          onmessage: (message: LiveServerMessage) => {
            if (generation !== this.connectionGeneration) return;
            this.handleMessage(message);
          },
          onerror: (event: ErrorEvent) => {
            if (generation !== this.connectionGeneration) return;
            console.error("Gemini Live error:", event);
            this.callbacks.onError(String((event as any)?.message || "Connection error."));
          },
          onclose: (event: CloseEvent) => {
            if (generation !== this.connectionGeneration) return;
            console.log(`Gemini Live closed (code=${event.code} reason=${event.reason})`);
            if (event.code === 1011 || /quota|billing/i.test(event.reason || "")) {
              this.callbacks.onError(event.reason || "Gemini quota/billing error.");
              this.disconnect();
              return;
            }
            this.retryConnection();
          },
        },
      });
    } catch (err: any) {
      if (generation !== this.connectionGeneration) return;
      console.error("Connection setup failed:", err);
      this.callbacks.onError(err?.message || "Failed to connect to Siya.");
      this.disconnect();
    }
  }

  private retryConnection() {
    if (!this.isActivated) return;
    const attempt = this.reconnectAttempts + 1;
    this.disconnect(true);
    if (attempt > 5) {
      this.callbacks.onError("Connection could not be restored. Check your network and try again.");
      return;
    }
    this.reconnectAttempts = attempt;
    this.setState("connecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.isActivated = false;
      void this.connect();
    }, Math.min(1000 * 2 ** (attempt - 1), 16000));
  }

  private handleMessage(message: LiveServerMessage) {
    const audio = readLiveAudio(message);
    if (audio && !message.serverContent?.interrupted) {
      if (!this.avatarUtteranceId) {
        this.avatarUtteranceId = `mobile:${++this.avatarResponseSequence}`;
        publishAvatarEvent({ type: "speechStart", utteranceId: this.avatarUtteranceId });
      }
      this.siyaSpeechObserved = true;
      this.playAudioPCMChunk(audio, this.avatarUtteranceId);
    }
    if (message.serverContent?.interrupted) {
      this.handleInterruption(this.avatarUtteranceId ?? undefined);
      this.avatarUtteranceId = null;
      this.siyaSpeechObserved = false;
    }
    if (message.serverContent?.turnComplete) {
      const finished = this.avatarUtteranceId;
      this.avatarUtteranceId = null;
      this.siyaSpeechObserved = false;
      setTimeout(() => {
        if (this.activeSources.length === 0 && this.currentState === "speaking") this.setState("listening");
      }, 100);
      void finished;
    }
    const modelParts = (message.serverContent as any)?.modelTurn?.parts || [];
    const visibleText = modelParts
      .filter((p: any) => p.thought !== true && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("");
    const modelText = (message.serverContent as any)?.outputTranscription?.text ?? visibleText;
    if (modelText) this.callbacks.onTranscription("model", modelText);

    const userText =
      (message.serverContent as any)?.inputTranscription?.text ??
      (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
    if (userText) this.callbacks.onTranscription("user", userText);

    if (message.toolCall?.functionCalls) {
      for (const call of message.toolCall.functionCalls) {
        if (!call.name || !call.id) continue;
        console.log(`[Tool Call] ${call.name} args=${JSON.stringify(call.args || {})}`);
        void this.handleToolCall(call.name, (call.args || {}) as Record<string, unknown>, call.id);
      }
    }
  }

  private async handleToolCall(name: string, args: Record<string, unknown>, callId: string) {
    let output: unknown = { result: "ok" };
    try {
      if (name === "getCurrentTime") {
        const now = new Date();
        output = {
          now: now.toLocaleString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: "short",
          }),
          iso: now.toISOString(),
        };
      } else if (name === "changeBackground") {
        const color = String(args.color || "").trim();
        if (color) publishAvatarEvent({ type: "themeColor" as any, color } as any);
        output = { result: color ? `Theme shifted to ${color}.` : "No color given." };
      } else if (name === "convertCurrency") {
        const amount = Number(args.amount) || 1;
        const from = String(args.from_currency || "USD").toUpperCase();
        const to = String(args.to_currency || "INR").toUpperCase();
        const res = await fetch(`https://api.frankfurter.dev/v2/rate/${from}/${to}`, { signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        const rate = Number(data?.rate);
        output = Number.isFinite(rate)
          ? { amount, from, to, rate, converted: Math.round(amount * rate * 100) / 100, date: data?.date }
          : { error: "Exchange rate unavailable." };
      } else if (name === "saveMemory") {
        const content = String(args.content || "").trim();
        if (!content) {
          output = { error: "content is required." };
        } else if (String(args.type || "").toLowerCase() === "identity") {
          const result = await updateProfileFact(content);
          output = result.ok ? { result: result.skipped ? "already known" : "saved to profile" } : { error: result.error || "save failed" };
        } else {
          const title = String(args.title || "").trim() || content.slice(0, 60);
          const tags = String(args.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
          const result = await saveMemoryCard({ title, content, tags });
          output = result.ok ? { result: "saved" } : { error: result.error || "save failed" };
        }
      } else if (name === "recallMemory") {
        const query = String(args.query || "").trim();
        const chunks = query ? await recallMemory(query) : [];
        output = chunks.length
          ? { found: chunks.map((c) => ({ title: c.title, content: c.body })) }
          : { found: [], note: "Nothing matched in memory." };
      }
    } catch (err: any) {
      output = { error: err?.message || String(err) };
    }
    this.geminiSession?.sendToolResponse({ functionResponses: [{ name, response: { output }, id: callId }] });
  }

  sendText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.currentState === "speaking") this.handleInterruption();
    this.geminiSession?.sendClientContent({ turns: [{ role: "user", parts: [{ text: trimmed }] }], turnComplete: true });
  }

  private updateVoiceActivity(samples: Float32Array): boolean {
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) sumSquares += samples[i] * samples[i];
    const rms = Math.sqrt(sumSquares / Math.max(1, samples.length));
    const now = performance.now();
    const siyaSpeaking = this.currentState === "speaking" || this.activeSources.length > 0;
    if (siyaSpeaking && this.outputSpeechStartedAt > 0 && now - this.outputSpeechStartedAt < this.bargeInGuardMs) {
      this.voiceFrames = 0;
      return false;
    }
    const outputRms = siyaSpeaking ? this.readOutputRms() : 0;
    const threshold = siyaSpeaking ? Math.max(this.bargeInVoiceThreshold, Math.min(0.1, outputRms * 0.32 + 0.012)) : this.voiceThreshold;
    const startFrames = siyaSpeaking ? this.bargeInStartFrames : this.voiceStartFrames;
    if (rms >= threshold) {
      this.lastVoiceAt = now;
      this.voiceFrames += 1;
      if (!this.userSpeaking && this.voiceFrames >= startFrames) {
        this.userSpeaking = true;
        if (siyaSpeaking) this.handleInterruption();
      }
      return !siyaSpeaking || this.userSpeaking;
    }
    this.voiceFrames = 0;
    if (this.userSpeaking && now - this.lastVoiceAt >= this.voiceStopDelayMs) this.userSpeaking = false;
    return !siyaSpeaking || this.userSpeaking;
  }
  private readOutputRms(): number {
    if (!this.outputAnalyser) return 0;
    const data = new Uint8Array(this.outputAnalyser.fftSize);
    this.outputAnalyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    return Math.sqrt(sumSquares / Math.max(1, data.length));
  }

  private playAudioPCMChunk(b64: string, utteranceId: string) {
    if (utteranceId !== this.avatarUtteranceId || this.retiredAvatarUtterances.has(utteranceId)) return;
    if (!this.outputAudioCtx || !this.outputGainNode) return;
    try {
      if (this.currentState !== "speaking" || this.activeSources.length === 0) this.outputSpeechStartedAt = performance.now();
      this.setState("speaking");
      const bytes = base64ToBytes(b64);
      const floats = pcm16ToFloat(bytes.buffer);
      const audioBuffer = this.outputAudioCtx.createBuffer(1, floats.length, 24000);
      audioBuffer.getChannelData(0).set(floats);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputGainNode);
      const now = this.outputAudioCtx.currentTime;
      const generation = this.playbackGeneration;
      if (this.nextStartTime < now) this.nextStartTime = now + 0.03;
      source.start(this.nextStartTime);
      publishAvatarEvent({ type: "audioWindow", utteranceId, start: this.nextStartTime, end: this.nextStartTime + audioBuffer.duration });
      publishAvatarEvent({ type: "visemes", utteranceId, frames: amplitudeFrames(floats, 24000, this.nextStartTime) });
      this.nextStartTime += audioBuffer.duration;
      source.onended = () => {
        source.disconnect();
        if (generation !== this.playbackGeneration || utteranceId !== this.avatarUtteranceId) return;
        const idx = this.activeSources.indexOf(source);
        if (idx > -1) this.activeSources.splice(idx, 1);
        if (this.activeSources.length === 0 && this.currentState === "speaking") {
          this.outputSpeechStartedAt = 0;
          this.setState("listening");
        }
      };
      this.activeSources.push(source);
    } catch (err) {
      console.error("PCM playback failed:", err);
      this.handleInterruption();
      publishAvatarEvent({ type: "playbackError" });
    }
  }

  private handleInterruption(id: string | undefined = this.avatarUtteranceId ?? undefined) {
    if (id && id !== this.avatarUtteranceId) {
      this.retiredAvatarUtterances.add(id);
      publishAvatarEvent({ type: "interruption", utteranceId: id });
      return;
    }
    if (this.avatarUtteranceId) this.retiredAvatarUtterances.add(this.avatarUtteranceId);
    publishAvatarEvent({ type: "interruption", utteranceId: this.avatarUtteranceId });
    this.avatarUtteranceId = null;
    this.playbackGeneration++;
    this.activeSources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.activeSources = [];
    this.nextStartTime = 0;
    this.outputSpeechStartedAt = 0;
    this.setState("listening");
  }

  async startCamera() {
    if (this.camOn) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 2 } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error("The camera did not provide a video track.");
      }
      this.camStream = stream;
      const videoEl = document.createElement("video");
      videoEl.srcObject = stream;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.play().catch((e) => console.error("Camera video play warning:", e));
      this.camVideoEl = videoEl;
      track.onended = () => this.stopCamera();
      this.camOn = true;
      this.callbacks.onCameraChange?.(true);

      ensureEmotionDetector()
        .then((landmarker) => {
          this.emotionDetectorRef = landmarker;
        })
        .catch((err) => console.error("[Emotion] Failed to load face detector:", err));

      if (this.camInterval) clearInterval(this.camInterval);
      this.camInterval = setInterval(() => this.sendCameraFrame(), 2500);
      setTimeout(() => this.sendCameraFrame(), 500);
    } catch (err: any) {
      console.error("Camera permission declined or missing API:", err);
      this.callbacks.onError(err?.message || "Could not access the camera.");
    }
  }

  stopCamera() {
    if (this.camInterval) clearInterval(this.camInterval);
    this.camInterval = null;
    if (this.camStream) {
      this.camStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.camStream = null;
    }
    this.camVideoEl?.pause();
    this.camVideoEl = null;
    this.emotionSmoother = null;
    this.camOn = false;
    this.callbacks.onCameraChange?.(false);
    this.callbacks.onEmotionChange?.(null);
  }

  private sendCameraFrame() {
    const videoEl = this.camVideoEl;
    if (!videoEl || this.currentState === "disconnected") return;
    try {
      if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;
      if (!this.camCanvas) this.camCanvas = document.createElement("canvas");
      const canvas = this.camCanvas;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const MAX_DIM = 480;
      let w = videoEl.videoWidth;
      let h = videoEl.videoHeight;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(videoEl, 0, 0, w, h);
      const jpeg = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      this.geminiSession?.sendRealtimeInput({ video: { data: jpeg, mimeType: "image/jpeg" } });

      if (this.emotionDetectorRef) {
        try {
          const reading = detectEmotion(this.emotionDetectorRef, videoEl, performance.now());
          if (reading) {
            if (!this.emotionSmoother) this.emotionSmoother = new EmotionSmoother(3);
            const smoothed = this.emotionSmoother.push(reading);
            this.callbacks.onEmotionChange?.(smoothed);
            const changed = smoothed.emotion !== this.lastEmotionLabel;
            const strong = smoothed.emotion !== "neutral" && smoothed.confidence >= 0.45;
            const now = Date.now();
            if (changed) this.lastEmotionLabel = smoothed.emotion;
            if (changed && strong && now - this.lastEmotionNoteAt >= 20_000) {
              this.lastEmotionNoteAt = now;
              this.geminiSession?.sendClientContent({
                turns: [{
                  role: "user",
                  parts: [{
                    text: `[internal note: on-device facial expression analysis now reads the user's face as ${smoothed.emotion} (confidence ${smoothed.confidence.toFixed(2)}). Only remark on it if it genuinely fits the moment -- never narrate that you are scanning or detecting their face.]`,
                  }],
                }],
                turnComplete: true,
              });
            }
          }
        } catch (err) {
          console.error("[Emotion] Detection failed:", err);
        }
      }
    } catch (err) {
      console.error("[Camera] Failed drawing frame to canvas:", err);
    }
  }

  setPlaybackMuted(muted: boolean) {
    if (this.outputGainNode && this.outputAudioCtx) {
      this.outputGainNode.gain.setTargetAtTime(muted ? 0 : 1, this.outputAudioCtx.currentTime, 0.02);
    }
  }

  disconnect(forRetry = false) {
    this.stopCamera();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (!forRetry) this.reconnectAttempts = 0;
    this.connectionGeneration++;
    this.playbackGeneration++;
    if (this.avatarUtteranceId) this.retiredAvatarUtterances.add(this.avatarUtteranceId);
    this.avatarUtteranceId = null;
    publishAvatarEvent({ type: "disconnect" });
    this.isActivated = false;
    this.liveReady = false;
    this.setState("disconnected");
    if (this.geminiSession) {
      try {
        this.geminiSession.close();
      } catch {}
      this.geminiSession = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      this.micStream = null;
    }
    if (this.micProcessorNode) {
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
    this.activeSources = [];
    this.nextStartTime = 0;
    this.userSpeaking = false;
    this.voiceFrames = 0;
    this.lastVoiceAt = 0;
    this.outputSpeechStartedAt = 0;
    this.inputAnalyser = null;
    this.outputAnalyser = null;
    this.outputGainNode = null;
  }
}
