/*
 * What leaves this computer, who receives it, and what is stored, for the
 * consent screen and the Privacy Center. Driven by /api/privacy/status
 * (server/privacyControls.ts buildPrivacyStatus) so it describes the flows
 * that are actually active. docs/DATA_FLOWS.md is the full map with code
 * references; keep the two in sync and bump CONSENT_VERSION when this changes.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";

export type PrivacyStatus = {
  encrypted: boolean;
  brain: "gemini" | "local";
  textEmotion: boolean;
  screenShareActive: boolean;
  activityAwareness: boolean;
  activityAwarenessAllowed: boolean;
  localVoiceEngine: string;
  localModelOnDevice: boolean;
  localVoiceOnDevice: boolean;
  planningUsesGemini: boolean;
  externalInLocalMode: string[];
};

// If the status cannot be read, describe the widest set of flows.
const FALLBACK: PrivacyStatus = {
  encrypted: false,
  brain: "gemini",
  textEmotion: true,
  screenShareActive: false,
  activityAwareness: false,
  activityAwarenessAllowed: true,
  localVoiceEngine: "edge",
  localModelOnDevice: true,
  localVoiceOnDevice: true,
  planningUsesGemini: true,
  externalInLocalMode: [],
};

/** Active privacy-relevant configuration (null while loading) and a refresh. */
export function usePrivacyStatus(): PrivacyStatus | null {
  return usePrivacyStatusWithRefresh()[0];
}

export function usePrivacyStatusWithRefresh(): [PrivacyStatus | null, () => void] {
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  const refresh = useCallback(() => {
    fetch("/api/privacy/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStatus({ ...FALLBACK, ...data, brain: data?.brain === "local" ? "local" : "gemini" }))
      .catch(() => setStatus(FALLBACK));
  }, []);
  useEffect(refresh, [refresh]);
  return [status, refresh];
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-medium text-white">{title}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-white/65">{children}</ul>
    </div>
  );
}

function modelDestination(status: PrivacyStatus): string {
  if (status.brain === "gemini") return "Google Gemini";
  return status.localModelOnDevice ? "the local model on this computer" : "a model server on another machine";
}

export function DataDisclosure({ status }: { status: PrivacyStatus }) {
  const gemini = status.brain === "gemini";
  const destination = modelDestination(status);
  const localLeaves = !gemini && status.externalInLocalMode.length > 0;
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {gemini ? (
        <Section title="Sent to Google (Gemini) so SIYA can reply">
          <li>Your voice and typed messages, and SIYA's replies.</li>
          <li>
            While the camera is on and SIYA is connected: a still photo every few seconds, plus the facial-expression
            and behaviour labels (for example "sad" or "tired") that SIYA reads from your face and hands on this
            computer.
          </li>
          <li>
            Recent conversation together with up to 30 of your saved memories most related to it (all of them when you
            correct something or ask SIYA to forget), to decide what to remember; and a few relevant memories at the
            start of each conversation.
          </li>
          <li>Goals you ask SIYA to plan.</li>
          <li>
            If your Gemini key is on the free tier, Google may use this data to improve its products. Avoid sharing
            details you would not want a company to see.
          </li>
        </Section>
      ) : (
        <Section title={localLeaves ? "Local mode (some data still leaves this computer)" : "Local mode"}>
          <li>Your voice, messages and camera go to {destination}.</li>
          {!status.localVoiceOnDevice && <li>Your voice goes to a voice server on another machine.</li>}
          {status.localVoiceEngine === "edge" && (
            <li>
              SIYA's replies (her words, not yours) are sent to Microsoft's Edge read-aloud service to be spoken, because
              it sounds better in Hindi.
            </li>
          )}
          {status.planningUsesGemini && <li>Goals you ask SIYA to plan are sent to Google Gemini.</li>}
        </Section>
      )}

      <Section title="Your screen: only while you share it">
        <li>
          SIYA can see your screen only while <b className="text-white">Share screen</b> is on. Then she receives a
          picture of your screen every few seconds when it changes, and SIYA may also take a screenshot or read text off
          the screen, all sent to {destination}. Everything visible on the shared screen is included.
        </li>
        <li>
          When Share screen is off or paused, nothing from your screen is captured or sent. It also switches off if the
          connection drops, so it never resumes on its own.{" "}
          {status.screenShareActive ? "Share screen is on right now." : "Share screen is off right now."}
        </li>
      </Section>

      <Section title="Which app you are using: only with Activity awareness">
        <li>
          With Activity awareness on, the name of the app you are using and its window title are sent to {destination}{" "}
          so SIYA can notice what you are doing. With it off, they are never sent.{" "}
          {status.activityAwarenessAllowed
            ? status.activityAwareness
              ? "Activity awareness is on."
              : "Activity awareness is off."
            : "Activity awareness is disabled on this computer."}
        </li>
      </Section>

      {status.textEmotion && (
        <Section title="Sent to TypeSafe">
          <li>What you say or type, to read its emotional tone. Used only with Gemini, never in local mode.</li>
        </Section>
      )}

      <Section title="Tools you ask for">
        <li>
          Weather (for a location), exchange rates, web and YouTube search, and websites you open contact those
          services directly.
        </li>
      </Section>

      <Section title="Stored on this computer">
        <li>
          Memories, goals and notes from your last session{status.encrypted ? ", encrypted" : ", not encrypted on this setup"}.
        </li>
        <li>
          Settings, skills SIYA learns (task steps, which can include file names), your Gemini API key and logs, not
          encrypted. Files SIYA writes can be read only by your user account.
        </li>
        <li>
          Logs record which tools SIYA used, settings changes, errors (which can include file names) and when the
          crisis-help card was shown, but not your conversation.
        </li>
        <li>SIYA does not save camera images or voice recordings. Screenshots are saved only when you ask her to.</li>
      </Section>
    </div>
  );
}

/** Switch for Activity awareness, saved in settings and applied immediately. */
export function ActivityAwarenessToggle({ status, onChanged }: { status: PrivacyStatus; onChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!status.activityAwarenessAllowed) return null;
  const toggle = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityAwareness: !status.activityAwareness }),
      });
      if (!res.ok) throw new Error("Could not save the setting.");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the setting.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={status.activityAwareness}
          disabled={saving}
          onChange={toggle}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-cyan-400"
        />
        <span>
          <span className="font-medium text-white">Activity awareness</span>
          <span className="block text-white/60">
            Let SIYA know which app you are using and its window title. Off by default.
          </span>
        </span>
      </label>
      {error && <p className="mt-2 text-rose-300">{error}</p>}
    </div>
  );
}
