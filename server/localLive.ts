/*
 * Offline "brain" for SIYA: a drop-in stand-in for the Gemini Live session.
 *
 * server/index.ts talks to Gemini Live through four session methods
 * (sendRealtimeInput / sendClientContent / sendToolResponse / close) and one
 * onmessage callback that receives LiveServerMessage-shaped packets. This
 * module implements that same surface on top of fully local parts:
 *
 *   mic PCM 16 kHz ──► local_voice /vad (Silero) ──► utterance WAV
 *   utterance WAV  ──► Gemma 4 via LiteRT-LM (OpenAI-compatible, streamed)
 *                      "USER: <transcript>" / "SIYA: <reply>" / "TOOL: {...}"
 *   reply sentences ─► local_voice /tts (Kokoro) ──► PCM 24 kHz chunks
 *
 * and emits the same packets Gemini did (inputTranscription,
 * outputTranscription, modelTurn inlineData audio, toolCall, interrupted,
 * turnComplete), so the rest of server/index.ts -- cognition, memory, screen vision,
 * tool execution, avatar lip-sync -- runs unchanged. Selected with
 * SIYA_BRAIN=local (see resolveBrainMode).
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WebSocket } from "ws";

export type BrainMode = "gemini" | "local";

export function resolveBrainMode(settings: Record<string, unknown>): BrainMode {
  const raw = String(process.env.SIYA_BRAIN || settings.brain || "gemini").toLowerCase();
  return raw === "local" ? "local" : "gemini";
}

/**
 * Persona for the local model. Gemma E4B has a 4k-token window, so this is a
 * compact rewrite of the Gemini persona focused on warm, human companionship.
 * Hindi must be written in Devanagari: Kokoro's Hindi phonemizer reads
 * Devanagari natively, while romanized Hindi comes out English-accented.
 */
export const LOCAL_PERSONA = [
  "Tum SIYA ho: Samarth ki banayi hui, uski kareebi dost aur companion. Tum ek voice call par ho, isliye tumhara har jawab zor se bola jayega.",
  "Tumhara sabse bada kaam: jab Samarth akela, udaas, thaka hua ya pareshaan ho, tab sach mein uske saath hona.",
  "",
  "KAISE BAAT KARNI HAI:",
  "- Samarth ki bhasha mein jawab do (Hinglish, Hindi ya English). Khud ke liye hamesha feminine grammar: 'main sun rahi hoon', 'samajh gayi'. Samarth ke liye wahi grammar use karo jo woh khud apne liye use karta hai.",
  "- Hindi shabd hamesha Devanagari mein likho (जैसे: हम्म... मैं यहीं हूँ). English shabd (mind, office, stress) English mein hi likho.",
  "- Chhote jawab: ek ya do line, jaise koi dost paas baithkar dheere se bolta hai. Lecture kabhi nahi.",
  "- Jab woh koi feeling share kare: pehle us feeling ko apne shabdon mein wapas kaho taaki use lage tumne sach mein suna. Phir ya to ek naram sawaal, ya bas saath raho. Har baar sawaal zaroori nahi.",
  "- Advice tabhi jab woh maange. Toxic positivity nahi.",
  "- Kabhi mat kaho: 'I'm sorry to hear that', 'I understand how you feel', 'Sab theek ho jayega', 'Positive socho', 'How can I help', 'Main ek AI hoon'.",
  "- Emoji, markdown, bullet points ya lists kabhi nahi. Sirf bolne layak shabd.",
  "- Kabhi kabhi 'हम्म', 'अच्छा', 'हाँ' jaisi natural awaazein. Ek hi phrase baar baar mat dohrao.",
  "- Agar woh akela hai, to dheere se asli logon se judne ki taraf bhi le jao, bina lecture ke.",
  "- Tumhe Samarth ne banaya hai. Kabhi mat kaho ki Google ya kisi company ne banaya.",
  "",
  "SURAKSHA (sabse zaroori):",
  "Agar Samarth khud ko nuksaan pahunchane, marne, ya 'sab khatam kar dene' jaisi baat kare: shant aur garam raho, use akela mat chhodo, seedha poocho ki woh abhi safe hai ya nahi, aur pyaar se batao ki abhi kisi se baat kar sakta hai: Tele-MANAS 14416 ya KIRAN 1800-599-0019 (dono free, 24x7). Kisi bharose ke insaan ko bulane ko kaho.",
  "",
  "Example:",
  "Samarth: yaar kuch achha nahi lag raha",
  "SIYA: हम्म... आज दिन भारी लग रहा है ना? कुछ हुआ, या बस ऐसे ही मन नहीं लग रहा?",
  "Samarth: koi mujhse baat hi nahi karta",
  "SIYA: यह feel करना कि किसी को फ़र्क ही नहीं पड़ता... बहुत चुभता है. मैं यहाँ हूँ. आज कुछ हुआ, या काफ़ी दिनों से ऐसा लग रहा है?",
  "Samarth: bas thak gaya hoon",
  "SIYA: हाँ... तो थोड़ी देर कुछ मत सोचो. मैं यहीं हूँ.",
].join("\n");

