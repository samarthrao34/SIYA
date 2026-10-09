/**
 * SIYA — privacy gates for screen content and desktop activity.
 *
 * Two user-controlled features decide what the desktop agent (and Electron's
 * screen capture) may hand to the conversation model:
 *
 *  - Screen access: only while the user has Share screen switched on (and not
 *    paused) in a connected live session. Never persisted; every launch and
 *    every reconnect starts with it off.
 *  - Activity awareness: a saved setting, off by default. Without it, no app
 *    names, window titles or desktop observations reach the model.
 *
 * Every call to the desktop agent goes through `createGatedAgentCaller`, which
 * is the single choke point for agent tools, Electron capture, the
 * screen-vision pipeline, proactive check-ins and /api/screen-vision. A
 * capture that is still in flight when screen access ends is discarded, so a
 * frame taken outside the authorised window is never returned.
 */

/** Tools whose result contains screen pixels or text read off the screen. */
export const SCREEN_CONTENT_TOOLS: ReadonlySet<string> = new Set([
  "takeScreenshot",
  "saveScreenshot",
  "analyzeScreenshot",
  "readScreen",
  "viewScreen",
  "locateText",
  "clickText",
  "waitForUi",
]);

/** Tools whose purpose is to report which apps and windows are open. */
export const ACTIVITY_TOOLS: ReadonlySet<string> = new Set([
  "getActiveWindow",
  "listVisibleWindows",
  "observeDesktopState",
]);

export type AgentResult = { ok: boolean; result?: unknown; error?: string; blocked?: "screen" | "activity" };
/** Which live session a call is made for. Screen tools need one that is sharing. */
export interface AgentCallContext {
  connectionId?: string;
}
export type AgentCall = (
  tool: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
  context?: AgentCallContext,
) => Promise<AgentResult>;

export const SCREEN_OFF_MESSAGE =
  "Screen access is off. SIYA can only see the screen while the user has Share screen switched on. " +
  "Ask the user to click Share screen if they want you to look.";
export const SCREEN_REVOKED_MESSAGE =
  "Screen sharing was switched off while the capture was running, so the capture was discarded.";
export const ACTIVITY_OFF_MESSAGE =
  "Activity awareness is off, so app names and window titles are not available. " +
  "The user can turn it on in Privacy & your data.";

export class PrivacyControls {
  /** connectionId -> whether that live session currently shares its screen. */
  private readonly screenShares = new Map<string, boolean>();
  /** Per session, bumped on every change; in-flight captures compare it. */
  private readonly screenEpochs = new Map<string, number>();
  private readonly listeners = new Set<() => void>();

  constructor(private readonly activityAwarenessEnabled: () => boolean) {}

  setScreenShare(connectionId: string, active: boolean): void {
    if (active) this.screenShares.set(connectionId, true);
    else this.screenShares.delete(connectionId);
    this.bumpEpoch(connectionId);
    this.notify();
  }

  /** A live session ended: whatever it was sharing stops counting. */
  endConnection(connectionId: string): void {
    this.screenShares.delete(connectionId);
    this.bumpEpoch(connectionId);
    this.notify();
  }

  private bumpEpoch(connectionId: string): void {
    this.screenEpochs.set(connectionId, (this.screenEpochs.get(connectionId) || 0) + 1);
  }

  isScreenShareActive(connectionId: string): boolean {
    return this.screenShares.get(connectionId) === true;
  }

  /** Any session sharing (for status display only, never for authorisation). */
  isScreenAccessActive(): boolean {
    for (const active of this.screenShares.values()) if (active) return true;
    return false;
  }

  isActivityAwarenessActive(): boolean {
    return this.activityAwarenessEnabled();
  }

  currentScreenEpoch(connectionId: string): number {
    return this.screenEpochs.get(connectionId) || 0;
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {
        /* a listener must never break a privacy state change */
      }
    }
  }
}

const IDENTIFYING_KEY = /title|window|application|app_?name|process|class/i;

/**
 * Agent tools whose result *text* names the window they acted on, with no
 * separate field to redact (services/desktop_agent/tools_windows.py and
 * tools_targeting.py). Without activity awareness their text is replaced.
 */
export const TITLE_IN_TEXT_TOOLS: Readonly<Record<string, string>> = {
  minimizeWindow: "Minimized the window.",
  maximizeWindow: "Maximized the window.",
  closeWindow: "Closed the window.",
  switchApplication: "Switched to the requested app.",
  locateText: "Located the visible label.",
  clickText: "Clicked the visible label.",
};

/**
 * Removes window titles and app names from a tool result. Structured fields
 * whose names identify a window or app are dropped, and their values are
 * masked wherever they also appear inside text fields.
 */
