/*
 * What leaves this computer, who receives it, and what is stored, for the
 * consent screen and the Privacy Center. Driven by /api/privacy/status so it
 * only lists flows that are active in this setup. docs/DATA_FLOWS.md is the
 * full map with code references; keep the two in sync.
 */
import { useEffect, useState, type ReactNode } from "react";

export type PrivacyStatus = {
  encrypted: boolean;
  brain: "gemini" | "local";
  textEmotion: boolean;
  desktopAwareness: boolean;
  localVoiceEngine: string;
};

const FALLBACK: PrivacyStatus = {
  encrypted: false,
  brain: "gemini",
  textEmotion: false,
  desktopAwareness: true,
  localVoiceEngine: "edge",
};

/** Active privacy-relevant configuration, or null while it loads. */
export function usePrivacyStatus(): PrivacyStatus | null {
  const [status, setStatus] = useState<PrivacyStatus | null>(null);
  useEffect(() => {
    fetch("/api/privacy/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setStatus({ ...FALLBACK, ...data, brain: data?.brain === "local" ? "local" : "gemini" }))
      // If the status can't be read, disclose the widest default set of flows.
      .catch(() => setStatus(FALLBACK));
  }, []);
  return status;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-medium text-white">{title}</div>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-white/65">{children}</ul>
    </div>
  );
}

export function DataDisclosure({ status }: { status: PrivacyStatus }) {
  const gemini = status.brain === "gemini";
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {gemini ? (
        <Section title="Sent to Google (Gemini) so SIYA can reply">
          <li>Your voice and typed messages, and SIYA's replies.</li>
          <li>
            While the camera is on: a still photo from it every few seconds, plus the facial-expression and behaviour
            labels (for example "sad" or "tired") that SIYA reads from your face and hands on this computer.
          </li>
          <li>While screen sharing is on, or when you ask SIYA to look at your screen: images of your screen.</li>
          {status.desktopAwareness && (
            <li>The name of the app you are using and its window title, so SIYA can notice what you are doing.</li>
          )}
          <li>Recent conversation, to decide what to remember, and your saved memories, to personalise replies.</li>
          <li>
            SIYA uses Gemini's free tier, so Google may use this data to improve its products. Avoid sharing details you
            would not want a company to see.
          </li>
        </Section>
      ) : (
        <Section title="Local mode">
          <li>Your voice, messages, camera and screen are processed by models on this computer.</li>
          {status.localVoiceEngine === "edge" && (
            <li>
              SIYA's replies (her words, not yours) are sent to Microsoft's Edge read-aloud service to turn them into
              speech.
            </li>
          )}
          <li>Planning a goal you ask for still sends the goal's text to Google Gemini if a Gemini key is saved.</li>
        </Section>
      )}

      {status.textEmotion && (
        <Section title="Sent to TypeSafe">
          <li>What you say or type, to read its emotional tone. It is used only alongside Gemini, never in local mode.</li>
        </Section>
      )}

      <Section title="Stored on this computer">
        <li>
          Memories, goals and notes from your last session{status.encrypted ? ", encrypted" : ", not encrypted on this setup"}.
        </li>
        <li>
          Settings and activity logs, not encrypted. Logs record which tools SIYA used, settings changes, errors (which
          can include details such as file names) and when the crisis-help card was shown, but not your conversation.
        </li>
        <li>
          Skills SIYA learns (the steps of tasks she has done, which can include file names), not encrypted.
        </li>
        <li>Your Gemini API key, in a file only your user account can read.</li>
        <li>SIYA does not save camera images or voice recordings. Screenshots are saved only when you ask her to.</li>
      </Section>
    </div>
  );
}