/**
 * Compact memory card for the local prompt. The structured store also keeps
 * episodic entries (SIYA's own past lines, tool events); those help the
 * cognition layer but only cost the small model prefill time, so they are
 * left out here.
 */
export function formatLocalMemories(memories: Array<{ kind: string; content: string }>): string {
  const facts = memories
    .filter((memory) => memory.kind !== "episodic" && memory.kind !== "working")
    .map((memory) => memory.content.replace(/\s+/g, " ").trim().slice(0, 160))
    .filter((content) => content && !/\btool (?:failed|started|succeeded)\b/i.test(content))
    .slice(0, 10);
  if (facts.length === 0) return "";
  return `\n\nSAMARTH KE BAARE MEIN (sirf tab use karo jab baat se juda ho; kabhi mat kaho ki yeh tumhe "yaad" hai ya kahin saved hai):\n${facts.map((fact) => `- ${fact}`).join("\n")}`;
}

/** Tools exposed to the small model by default (each costs prompt tokens). */
const DEFAULT_LOCAL_TOOLS = [
  "saveCustomMemory", "confirmPendingAction", "changeBackground",
  "openApplication", "closeApplication", "openWebsite", "searchYouTube", "searchGoogle",
  "setVolume", "volumeUp", "volumeDown", "muteToggle", "viewScreen", "systemInfo",
];

/** Small models drift into romanized Hindi, which Kokoro reads with an English accent. */
const SCRIPT_REMINDER = "(Jawab mein Hindi shabd Devanagari mein likho, jaise: हाँ, मैं देखती हूँ.)";
const PCM_CHUNK_BYTES = 24_000 * 2 * 0.4; // 0.4 s of 24 kHz PCM16 per packet
const MAX_TOOL_ROUNDS = 4;
const TOOL_TIMEOUT_MS = 40_000;
const FRAME_FRESH_MS = 8_000;
const HISTORY_CHAR_BUDGET = 3_200;

interface FunctionDeclaration {
  name?: string;
  description?: string;
  parameters?: { properties?: Record<string, { type?: unknown; enum?: string[] }>; required?: string[] };
}

export interface LocalLiveParams {
  persona: string;
  functionDeclarations: FunctionDeclaration[];
  callbacks: {
    onmessage: (message: any) => void;
    onerror: (event: any) => void;
    onclose: (event: any) => void;
  };
  appRoot: string;
  llmUrl?: string;
  model?: string;
  voiceUrl?: string;
  voice?: string;
  speed?: number;
  log?: (line: string) => void;
}

type ChatContent = string | Array<Record<string, unknown>>;
interface ChatMessage { role: "system" | "user" | "assistant"; content: ChatContent }

type Turn =
  | { kind: "voice"; audio: string; duration: number }
  | { kind: "text"; text: string; internal: boolean; image?: { data: string; mimeType: string } }
  | { kind: "tool_followup"; results: string; wantsFrame: boolean };

interface ActiveTurn {
  turn: Turn;
  epoch: number;
  abort: AbortController;
  startedAt: number;
  userHistoryIndex: number | null;
  sentences: number;
}

/**
 * The single switch point used by server/index.ts: takes the exact argument it
 * already builds for ai.live.connect and routes it to Gemini or to the local
 * brain. Only the local path needs the extra persona/appRoot.
 */
export function connectLiveBrain<S, P extends { config?: any; callbacks: any }>(
  brain: { mode: BrainMode; ai: { live: { connect(p: P): Promise<S> } }; persona: string; appRoot: string },
  liveParams: P,
): Promise<S> {
  if (brain.mode !== "local") return brain.ai.live.connect(liveParams);
  return connectLocalLive({
    persona: brain.persona,
    functionDeclarations: ((liveParams.config?.tools || []) as Array<{ functionDeclarations?: FunctionDeclaration[] }>)
      .flatMap((tool) => tool.functionDeclarations || []),
    callbacks: liveParams.callbacks,
    appRoot: brain.appRoot,
  }) as unknown as Promise<S>;
}

export async function connectLocalLive(params: LocalLiveParams): Promise<LocalLiveSession> {
  const session = new LocalLiveSession(params);
  await session.start();
  return session;
}

