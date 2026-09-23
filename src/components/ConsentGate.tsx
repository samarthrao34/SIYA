/*
 * First-run privacy notice, wellness disclaimer and age check.
 *
 * Shown before anything else until the user agrees. Consent is stored in the
 * backend's settings.json as `privacyConsent` (so "delete all my data", which
 * clears it, brings this screen back). Bump CONSENT_VERSION whenever the text
 * changes materially so everyone is asked again.
 */
import { useEffect, useState, type ReactNode } from "react";
import { HeartHandshake, Lock, Cloud, Trash2, Phone, LoaderCircle } from "lucide-react";

const CONSENT_VERSION = 1;

/** Whether the backend really encrypts personal data (it needs the OS keyring). */
export function useEncryptionStatus(): boolean {
  const [encrypted, setEncrypted] = useState(false);
  useEffect(() => {
    fetch("/api/privacy/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((status) => setEncrypted(status?.encrypted === true))
      .catch(() => setEncrypted(false));
  }, []);
  return encrypted;
}

type Status = "checking" | "needed" | "ok";

export function ConsentGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("checking");
  const [adult, setAdult] = useState(false);
  const [understands, setUnderstands] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encrypted = useEncryptionStatus();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((settings) => {
        if (!cancelled) setStatus(settings?.privacyConsent?.version === CONSENT_VERSION ? "ok" : "needed");
      })
      .catch(() => {
        if (!cancelled) setStatus("needed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function accept() {
    if (!adult || !understands || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privacyConsent: { version: CONSENT_VERSION, acceptedAt: new Date().toISOString(), adult: true },
        }),
      });
      if (!res.ok) throw new Error("Could not save your choice. Please try again.");
      setStatus("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "ok") return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-[#050509] px-4 py-8 text-white">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-indigo-700/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-cyan-700/15 blur-[150px]" />
      {status === "checking" ? (
        <div className="flex flex-col items-center gap-4 text-white/60">
          <LoaderCircle className="h-7 w-7 animate-spin" />
          <span className="text-sm tracking-wide">Starting SIYA…</span>
        </div>
      ) : (
        <div className="relative z-10 w-[min(94vw,540px)] rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 ring-1 ring-white/10">
              <img src="/assets/brand/siya-mark.png" alt="SIYA" className="h-full w-full object-cover" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Before we start</h1>
            <p className="mt-1 text-sm text-white/55">A few honest things about SIYA and your data.</p>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-white/80">
            <Item icon={<HeartHandshake className="h-4 w-4 text-rose-300" />} title="A wellness companion, not a therapist">
              SIYA is here to listen and keep you company. She is not a therapist, doctor or medical device, and
              cannot diagnose or treat any condition. If you are in crisis, please call{" "}
              <b className="text-white">Tele-MANAS 14416</b> or <b className="text-white">KIRAN 1800-599-0019</b>{" "}
              (free, 24x7), or <b className="text-white">112</b> in an emergency.
            </Item>
            <Item icon={<Lock className="h-4 w-4 text-emerald-300" />} title="Your memories stay on this device">
              What SIYA remembers about you, your moods, goals and health readings are stored only on this computer
              {encrypted ? ", encrypted." : "."}
            </Item>
            <Item icon={<Cloud className="h-4 w-4 text-cyan-300" />} title="What is sent to Google">
              To reply, your voice and messages are sent to Google's Gemini service. Camera and screen images are sent
              only while you turn them on.
            </Item>
            <Item icon={<Trash2 className="h-4 w-4 text-amber-300" />} title="You are in control">
              You can delete everything SIYA knows about you at any time from the shield button in the corner.
            </Item>
          </div>

          <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <Check checked={adult} onChange={setAdult}>
              I am 18 years or older.
            </Check>
            <Check checked={understands} onChange={setUnderstands}>
              I understand SIYA is not a substitute for professional help.
            </Check>
          </div>

          {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}

          <button
            type="button"
            onClick={accept}
            disabled={!adult || !understands || saving}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 py-3 text-sm font-semibold tracking-wide shadow-lg transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Saving…" : "Agree and continue"}
          </button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-white/40">
            <Phone className="h-3 w-3" /> SIYA is for adults. If you are under 18, please talk to someone you trust.
          </p>
        </div>
      )}
    </div>
  );
}

function Item({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
        {icon}
      </div>
      <div>
        <div className="font-medium text-white">{title}</div>
        <div className="text-white/65">{children}</div>
      </div>
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-white/85">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 cursor-pointer accent-cyan-400"
      />
      <span>{children}</span>
    </label>
  );
}