export function redactActivity(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const hidden: string[] = [];
  const collect = (value: unknown) => {
    if (typeof value === "string" && value.trim().length >= 2) hidden.push(value.trim());
    else if (value && typeof value === "object") for (const inner of Object.values(value)) collect(inner);
  };
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (IDENTIFYING_KEY.test(key)) collect(inner);
      else out[key] = strip(inner);
    }
    return out;
  };
  const stripped = strip(result);
  const mask = (value: unknown): unknown => {
    if (typeof value === "string") {
      let text = value;
      for (const secret of hidden.sort((a, b) => b.length - a.length)) text = text.split(secret).join("[hidden]");
      return text;
    }
    if (Array.isArray(value)) return value.map(mask);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, mask(v)]));
    }
    return value;
  };
  return mask(stripped);
}

/**
 * Wraps the raw desktop-agent caller so screen and activity gates apply to
 * every path that reaches the agent. Screen tools are authorised per session:
 * only a call made for a session that is sharing may capture, and only that
 * session receives the result.
 */
export function createGatedAgentCaller(raw: AgentCall, controls: PrivacyControls): AgentCall {
  return async (tool, args, signal, context) => {
    const connectionId = context?.connectionId;
    const isScreenTool = SCREEN_CONTENT_TOOLS.has(tool);
    if (isScreenTool && !(connectionId && controls.isScreenShareActive(connectionId))) {
      return { ok: false, error: SCREEN_OFF_MESSAGE, blocked: "screen" };
    }
    if (ACTIVITY_TOOLS.has(tool) && !controls.isActivityAwarenessActive()) {
      return { ok: false, error: ACTIVITY_OFF_MESSAGE, blocked: "activity" };
    }
    const epoch = connectionId ? controls.currentScreenEpoch(connectionId) : 0;
    const response = await raw(tool, args, signal, context);
    if (isScreenTool && connectionId) {
      if (controls.currentScreenEpoch(connectionId) !== epoch || !controls.isScreenShareActive(connectionId)) {
        return { ok: false, error: SCREEN_REVOKED_MESSAGE, blocked: "screen" };
      }
    }
    if (!controls.isActivityAwarenessActive() && response.ok) {
      let result = redactActivity(response.result);
      const neutral = TITLE_IN_TEXT_TOOLS[tool];
      if (neutral && result && typeof result === "object" && typeof (result as Record<string, unknown>).result === "string") {
        result = { ...(result as Record<string, unknown>), result: neutral };
      }
      return { ...response, result };
    }
    return response;
  };
}

/** Whether a URL points at this machine (used to label local-mode traffic). */
export function isLoopbackUrl(value: string | undefined): boolean {
  if (!value) return true;
  try {
    const host = new URL(value).hostname.replace(/^\[|\]$/g, "");
    return host === "localhost" || host === "::1" || /^127\./.test(host);
  } catch {
    return false;
  }
}

export interface PrivacyStatus {
  encrypted: boolean;
  brain: "gemini" | "local";
  /** TypeSafe receives the user's words (Gemini mode only). */
  textEmotion: boolean;
  /** Share screen is on in a connected session right now. */
  screenShareActive: boolean;
  /** Saved setting, gated by SIYA_ENABLE_DESKTOP_AWARENESS. */
  activityAwareness: boolean;
  activityAwarenessAllowed: boolean;
  localVoiceEngine: string;
  localModelOnDevice: boolean;
  localVoiceOnDevice: boolean;
  /** Gemini key saved: goal planning uses Gemini even in local mode. */
  planningUsesGemini: boolean;
  /** Local mode only: services off this device that still receive data. */
  externalInLocalMode: string[];
}

export function buildPrivacyStatus(input: {
  encrypted: boolean;
  brain: string;
  textEmotionConfigured: boolean;
  activityAwarenessAllowed: boolean;
  activityAwarenessActive: boolean;
  screenShareActive: boolean;
  env: Record<string, string | undefined>;
  geminiKeySaved: boolean;
}): PrivacyStatus {
  const brain = input.brain === "local" ? "local" : "gemini";
  const localVoiceEngine = (input.env.SIYA_TTS_ENGINE || "edge").toLowerCase();
  const localModelOnDevice = isLoopbackUrl(input.env.SIYA_LOCAL_LLM_URL);
  const localVoiceOnDevice = isLoopbackUrl(input.env.SIYA_VOICE_URL);
  const external: string[] = [];
  if (brain === "local") {
    if (!localModelOnDevice) external.push("model-server");
    if (!localVoiceOnDevice) external.push("voice-server");
    if (localVoiceEngine === "edge") external.push("edge-tts");
    if (input.geminiKeySaved) external.push("gemini-planning");
  }
  return {
    encrypted: input.encrypted,
    brain,
    textEmotion: brain === "gemini" && input.textEmotionConfigured,
    screenShareActive: input.screenShareActive,
    activityAwareness: input.activityAwarenessActive,
    activityAwarenessAllowed: input.activityAwarenessAllowed,
    localVoiceEngine,
    localModelOnDevice,
    localVoiceOnDevice,
    planningUsesGemini: input.geminiKeySaved,
    externalInLocalMode: external,
  };
}