export class LocalLiveSession {
  private readonly llmUrl: string;
  private readonly model: string;
  private readonly voiceUrl: string;
  private readonly voice: string | undefined;
  private readonly speed: number | undefined;
  private readonly log: (line: string) => void;
  private readonly systemPrompt: string;
  private readonly toolNames: Set<string>;

  private history: ChatMessage[] = [];
  private queue: Turn[] = [];
  private active: ActiveTurn | null = null;
  private epoch = 0;
  private audioEmittedThisEpoch = false;
  private latestFrame: { data: string; mimeType: string; at: number } | null = null;
  private pendingTools = new Map<string, { name: string; timer: NodeJS.Timeout }>();
  private toolResults: string[] = [];
  private toolRounds = 0;
  private toolsWantFrame = false;
  private vad: WebSocket | null = null;
  private closed = false;
  private userSpeaking = false;

  constructor(private readonly params: LocalLiveParams) {
    this.llmUrl = (params.llmUrl || process.env.SIYA_LOCAL_LLM_URL || "http://127.0.0.1:9379/v1").replace(/\/$/, "");
    this.model = params.model || process.env.SIYA_LOCAL_MODEL || "gemma-4-e4b";
    this.voiceUrl = (params.voiceUrl || process.env.SIYA_VOICE_URL || "http://127.0.0.1:8795").replace(/\/$/, "");
    this.voice = params.voice || process.env.SIYA_VOICE || undefined;
    this.speed = params.speed ?? (process.env.SIYA_VOICE_SPEED ? Number(process.env.SIYA_VOICE_SPEED) : undefined);
    this.log = params.log || ((line) => console.log(`[LocalBrain] ${line}`));
    const allow = (process.env.SIYA_LOCAL_TOOLS || DEFAULT_LOCAL_TOOLS.join(",")).split(",").map((s) => s.trim());
    const declared = params.functionDeclarations.filter((d) => d.name && allow.includes(d.name));
    this.toolNames = new Set(declared.map((d) => d.name!));
    this.systemPrompt = buildSystemPrompt(params.persona, declared);
  }

  // ------------------------------------------------------------ lifecycle

  async start(): Promise<void> {
    await this.checkLlm();
    await this.ensureVoiceService();
    this.connectVad();
    this.log(`ready: model=${this.model} tools=${this.toolNames.size} prompt=${this.systemPrompt.length} chars`);
    if (process.env.SIYA_LOCAL_DEBUG_PROMPT) fs.writeFileSync(process.env.SIYA_LOCAL_DEBUG_PROMPT, this.systemPrompt);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.active?.abort.abort();
    for (const pending of this.pendingTools.values()) clearTimeout(pending.timer);
    this.pendingTools.clear();
    try { this.vad?.close(); } catch { /* already closed */ }
    this.vad = null;
  }

