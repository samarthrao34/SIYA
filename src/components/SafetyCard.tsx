/*
 * Helpline card shown when the backend's crisis-language check fires
 * (server_safety.ts -> {type: "safety"} over the live socket, re-broadcast by
 * liveSession.ts as the "siya:safety" window event). SIYA also says the
 * numbers aloud; the card makes sure they can be read, not just heard. It
 * stays until the user closes it.
 */
import { useEffect, useState } from "react";
import { Phone, X } from "lucide-react";

interface Helpline {
  name: string;
  number: string;
  detail: string;
}

const FALLBACK_HELPLINES: Helpline[] = [
  { name: "Tele-MANAS", number: "14416", detail: "Free, 24x7 mental-health helpline (Govt. of India)" },
  { name: "KIRAN", number: "1800-599-0019", detail: "Free, 24x7 mental-health rehabilitation helpline" },
  { name: "Emergency", number: "112", detail: "Police / ambulance, if you are in immediate danger" },
];

export function SafetyCard() {
  const [helplines, setHelplines] = useState<Helpline[] | null>(null);

  useEffect(() => {
    const onSafety = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setHelplines(Array.isArray(detail?.helplines) && detail.helplines.length ? detail.helplines : FALLBACK_HELPLINES);
    };
    window.addEventListener("siya:safety", onSafety);
    return () => window.removeEventListener("siya:safety", onSafety);
  }, []);

  if (!helplines) return null;

  return (
    <div className="fixed inset-x-0 top-6 z-[120] flex justify-center px-4" role="alertdialog" aria-label="Support is available">
      <div className="w-[min(94vw,460px)] rounded-3xl border border-rose-300/25 bg-[#12070d]/95 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">आप अकेले नहीं हैं · You're not alone</h2>
            <p className="mt-1 text-sm text-white/65">
              Someone is ready to listen right now. These calls are free and confidential.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHelplines(null)}
            className="rounded-full p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2.5">
          {helplines.map((line) => (
            <li key={line.number} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10">
              <Phone className="h-4 w-4 shrink-0 text-rose-300" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-white/85">{line.name}</span>
                  <a href={`tel:${line.number.replace(/[^0-9+]/g, "")}`} className="font-mono text-xl font-semibold tracking-wide text-white">
                    {line.number}
                  </a>
                </div>
                <div className="text-xs text-white/50">{line.detail}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-center text-xs text-white/45">
          If you can, reach out to someone you trust nearby too. SIYA is still here with you.
        </p>
      </div>
    </div>
  );
}
