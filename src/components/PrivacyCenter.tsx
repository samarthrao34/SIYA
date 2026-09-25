/*
 * Always-visible "wellness companion" label plus a privacy panel: what is
 * stored where, the helplines, and "delete all my data"
 * (POST /api/privacy/delete-all, which also resets consent, so the app
 * reloads into the first-run privacy screen).
 */
import { useState } from "react";
import { ShieldCheck, X, Trash2, LoaderCircle } from "lucide-react";
import { useEncryptionStatus } from "./ConsentGate";

export function PrivacyCenter() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const encrypted = useEncryptionStatus();

  async function deleteEverything() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/delete-all", { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not delete your data.");
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your data.");
      setDeleting(false);
    }
  }

  function close() {
    setOpen(false);
    setConfirming(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 left-3 z-[60] flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2b2140]/70 px-3 py-1.5 text-[11px] text-white/55 transition hover:text-white/90"
        title="Privacy & your data"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-300/80" />
        Wellness companion<span className="hidden xl:inline"> · not a therapist or medical device</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm" onClick={close}>
          <div
            className="w-[min(94vw,480px)] rounded-3xl border border-white/10 bg-[#07070d]/95 p-6 text-sm text-white/80 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <ShieldCheck className="h-5 w-5 text-emerald-300" /> Privacy & your data
              </h2>
              <button type="button" onClick={close} className="rounded-full p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="list-disc space-y-2 pl-5 text-white/70">
              <li>
                SIYA's memories of you, your moods, goals and health readings are stored only on this computer
                {encrypted ? ", encrypted." : "."}
              </li>
              <li>
                Your voice and messages go to Google's Gemini service so SIYA can reply. Camera and screen images are sent only
                while you turn them on. SIYA currently uses Gemini's free tier, so Google may use these conversations to improve
                its products.
              </li>
              <li>SIYA is a wellness companion, not a therapist, doctor or medical device.</li>
              <li>
                In crisis: <b className="text-white">Tele-MANAS 14416</b> · <b className="text-white">KIRAN 1800-599-0019</b> (free, 24x7) ·{" "}
                <b className="text-white">112</b> emergency.
              </li>
            </ul>

            <div className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-500/[0.06] p-4">
              <div className="font-medium text-white">Delete all my data</div>
              <p className="mt-1 text-white/60">
                Erases everything SIYA remembers about you, your health readings and logs. This cannot be undone.
              </p>
              {error && <p className="mt-2 text-rose-300">{error}</p>}
              {!confirming ? (
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="mt-3 flex items-center gap-2 rounded-xl border border-rose-400/40 px-4 py-2 text-rose-200 transition hover:bg-rose-500/15"
                >
                  <Trash2 className="h-4 w-4" /> Delete all my data
                </button>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={deleteEverything}
                    disabled={deleting}
                    className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 font-medium text-white transition hover:bg-rose-600 disabled:opacity-60"
                  >
                    {deleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Yes, delete everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={deleting}
                    className="rounded-xl px-4 py-2 text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
