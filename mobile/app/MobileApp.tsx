import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Check,
  KeyRound,
  LoaderCircle,
  Mic,
  Palette,
  Send,
  Settings,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CharacterStage } from "../../src/character/CharacterStage";
import { MobileLiveSession, type SessionState } from "./mobileLiveSession";
import type { EmotionReading } from "../../src/vision/emotionDetector";
import type { BehaviorReading } from "../../src/vision/behaviorAnalyzer";

const KEY_STORAGE = "siya.mobile.geminiApiKey";
const THEME_STORAGE = "siya.mobile.theme";

const themes = [
  { id: "dusk", label: "Dusk", swatch: "linear-gradient(160deg,#33264a,#9a6671,#c48478)" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(160deg,#4c0519,#9f1239)" },
  { id: "violet", label: "Violet", swatch: "linear-gradient(160deg,#2e1065,#6d28d9)" },
  { id: "celestial", label: "Sky", swatch: "linear-gradient(160deg,#082f49,#0369a1)" },
  { id: "emerald", label: "Emerald", swatch: "linear-gradient(160deg,#022c22,#047857)" },
  { id: "gold", label: "Gold", swatch: "linear-gradient(160deg,#451a03,#b45309)" },
  { id: "crimson", label: "Crimson", swatch: "linear-gradient(160deg,#450a0a,#b91c1c)" },
  { id: "charcoal", label: "Charcoal", swatch: "linear-gradient(160deg,#020617,#334155)" },
] as const;

type ThemeName = (typeof themes)[number]["id"];

const themeBackgrounds: Record<ThemeName, string> = {
  dusk: "linear-gradient(180deg,#1c1530 0%,#33264a 34%,#5c4063 66%,#9a6671 88%,#c48478 100%)",
  rose: "linear-gradient(180deg,#160710 0%,#4c0519 48%,#9f1239 100%)",
  violet: "linear-gradient(180deg,#110622 0%,#2e1065 50%,#6d28d9 100%)",
  celestial: "linear-gradient(180deg,#03131d 0%,#082f49 50%,#0369a1 100%)",
  emerald: "linear-gradient(180deg,#011812 0%,#022c22 52%,#047857 100%)",
  gold: "linear-gradient(180deg,#1b0c02 0%,#451a03 52%,#b45309 100%)",
  crimson: "linear-gradient(180deg,#190404 0%,#450a0a 50%,#b91c1c 100%)",
  charcoal: "linear-gradient(180deg,#020617 0%,#111827 56%,#334155 100%)",
};

function ApiKeyOnboarding({ onSaved }: { onSaved: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#1c1530_0%,#5c4063_64%,#c48478_100%)] p-6 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[360px] w-[360px] rounded-full bg-violet-300/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[380px] w-[380px] rounded-full bg-orange-200/20 blur-[130px]" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = key.trim();
          if (!trimmed) {
            setError("Paste a Gemini API key first.");
            return;
          }
          window.localStorage.setItem(KEY_STORAGE, trimmed);
          onSaved(trimmed);
        }}
        className="relative z-10 w-[min(92vw,420px)] rounded-[28px] border border-white/15 bg-[#2b2140]/80 p-7 shadow-[0_30px_80px_rgba(20,10,30,0.5)] backdrop-blur-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/assets/brand/siya-mark.png" alt="SIYA" className="mb-4 h-14 w-14 rounded-2xl ring-1 ring-white/15" />
          <h1 className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight">Welcome to SIYA</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">Your private companion, now in your pocket.</p>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-white/50">Gemini API key</label>
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3">
          <KeyRound className="h-4 w-4 text-orange-100/60" />
          <input
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="Paste your key"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
        {error && <p className="mb-2 text-xs text-amber-200">{error}</p>}
        <button type="submit" className="mt-3 w-full rounded-xl bg-gradient-to-br from-orange-100 to-rose-300 py-3 text-sm font-semibold text-rose-950 shadow-lg">
          Continue
        </button>
      </form>
    </div>
  );
}