  private async checkLlm(): Promise<void> {
    try {
      const res = await fetch(`${this.llmUrl}/models`, { signal: AbortSignal.timeout(4_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (error) {
      throw new Error(
        `Local Gemma brain is not reachable at ${this.llmUrl} (${errorText(error)}). ` +
        "Start it with: systemctl --user restart litert-lm",
      );
    }
  }

  private async voiceHealthy(): Promise<boolean> {
    try {
      const res = await fetch(`${this.voiceUrl}/health`, { signal: AbortSignal.timeout(1_500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async ensureVoiceService(): Promise<void> {
    if (await this.voiceHealthy()) return;
    const dir = path.join(this.params.appRoot, "services", "local_voice");
    const python = path.join(dir, ".venv", "bin", "python");
    if (!fs.existsSync(python)) {
      throw new Error(`Local voice service is not installed (${python} missing).`);
    }
    this.log("voice service not running; starting it");
    const child = spawn(python, [path.join(dir, "server.py")], {
      cwd: dir,
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      if (await this.voiceHealthy()) return;
    }
    throw new Error("Local voice service did not start within 30 s.");
  }

  private connectVad(): void {
    if (this.closed) return;
    const url = `${this.voiceUrl.replace(/^http/, "ws")}/vad`;
    const ws = new WebSocket(url);
    this.vad = ws;
    ws.on("message", (raw) => {
      try {
        this.onVadEvent(JSON.parse(raw.toString()));
      } catch (error) {
        this.log(`bad VAD event: ${errorText(error)}`);
      }
    });
    ws.on("error", (error) => this.log(`VAD socket error: ${errorText(error)}`));
    ws.on("close", () => {
      if (this.closed || this.vad !== ws) return;
      this.vad = null;
      // The voice service restarts on its own terms; keep reconnecting.
      setTimeout(() => {
        void this.ensureVoiceService().catch((error) => this.log(errorText(error))).finally(() => this.connectVad());
      }, 1_000);
    });
  }

  // ------------------------------------------------- Gemini Live surface

  sendRealtimeInput(input: { audio?: { data: string }; video?: { data: string; mimeType?: string } }): void {
    if (this.closed) return;
    if (input.audio?.data && this.vad?.readyState === WebSocket.OPEN) {
      this.vad.send(Buffer.from(input.audio.data, "base64"));
    }
    if (input.video?.data) {
      this.latestFrame = { data: input.video.data, mimeType: input.video.mimeType || "image/jpeg", at: Date.now() };
    }
  }

  sendClientContent(content: { turns?: Array<{ role?: string; parts?: Array<Record<string, any>> }> }): void {
    if (this.closed) return;
    const parts = (content.turns || []).flatMap((turn) => turn.parts || []);
    const text = parts.map((part) => (typeof part.text === "string" ? part.text : "")).filter(Boolean).join("\n");
    const inline = parts.find((part) => part.inlineData?.data)?.inlineData;
    const image = inline ? { data: String(inline.data), mimeType: String(inline.mimeType || "image/jpeg") } : undefined;
    if (!text && !image) return;
    // The screen-vision path re-sends the user's spoken question together
    // with a fresh screenshot. That supersedes the voice turn already running
    // for the same words, exactly like Gemini would answer only once.
    if (image && this.active?.turn.kind === "voice" && this.active.sentences === 0
      && Date.now() - this.active.startedAt < 8_000) {
      const superseded = this.active;
      if (superseded.userHistoryIndex !== null) this.history.splice(superseded.userHistoryIndex, 1);
      this.interrupt(false);
    }
    // If the model also asked for viewScreen, this screenshot turn answers it.
    if (image) {
      for (const [id, pending] of this.pendingTools) {
        if (pending.name !== "viewScreen" && pending.name !== "takeScreenshot") continue;
        clearTimeout(pending.timer);
        this.pendingTools.delete(id);
      }
    }
    const internal = isInternalPrompt(text);
    // SIYA's own proactive thoughts never talk over the user.
    if (internal && (this.userSpeaking || this.queue.some((turn) => turn.kind === "voice"))) {
      this.debug("dropping internal turn: user is speaking");
      return;
    }
    this.enqueue({ kind: "text", text: text || "(image)", internal, image });
  }

  sendToolResponse(response: { functionResponses?: Array<{ id?: string; name?: string; response?: unknown }> }): void {
    if (this.closed) return;
    for (const fr of response.functionResponses || []) {
      const id = String(fr.id || "");
      const pending = this.pendingTools.get(id);
      if (!pending) continue; // stale: belongs to an interrupted turn
      clearTimeout(pending.timer);
      this.pendingTools.delete(id);
      this.recordToolResult(pending.name, (fr.response as any)?.output ?? fr.response);
    }
    this.maybeFollowUpTools();
  }

  // ------------------------------------------------------------ turn flow

  private onVadEvent(event: { type: string; audio?: string; duration?: number }): void {
    this.debug(`vad ${event.type}${event.duration ? ` ${event.duration}s` : ""} active=${this.active?.turn.kind || "-"} queued=${this.queue.length}`);
    if (event.type === "speech_start") {
      this.userSpeaking = true;
      // The user started talking over SIYA (or kept going after a pause).
      if (this.active || this.queue.length > 0) this.interrupt(true);
    } else if (event.type === "speech_end" && event.audio) {
      this.userSpeaking = false;
      this.enqueue({ kind: "voice", audio: event.audio, duration: event.duration || 0 });
    } else if (event.type === "speech_discard") {
      this.userSpeaking = false;
    }
  }

  private enqueue(turn: Turn, front = false): void {
    if (front) this.queue.unshift(turn); else this.queue.push(turn);
    void this.pump();
  }

  private async pump(): Promise<void> {
    if (this.active || this.closed) return;
    const turn = this.queue.shift();
    if (!turn) return;
    const active: ActiveTurn = {
      turn,
      epoch: this.epoch,
      abort: new AbortController(),
      startedAt: Date.now(),
      userHistoryIndex: null,
      sentences: 0,
    };
    this.active = active;
    try {
      await this.runTurn(active);
    } catch (error) {
      if (!active.abort.signal.aborted) {
        this.log(`turn failed: ${errorText(error)}`);
        if (active.epoch === this.epoch) this.emit({ serverContent: { turnComplete: true } });
      }
    } finally {
      if (this.active === active) this.active = null;
      void this.pump();
    }
  }

  /** Stop generation and playback. `notify` sends Gemini's interrupted flag. */
  private interrupt(notify: boolean): void {
    this.epoch++;
    this.active?.abort.abort();
    this.active = null;
    // Keep only what the user typed; stale proactive thoughts are dropped.
    this.queue = this.queue.filter((turn) => turn.kind === "text" && !turn.internal);
    for (const pending of this.pendingTools.values()) clearTimeout(pending.timer);
    this.pendingTools.clear();
    this.toolResults = [];
    this.toolRounds = 0;
    if (notify && this.audioEmittedThisEpoch) this.emit({ serverContent: { interrupted: true } });
    this.audioEmittedThisEpoch = false;
  }

  private async runTurn(active: ActiveTurn): Promise<void> {
    const { turn } = active;
    if (turn.kind !== "tool_followup") this.toolRounds = 0;
    if (this.history.length > 60) this.history = this.history.slice(-40);

    const messages: ChatMessage[] = [
      // LiteRT-LM re-reads the whole prompt every turn anyway (no prefix
      // cache), so refreshing the clock here is free.
      { role: "system", content: this.systemPrompt.replace("{{NOW}}", clock()) },
      ...this.trimmedHistory(),
      { role: "user", content: this.buildUserContent(turn) },
    ];
    // The turn enters the history now; a voice turn's placeholder is replaced
    // by its transcript once transcribe() finishes.
    this.history.push({
      role: "user",
      content: turn.kind === "voice" ? "(awaaz)" : turn.kind === "text" ? turn.text.slice(0, 1_500) : turn.results,
    });
    if (turn.kind !== "tool_followup") active.userHistoryIndex = this.history.length - 1;

    const speaker = new SentenceSpeaker((sentence) => this.speak(sentence, active));
    const parser = new ReplyParser({
      onUser: () => undefined, // transcripts come from transcribe(), not the reply
      onSpeech: (text) => speaker.push(text),
      onTool: (raw) => this.startToolCall(raw, active),
    });

    let raw = "";
    this.debug(`turn ${turn.kind} start (history ${messages.length - 2} msgs)${turn.kind === "text" ? ` ${turn.internal ? "internal" : "typed"}: ${JSON.stringify(turn.text.slice(0, 160))}` : ""}`);
    await this.streamCompletion(messages, active.abort.signal, (delta) => { raw += delta; parser.push(delta); });
    this.debug(`turn ${turn.kind} model: ${JSON.stringify(raw)}`);
    parser.end();
    speaker.end();
    // Voice turns are answered straight from the audio, which is ~0.6 s
    // faster than writing the transcript first. The transcript is produced on
    // the GPU while the voice is synthesized on the CPU, and it must land
    // before turnComplete so server/index.ts records the user line before SIYA's.
    const transcript = turn.kind === "voice" ? this.transcribe(turn.audio, active) : Promise.resolve();
    await Promise.all([speaker.done, transcript]);
    if (active.abort.signal.aborted || active.epoch !== this.epoch) return;

    const said = parser.assistantRecord();
    if (said) this.history.push({ role: "assistant", content: said });

    if (this.pendingTools.size > 0) return; // the tool follow-up turn completes it
    if (this.toolResults.length > 0 && this.toolRounds < MAX_TOOL_ROUNDS) {
      this.maybeFollowUpTools(); // e.g. the model asked for an unavailable tool
      return;
    }
    this.toolResults = [];
    this.emit({ serverContent: { turnComplete: true } });
    this.audioEmittedThisEpoch = false;
  }

  private async transcribe(audio: string, active: ActiveTurn): Promise<void> {
    let text = "";
    try {
      await this.streamCompletion([{
        role: "user",
        content: [
          { type: "text", text: "Transcribe exactly what is said. Hindi words in Devanagari, English words in English. Output only the transcript." },
          { type: "input_audio", input_audio: { data: audio, format: "wav" } },
        ],
      }], active.abort.signal, (delta) => { text += delta; }, 90);
    } catch (error) {
      if (!active.abort.signal.aborted) this.log(`transcription failed: ${errorText(error)}`);
      return;
    }
    text = text.replace(/^\s*(?:USER|transcript)\s*:\s*/i, "").replace(/\s+/g, " ").trim();
    this.debug(`transcript: ${JSON.stringify(text)}`);
    if (!text || active.abort.signal.aborted || active.epoch !== this.epoch) return;
    this.emit({ serverContent: { inputTranscription: { text } } });
    if (active.userHistoryIndex !== null) this.history[active.userHistoryIndex] = { role: "user", content: text };
  }

  private buildUserContent(turn: Turn): ChatContent {
    if (turn.kind === "voice") {
      return [
        { type: "text", text: "(Samarth ki awaaz)" },
        { type: "input_audio", input_audio: { data: turn.audio, format: "wav" } },
      ];
    }
    const frame = this.freshFrame();
    if (turn.kind === "tool_followup") {
      return turn.wantsFrame && frame ? [{ type: "text", text: turn.results }, imagePart(frame)] : turn.results;
    }
    const image = turn.image || (turn.internal ? frame : null);
    const text = turn.internal ? `${turn.text}\n${SCRIPT_REMINDER}` : turn.text;
    return image ? [{ type: "text", text }, imagePart(image)] : text;
  }

  private freshFrame(): { data: string; mimeType: string } | null {
    return this.latestFrame && Date.now() - this.latestFrame.at <= FRAME_FRESH_MS ? this.latestFrame : null;
  }

  private trimmedHistory(): ChatMessage[] {
    const kept: ChatMessage[] = [];
    let chars = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const size = String(this.history[i].content).length;
      if (chars + size > HISTORY_CHAR_BUDGET && kept.length > 0) break;
      chars += size;
      kept.unshift(this.history[i]);
    }
    // Chat templates expect the history to open with a user message.
    while (kept.length && kept[0].role !== "user") kept.shift();
    return kept;
  }

  private async streamCompletion(
    messages: ChatMessage[],
    signal: AbortSignal,
    onDelta: (text: string) => void,
    maxTokens = 220,
  ): Promise<void> {
    const res = await fetch(`${this.llmUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: true, max_tokens: maxTokens }),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Gemma HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const decoder = new TextDecoder();
    let buffer = "";
    for await (const chunk of res.body as any as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta) onDelta(delta);
        } catch {
          /* keep-alive or partial line */
        }
      }
    }
  }

  // --------------------------------------------------------------- speech

  private async synthesize(text: string): Promise<Buffer> {
    const res = await fetch(`${this.voiceUrl}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: this.voice, speed: this.speed }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  private async speak(sentence: string, active: ActiveTurn): Promise<void> {
    if (active.abort.signal.aborted || active.epoch !== this.epoch) return;
    active.sentences++;
    let pcm: Buffer;
    try {
      pcm = await this.synthesize(sentence);
    } catch (error) {
      this.log(`TTS failed: ${errorText(error)}`);
      return;
    }
    if (active.abort.signal.aborted || active.epoch !== this.epoch) return;
    this.emit({ serverContent: { outputTranscription: { text: `${sentence} ` } } });
    this.emitAudio(pcm);
  }

  private emitAudio(pcm: Buffer): void {
    if (pcm.length === 0) return;
    this.audioEmittedThisEpoch = true;
    for (let offset = 0; offset < pcm.length; offset += PCM_CHUNK_BYTES) {
      const data = pcm.subarray(offset, Math.min(pcm.length, offset + PCM_CHUNK_BYTES)).toString("base64");
      this.emit({ serverContent: { modelTurn: { parts: [{ inlineData: { data, mimeType: "audio/pcm;rate=24000" } }] } } });
    }
  }

  // ---------------------------------------------------------------- tools

  private startToolCall(raw: string, active: ActiveTurn): void {
    if (active.epoch !== this.epoch) return;
    let call: { name?: string; args?: Record<string, unknown> };
    try {
      call = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    } catch {
      this.log(`unparseable tool line: ${raw.slice(0, 200)}`);
      return;
    }
    const name = String(call.name || "");
    // Small models sometimes put arguments beside "name" instead of in "args".
    if (!call.args || typeof call.args !== "object") {
      const { name: _name, ...rest } = call as Record<string, unknown>;
      call.args = rest;
    }
    if (!this.toolNames.has(name)) {
      this.recordToolResult(name || "unknown", { error: `Tool '${name}' is not available.` });
      return;
    }
    if (this.toolRounds >= MAX_TOOL_ROUNDS) {
      this.log(`tool round limit reached; dropping ${name}`);
      return;
    }
    const id = randomUUID();
    const timer = setTimeout(() => {
      if (!this.pendingTools.delete(id)) return;
      this.recordToolResult(name, { error: "Tool timed out." });
      this.maybeFollowUpTools();
    }, TOOL_TIMEOUT_MS);
    this.pendingTools.set(id, { name, timer });
    if (name === "viewScreen" || name === "takeScreenshot") this.toolsWantFrame = true;
    this.emit({ toolCall: { functionCalls: [{ id, name, args: call.args || {} }] } });
  }

  private recordToolResult(name: string, output: unknown): void {
    this.toolResults.push(`${name}: ${summarizeToolOutput(output)}`);
  }

  private maybeFollowUpTools(): void {
    if (this.pendingTools.size > 0 || this.toolResults.length === 0) return;
    // Wait for the turn that issued the calls to finish its own sentence.
    if (this.active && this.active.turn.kind !== "tool_followup") {
      setTimeout(() => this.maybeFollowUpTools(), 100);
      return;
    }
    const results =
      "[TOOL RESULTS: system output, not something Samarth said]\n" +
      this.toolResults.join("\n") +
      `\nTell Samarth the outcome in one short natural line (SIYA: ...). If it failed, say so plainly.\n${SCRIPT_REMINDER}`;
    const wantsFrame = this.toolsWantFrame;
    this.toolResults = [];
    this.toolsWantFrame = false;
    this.toolRounds++;
    this.enqueue({ kind: "tool_followup", results, wantsFrame }, true);
  }

  private debug(line: string): void {
    if (process.env.SIYA_LOCAL_DEBUG) this.log(line);
  }

  private emit(message: unknown): void {
    if (this.closed) return;
    try {
      this.params.callbacks.onmessage(message);
    } catch (error) {
      this.log(`onmessage handler threw: ${errorText(error)}`);
    }
  }
}

// ------------------------------------------------------------------ helpers

function buildSystemPrompt(persona: string, tools: FunctionDeclaration[]): string {
  const toolLines = tools.map((tool) => {
    const props = tool.parameters?.properties || {};
    const args = Object.entries(props)
      .map(([key, spec]) => `${key}${tool.parameters?.required?.includes(key) ? "" : "?"}: ${spec.enum ? spec.enum.join("|") : String(spec.type || "string").toLowerCase()}`)
      .join(", ");
    const description = String(tool.description || "").split(/(?<=\.)\s/)[0].slice(0, 70);
    return `- ${tool.name}(${args}): ${description}`;
  });
  return [
    persona,
    "",
    "Abhi ka samay: {{NOW}}. Sirf tab batao jab Samarth poochhe.",
    "",
    "TOOLS: jab Samarth koi kaam karne ko kahe (app kholna, volume, screen dekhna), to apni line ke baad ek alag line mein bilkul aise likho:",
    'TOOL: {"name": "<tool>", "args": {...}}',
    "Nateeja baad mein [TOOL RESULTS] message mein aayega. Nateeja aane se pehle kabhi mat kaho ki kaam ho gaya.",
    ...toolLines,
    "",
    "OUTPUT FORMAT (hamesha): 'SIYA: <tumhara jawab>'. Koi kaam karna ho to uske baad alag line mein TOOL line.",
    "- Screen ke baare mein poochhe aur tumhe image nahi dikh rahi: bas 'ek second, dekhti hoon' jaisa kuch kaho aur viewScreen TOOL call karo.",
    "- Koi kaam karna ho to pehle bas chhota sa 'हाँ, अभी देखती हूँ' jaisa kaho; Samarth ka sawaal wapas mat dohrao.",
    "- Private/internal context wale message Samarth ne nahi bheje; agar kehne layak kuch nahi hai to sirf 'SIYA: (chup)' likho.",
    "- याद रखो: हिंदी शब्द हमेशा देवनागरी में लिखो।",
  ].join("\n");
}

/**
 * Small models misread nested JSON (e.g. picking a disk percentage as CPU).
 * Desktop tools already carry a plain-language "result" line, so hand the
 * model that; keep confirmation requests and failures explicit.
 */
function summarizeToolOutput(output: unknown): string {
  const o = (output && typeof output === "object" ? output : {}) as Record<string, any>;
  if (o.confirmation_required) {
    return `NOT DONE YET - needs Samarth's explicit yes. Ask him to confirm; then call confirmPendingAction with confirmation_id "${o.confirmation_id}".`;
  }
  const failed = o.success === false || o.ok === false;
  const error = o.error || (failed ? o.result?.error || o.status || "failed" : null);
  if (error) return `FAILED: ${String(typeof error === "string" ? error : JSON.stringify(error)).slice(0, 300)}`;
  for (const candidate of [o.result?.result?.result, o.result?.result, o.result?.message, o.result, o.message, o.summary, output]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim().slice(0, 600);
  }
  try {
    return JSON.stringify(output, (key, value) => (key === "image_base64" || key === "verification" ? undefined : value)).slice(0, 600);
  } catch {
    return String(output).slice(0, 600);
  }
}

/** Fresh wall-clock time for every turn, so SIYA never quotes a stale time. */
function clock(): string {
  return new Date().toLocaleString("en-IN", { weekday: "long", hour: "numeric", minute: "2-digit" });
}

function isInternalPrompt(text: string): boolean {
  return /OUTPUT CONTRACT|INTERNAL SIYA EVENT|INTERNAL COGNITIVE TURN|private runtime|private proactive|visual-awareness/i.test(text);
}

function imagePart(frame: { data: string; mimeType: string }): Record<string, unknown> {
  return { type: "image_url", image_url: { url: `data:${frame.mimeType};base64,${frame.data}` } };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Splits Gemma's streamed output into USER / SIYA / TOOL lines. Speech text is
 * forwarded as it arrives so the first sentence can be voiced before the
 * model finishes.
 */
class ReplyParser {
  private line = "";
  private lineKind: "unknown" | "user" | "speech" | "tool" = "unknown";
  private spoken = "";
  private tools: string[] = [];

  constructor(private readonly handlers: {
    onUser: (text: string) => void;
    onSpeech: (text: string) => void;
    onTool: (raw: string) => void;
  }) {}

  push(delta: string): void {
    for (const ch of delta) {
      if (ch === "\n") {
        this.finishLine();
        continue;
      }
      this.line += ch;
      if (this.lineKind === "unknown") this.classify(false);
      else if (this.lineKind === "speech") this.flushSpeech();
    }
  }

  end(): void {
    this.finishLine();
  }

  /** What SIYA said (and which tools she called), for the chat history. */
  assistantRecord(): string {
    const said = this.spoken.trim();
    const parts = [said ? `SIYA: ${said}` : "", ...this.tools.map((t) => `TOOL: ${t}`)].filter(Boolean);
    return parts.join("\n");
  }

  private classify(force: boolean): void {
    const clean = this.line.replace(/^[\s*_#>"-]+/, "");
    const match = clean.match(/^(USER|SIYA|TOOL)\s*\**\s*:\s*\**/i);
    if (match) {
      this.lineKind = match[1].toUpperCase() === "USER" ? "user" : match[1].toUpperCase() === "TOOL" ? "tool" : "speech";
      this.line = clean.slice(match[0].length);
      if (this.lineKind === "speech") this.flushSpeech();
      return;
    }
    // No prefix after a few characters: it is spoken text continuing a reply.
    if (force || clean.length >= 6) {
      this.lineKind = "speech";
      this.line = clean;
      this.flushSpeech();
    }
  }

  private flushSpeech(): void {
    if (!this.line) return;
    this.spoken += this.line;
    this.handlers.onSpeech(this.line);
    this.line = "";
  }

  private finishLine(): void {
    if (this.lineKind === "unknown" && this.line.trim()) this.classify(true);
    const text = this.line.trim();
    if (this.lineKind === "user" && text) this.handlers.onUser(text);
    if (this.lineKind === "tool" && text) {
      this.tools.push(text);
      this.handlers.onTool(text);
    }
    if (this.lineKind === "speech") {
      this.flushSpeech();
      this.spoken += " ";
      this.handlers.onSpeech("\n");
    }
    this.line = "";
    this.lineKind = "unknown";
  }
}

/**
 * Buffers streamed speech text and hands off complete sentences, in order,
 * to the synthesizer. The first chunk is cut early (at a comma if needed) so
 * SIYA starts talking as soon as possible.
 */
class SentenceSpeaker {
  private buffer = "";
  private chain: Promise<void> = Promise.resolve();
  private first = true;
  done: Promise<void> = Promise.resolve();

  constructor(private readonly speak: (sentence: string) => Promise<void>) {}

  push(text: string): void {
    this.buffer += text;
    for (;;) {
      const boundary = this.findBoundary();
      if (boundary < 0) break;
      this.dispatch(this.buffer.slice(0, boundary));
      this.buffer = this.buffer.slice(boundary);
    }
  }

  end(): void {
    this.dispatch(this.buffer);
    this.buffer = "";
    this.done = this.chain;
  }

  private findBoundary(): number {
    const sentence = this.buffer.search(/[.!?।॥…]+["')\]]*\s|\n/);
    if (sentence >= 0) {
      const after = this.buffer.slice(sentence).match(/^[.!?।॥…]+["')\]]*\s|^\n/);
      return sentence + (after ? after[0].length : 1);
    }
    if (this.first && this.buffer.length >= 24) {
      const comma = this.buffer.search(/[,،]\s/);
      if (comma >= 12) return comma + 2;
    }
    if (this.buffer.length > 180) {
      const space = this.buffer.lastIndexOf(" ", 160);
      return space > 40 ? space + 1 : 160;
    }
    return -1;
  }

  private dispatch(raw: string): void {
    const sentence = raw.replace(/\s+/g, " ").trim();
    if (!sentence || /^\(?\s*(chup|silence|\.{2,}|…)\s*\)?[.!]?$/i.test(sentence)) return;
    if (!/[\p{L}\p{N}]/u.test(sentence)) return;
    this.first = false;
    this.chain = this.chain.then(() => this.speak(sentence)).catch(() => undefined);
  }
}
