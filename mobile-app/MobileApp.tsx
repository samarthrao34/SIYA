import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Power, KeyRound, LoaderCircle, Camera, CameraOff } from "lucide-react";
import { CharacterStage } from "../src/character/CharacterStage";
import { MobileLiveSession, type SessionState } from "./mobileLiveSession";
import type { EmotionReading } from "../src/vision/emotionDetector";
import type { BehaviorReading } from "../src/vision/behaviorAnalyzer";

const KEY_STORAGE = "siya.mobile.geminiApiKey";

function ApiKeyOnboarding({ onSaved }: { onSaved: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#07070b] p-6 text-white">
      <div className="pointer-events-none absolute -left-32 -top-32 h-[360px] w-[360px] rounded-full bg-indigo-700/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[380px] w-[380px] rounded-full bg-cyan-700/15 blur-[130px]" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = key.trim();
          if (!trimmed) {
            setError("Paste a Gemini API key first.");
            return;
          }
          window.localStorage.setItem(KEY_STORAGE, trimmed);
          onSaved(trimmed);
        }}
        className="relative z-10 w-[min(92vw,420px)] rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
      >
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <img src="/assets/brand/siya-mark.png" alt="SIYA" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome to SIYA</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            This phone talks to Gemini directly with your own API key -- no laptop needed. It stays on this device
            only.
          </p>
        </div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40">
          Gemini API key
        </label>
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
          <KeyRound className="h-4 w-4 text-white/30" />
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="AIza..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
          />
        </div>
        {error && <p className="mb-2 text-xs text-amber-300">{error}</p>}
        <button
          type="submit"
          className="mt-3 w-full rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
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
  const sessionRef = useRef<MobileLiveSession | null>(null);

  useEffect(() => {
    return () => sessionRef.current?.disconnect();
  }, []);

  if (!apiKey) {
    return <ApiKeyOnboarding onSaved={setApiKey} />;
  }

  const connect = () => {
    setError(null);
    if (!sessionRef.current) {
      sessionRef.current = new MobileLiveSession(apiKey, {
        onStateChange: setState,
        onTranscription: (role, text) => {
          setLines((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role) {
              return [...prev.slice(0, -1), { role, text: last.text + text }];
            }
            return [...prev, { role, text }].slice(-40);
          });
        },
        onError: (message) => setError(message),
        onCameraChange: setCamOn,
        onEmotionChange: setEmotion,
        onBehaviorChange: (reading) =>
          setBehavior((current) => (current?.state === reading?.state ? current : reading)),
      });
    }
    void sessionRef.current.connect();
  };
  const disconnect = () => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setCamOn(false);
    setEmotion(null);
    setBehavior(null);
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    sessionRef.current?.setPlaybackMuted(next);
  };
  const toggleCamera = () => {
    if (camOn) sessionRef.current?.stopCamera();
    else void sessionRef.current?.startCamera();
  };

  const characterState = state === "speaking" ? "talking" : state === "listening" ? "listening" : "idle";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07070b] text-white">
      <div className="absolute inset-0">
        <CharacterStage
          session={sessionRef.current}
          state={state}
          themeColor="celestial"
          activeEmotion="idle"
          characterState={characterState}
          motionIntent={state === "speaking" ? "talking" : state === "listening" ? "listening" : "idle"}
          reflectionStrength={1}
          landscapeFaceFocus
          lookAround
          animations
          controlsEnabled={false}
          showControlHint={false}
        />
      </div>

      <div
        className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 p-4"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <span className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-white/50 backdrop-blur">
          <span>{state === "disconnected" ? "asleep" : state === "connecting" ? "waking up…" : state}</span>
          {camOn && emotion && emotion.emotion !== "neutral" && (
            <span className="text-cyan-300/80" title={`confidence ${(emotion.confidence * 100).toFixed(0)}%`}>
              · {emotion.emotion}
            </span>
          )}
          {camOn && behavior && behavior.state !== "calm" && behavior.state !== "away" && (
            <span className="text-cyan-300/80" title={behavior.cues.join(", ")}>
              · {behavior.state}
            </span>
          )}
        </span>
        {error && (
          <span className="max-w-[65%] truncate rounded-full bg-rose-500/20 px-3 py-1 text-[10px] text-rose-200">
            {error}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-28 z-30 max-h-40 overflow-y-auto px-4 pointer-events-none">
        {lines.slice(-4).map((line, i) => (
          <p
            key={i}
            className={`mb-1 text-sm leading-snug ${line.role === "model" ? "text-white/90" : "text-cyan-300/80"}`}
          >
            {line.text}
          </p>
        ))}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-6 pt-14"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {state !== "disconnected" && (
          <button
            onClick={toggleMute}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
            title={muted ? "Unmute Siya" : "Mute Siya"}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        {state !== "disconnected" && (
          <button
            onClick={toggleCamera}
            className={`flex h-11 w-11 items-center justify-center rounded-full border transition ${
              camOn ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-300" : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
            title={camOn ? "Stop Siya seeing you" : "Let Siya see you through your camera"}
          >
            {camOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>
        )}
        <button
          onClick={state === "disconnected" ? connect : disconnect}
          className={`flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_10px_40px_rgba(99,102,241,0.4)] transition ${
            state === "disconnected" ? "bg-gradient-to-br from-indigo-500 to-cyan-500" : "bg-rose-500/80"
          }`}
          title={state === "disconnected" ? "Awake Siya" : "Sleep core"}
        >
          {state === "connecting" ? (
            <LoaderCircle className="h-6 w-6 animate-spin" />
          ) : (
            <Power className="h-6 w-6" />
          )}
        </button>
      </div>
    </div>
  );
}