export function MobileApp() {
  const [apiKey, setApiKey] = useState<string | null>(() => window.localStorage.getItem(KEY_STORAGE));
  const [state, setState] = useState<SessionState>("disconnected");
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [emotion, setEmotion] = useState<EmotionReading | null>(null);
  const [behavior, setBehavior] = useState<BehaviorReading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<ThemeName>(() => {
    const saved = window.localStorage.getItem(THEME_STORAGE) as ThemeName | null;
    return themes.some((item) => item.id === saved) ? saved! : "dusk";
  });
  const [themesOpen, setThemesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sessionRef = useRef<MobileLiveSession | null>(null);
  const pendingTextRef = useRef<string | null>(null);

  useEffect(() => () => sessionRef.current?.disconnect(), []);

  useEffect(() => {
    if (state !== "listening" || !pendingTextRef.current || !sessionRef.current) return;
    sessionRef.current.sendText(pendingTextRef.current);
    pendingTextRef.current = null;
  }, [state]);

  if (!apiKey) return <ApiKeyOnboarding onSaved={setApiKey} />;

  const connect = () => {
    setError(null);
    if (!sessionRef.current) {
      sessionRef.current = new MobileLiveSession(apiKey, {
        onStateChange: setState,
        onTranscription: (role, text) => {
          setLines((previous) => {
            const last = previous[previous.length - 1];
            if (last && last.role === role) return [...previous.slice(0, -1), { role, text: last.text + text }];
            return [...previous, { role, text }].slice(-40);
          });
        },
        onError: (messageText) => setError(messageText),
        onCameraChange: setCamOn,
        onEmotionChange: setEmotion,
        onBehaviorChange: (reading) => setBehavior((current) => (current?.state === reading?.state ? current : reading)),
      });
    }
    void sessionRef.current.connect();
  };

  const disconnect = () => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    pendingTextRef.current = null;
    setCamOn(false);
    setState("disconnected");
    setEmotion(null);
    setBehavior(null);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setPlaybackMuted(next);
  };

  const submitMessage = (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text || state === "connecting") return;
    setMessage("");
    setLines((previous) => [...previous, { role: "user" as const, text }].slice(-40));
    if (state === "disconnected") {
      pendingTextRef.current = text;
      connect();
    } else {
      sessionRef.current?.sendText(text);
    }
  };

  const selectTheme = (nextTheme: ThemeName) => {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_STORAGE, nextTheme);
    setThemesOpen(false);
  };

  const forgetKey = () => {
    disconnect();
    window.localStorage.removeItem(KEY_STORAGE);
    setSettingsOpen(false);
    setApiKey(null);
  };

  const characterState = state === "speaking" ? "talking" : state === "listening" ? "listening" : "idle";
  const lastModel = [...lines].reverse().find((line) => line.role === "model");
  const lastUser = [...lines].reverse().find((line) => line.role === "user");
  const activeLine = lastModel ?? lastUser;
  const statusText =
    state === "connecting"
      ? "Materializing presence links…"
      : state === "listening"
        ? "I am listening. Speak freely…"
        : state === "speaking"
          ? "SIYA is speaking…"
          : "Tap the mic to wake SIYA";

  return (
    <div
      id="siya-mobile-experience"
      className="relative h-full w-full select-none overflow-hidden text-white"
      style={{ background: themeBackgrounds[theme] }}
    >
      <div className="pointer-events-none absolute -left-32 -top-24 h-80 w-80 rounded-full bg-violet-200/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-96 w-96 rounded-full bg-orange-100/15 blur-[120px]" />
      <div
        className={`pointer-events-none absolute left-1/2 top-[43%] z-0 h-[62vh] w-[62vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] transition-all duration-700 ${
          state === "speaking"
            ? "scale-105 bg-violet-200/25 opacity-100"
            : state === "listening"
              ? "bg-rose-100/20 opacity-100"
              : "scale-90 bg-white/5 opacity-40"
        }`}
      />

      <div className="absolute inset-0 z-0">
        <CharacterStage
          session={sessionRef.current}
          state={state}
          themeColor={theme}
          activeEmotion={emotion?.emotion ?? "idle"}
          characterState={characterState}
          motionIntent={state === "speaking" ? "talking" : state === "listening" ? "listening" : "idle"}
          reflectionStrength={1}
          landscapeFaceFocus
          lookAround
          animations
          controlsEnabled={false}
          showControlHint={false}
          mobileOptimized
        />
      </div>

      <header
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 pb-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#2b2140]/45 px-3 py-2 shadow-lg backdrop-blur-xl">
          <span className="font-['Space_Grotesk'] text-xs font-semibold uppercase tracking-[0.3em] text-white/80">SIYA</span>
          <span className={`h-1.5 w-1.5 rounded-full ${state === "listening" || state === "speaking" ? "bg-orange-100 shadow-[0_0_12px_rgba(254,215,170,.8)]" : "bg-white/20"}`} />
          {camOn && <Camera className="h-3.5 w-3.5 text-orange-100" aria-label="Camera vision active" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setThemesOpen((open) => !open); setSettingsOpen(false); }}
            className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition ${themesOpen ? "border-orange-100/50 bg-orange-100/20 text-orange-100" : "border-white/10 bg-[#2b2140]/45 text-white/70"}`}
            aria-label="Themes"
          >
            <Palette className="h-[17px] w-[17px]" />
          </button>
          <button
            onClick={() => { setSettingsOpen((open) => !open); setThemesOpen(false); }}
            className={`flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-xl transition ${settingsOpen ? "border-orange-100/50 bg-orange-100/20 text-orange-100" : "border-white/10 bg-[#2b2140]/45 text-white/70"}`}
            aria-label="Settings"
          >
            <Settings className="h-[17px] w-[17px]" />
          </button>
        </div>
      </header>

      {themesOpen && (
        <section className="absolute right-5 top-[76px] z-40 w-[250px] rounded-3xl border border-white/15 bg-[#2b2140]/90 p-4 shadow-2xl backdrop-blur-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-['Space_Grotesk'] text-sm font-semibold">Themes</span>
            <button onClick={() => setThemesOpen(false)} className="rounded-full p-1 text-white/50"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {themes.map((item) => (
              <button key={item.id} onClick={() => selectTheme(item.id)} className="flex flex-col items-center gap-1.5 text-[10px] text-white/65">
                <span className={`relative h-10 w-full rounded-xl ring-1 ${theme === item.id ? "ring-orange-100" : "ring-white/15"}`} style={{ background: item.swatch }}>
                  {theme === item.id && <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {settingsOpen && (
        <section className="absolute right-5 top-[76px] z-40 w-[270px] rounded-3xl border border-white/15 bg-[#2b2140]/90 p-4 shadow-2xl backdrop-blur-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="font-['Space_Grotesk'] text-sm font-semibold">Pocket controls</p>
              <p className="mt-0.5 text-[11px] text-white/45">Camera, playback and account</p>
            </div>
            <button onClick={() => setSettingsOpen(false)} className="rounded-full p-1 text-white/50"><X className="h-4 w-4" /></button>
          </div>
          <div className="mb-2 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
            <span className="flex items-center gap-2">{camOn ? <Camera className="h-4 w-4 text-orange-100" /> : <CameraOff className="h-4 w-4 text-white/50" />} Camera vision</span>
            <span className="text-xs text-white/45">{state === "disconnected" ? "With voice" : camOn ? "Always on" : "Starting…"}</span>
          </div>
          <button
            onClick={toggleMute}
            className="mb-2 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm"
          >
            <span className="flex items-center gap-2">{muted ? <VolumeX className="h-4 w-4 text-orange-100" /> : <Volume2 className="h-4 w-4 text-white/50" />} Voice playback</span>
            <span className="text-xs text-white/45">{muted ? "Muted" : "On"}</span>
          </button>
          {(camOn && emotion && emotion.emotion !== "neutral") || (camOn && behavior && behavior.state !== "calm" && behavior.state !== "away") ? (
            <p className="rounded-2xl bg-orange-100/10 px-3 py-2 text-xs text-orange-100/80">
              SIYA sees {emotion?.emotion !== "neutral" ? emotion?.emotion : behavior?.state}.
            </p>
          ) : null}
          <button onClick={forgetKey} className="mt-4 w-full rounded-2xl border border-rose-200/15 bg-rose-950/20 px-3 py-2.5 text-xs text-rose-100/70">
            Forget Gemini key
          </button>
        </section>
      )}

      <div className="pointer-events-none absolute inset-x-5 bottom-[150px] z-30 flex min-h-24 flex-col items-center justify-end text-center">
        {error ? (
          <div className="pointer-events-auto max-w-md rounded-2xl border border-rose-200/20 bg-[#2b2140]/80 px-4 py-3 text-xs leading-relaxed text-rose-100 shadow-xl backdrop-blur-xl">{error}</div>
        ) : activeLine ? (
          activeLine.role === "model" ? (
            <p className="line-clamp-4 max-w-md text-sm font-light leading-relaxed tracking-wide text-white drop-shadow-[0_2px_18px_rgba(0,0,0,.9)]">{activeLine.text}</p>
          ) : (
            <p className="line-clamp-3 max-w-md text-xs font-medium tracking-wide text-orange-100 drop-shadow-[0_2px_12px_rgba(0,0,0,.9)]">“{activeLine.text}”</p>
          )
        ) : (
          <p className="text-xs font-medium tracking-[0.16em] text-white/55 drop-shadow-lg">{statusText}</p>
        )}
      </div>

      <footer
        className="absolute inset-x-0 bottom-0 z-30 px-4 pt-12"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))", background: "linear-gradient(to top,rgba(28,21,48,.96) 0%,rgba(28,21,48,.7) 52%,transparent 100%)" }}
      >
        <div className="mb-2 flex h-7 items-end justify-center gap-1">
          {[12, 25, 16, 29, 19, 9].map((height, index) => (
            <span
              key={index}
              className={`w-0.5 rounded-full transition-all duration-300 ${state === "speaking" ? "animate-pulse bg-violet-200" : state === "listening" ? "animate-pulse bg-orange-100" : "bg-white/15"}`}
              style={{ height: state === "disconnected" ? `${Math.max(3, height * 0.22)}px` : `${Math.max(4, height * (index % 2 ? 0.75 : 0.48))}px`, animationDelay: `${index * 90}ms` }}
            />
          ))}
        </div>
        <form
          onSubmit={submitMessage}
          className={`mx-auto flex w-full max-w-md items-center gap-2 rounded-full border p-1.5 shadow-[0_10px_36px_rgba(20,10,30,.45)] backdrop-blur-2xl transition ${
            state === "listening"
              ? "border-rose-100/45 bg-[#3a2540]/80"
              : state === "speaking"
                ? "border-violet-100/45 bg-[#2f2548]/80"
                : "border-white/15 bg-[#2b2140]/80"
          }`}
        >
          <button
            type="button"
            onClick={state === "disconnected" ? connect : disconnect}
            aria-label={state === "disconnected" ? "Talk to SIYA" : "End conversation"}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-100 to-rose-300 text-rose-950 shadow-lg transition active:scale-95"
          >
            {state === "connecting" ? <LoaderCircle className="h-5 w-5 animate-spin" /> : state === "speaking" ? <Volume2 className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            {state === "listening" && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-rose-200/40" />}
          </button>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-label="Message SIYA"
            placeholder={state === "connecting" ? "Connecting…" : state === "speaking" ? "SIYA is speaking…" : state === "listening" ? "Listening… or type a message" : "Message SIYA, or tap the mic"}
            className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-white/45"
          />
          <button
            type="submit"
            disabled={!message.trim() || state === "connecting"}
            aria-label="Send message"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${message.trim() ? "bg-gradient-to-br from-orange-100 to-rose-300 text-rose-950" : "bg-white/10 text-white/35"}`}
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
