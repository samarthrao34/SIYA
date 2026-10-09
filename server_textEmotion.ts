/**
 * SIYA — emotion read from what the user says (TypeSafe "Jev" judgment model).
 *
 * Complements the on-device facial signal (src/vision/emotionDetector.ts):
 * the face shows how they look, this reads how their words feel. Jev returns
 * typed judgments with probabilities, not generated text, so it only
 * classifies -- Gemini (or the local brain) still does all the talking.
 *
 * Needs TYPESAFE_API_KEY (loaded from .env). SIYA_TEXT_EMOTION=off disables it.
 * The user's words leave the machine, so server.ts never calls this in the
 * offline brain mode.
 */

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

export const TEXT_EMOTIONS = ["happy", "sad", "anxious", "angry", "lonely", "tired", "neutral"] as const;
export const DISTRESS_LEVELS = ["None", "Mild", "Moderate", "Severe"] as const;

export interface TextEmotionReading {
  emotion: string;
  emotionConfidence: number;
  /** Probability-weighted index into DISTRESS_LEVELS, 0 (none) to 3 (severe). */
  distress: number;
  distressConfidence: number;
}

export function textEmotionEnabled(): boolean {
  return Boolean(process.env.TYPESAFE_API_KEY) && process.env.SIYA_TEXT_EMOTION !== "off";
}

export function distressLabel(distress: number): string {
  return DISTRESS_LEVELS[Math.max(0, Math.min(3, Math.round(distress)))];
}

export async function readTextEmotion(text: string, timeoutMs = 8_000): Promise<TextEmotionReading | null> {
  const key = process.env.TYPESAFE_API_KEY;
  if (!key || !textEmotionEnabled()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "jev-latest",
        state: text.slice(0, 2_000),
        questions: {
          emotion: {
            type: "choice",
            instructions: "Which emotion does the speaker most feel right now? They may speak English, Hindi or Hinglish.",
            criteria: Object.fromEntries(TEXT_EMOTIONS.map((label) => [label, null])),
          },
          distress: {
            type: "score",
            instructions: "How much emotional distress is the speaker in?",
            criteria: [...DISTRESS_LEVELS],
          },
        },
      }),
    });
    if (!response.ok) {
      console.warn(`[Text Emotion] TypeSafe returned HTTP ${response.status}.`);
      return null;
    }
    const data = await response.json() as {
      answers?: {
        emotion?: { choice?: string; confidence?: number };
        distress?: { score?: number; confidence?: number };
      };
    };
    const emotion = data.answers?.emotion;
    const distress = data.answers?.distress;
    if (typeof emotion?.choice !== "string" || typeof distress?.score !== "number") return null;
    return {
      emotion: emotion.choice,
      emotionConfidence: Number(emotion.confidence) || 0,
      distress: distress.score,
      distressConfidence: Number(distress.confidence) || 0,
    };
  } catch (error) {
    console.warn(`[Text Emotion] ${error instanceof Error ? error.message : String(error)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
