// On-device facial emotion detection for the "SIYA sees you through your
// camera" feature (see src/components/MainExperience.tsx: startCamera /
// sendCameraFrame). Runs entirely locally via MediaPipe's FaceLandmarker
// (WASM + a bundled float16 model, both served from public/ -- no network
// call at runtime), so it works offline and doesn't add per-frame latency
// to the Gemini Live video stream it rides alongside.
//
// FaceLandmarker's blendshapes are 52 ARKit-style facial-action-unit scores
// (mouthSmileLeft, browDownLeft, jawOpen, ...). Precise emotion reads come
// from combining the right blendshapes per emotion, not from asking a
// vision LLM to eyeball a single frame.

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export type Emotion = "happy" | "sad" | "angry" | "surprised" | "fearful" | "disgusted" | "neutral";

export interface EmotionReading {
  emotion: Emotion;
  confidence: number; // 0..1
  scores: Partial<Record<Emotion, number>>;
}

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "GPU",
    },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
    runningMode: "VIDEO",
    numFaces: 1,
  });
}

/** Lazily creates (once) and caches the FaceLandmarker instance. */
export function ensureEmotionDetector(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = loadFaceLandmarker().catch((err) => {
      landmarkerPromise = null; // allow retry on a later camera start
      throw err;
    });
  }
  return landmarkerPromise;
}

// Weighted blendshape combinations per emotion. Weights are relative, not
// required to sum to 1 -- each emotion's raw score is its own weighted
// average, so different emotions stay comparable regardless of how many
// blendshapes feed them.
const EMOTION_WEIGHTS: Record<Exclude<Emotion, "neutral" | "angry">, Record<string, number>> = {
  happy: {
    mouthSmileLeft: 1,
    mouthSmileRight: 1,
    cheekSquintLeft: 0.4,
    cheekSquintRight: 0.4,
  },
  sad: {
    mouthFrownLeft: 1,
    mouthFrownRight: 1,
    browInnerUp: 0.5,
    mouthLowerDownLeft: 0.25,
    mouthLowerDownRight: 0.25,
  },
  surprised: {
    browOuterUpLeft: 0.8,
    browOuterUpRight: 0.8,
    eyeWideLeft: 0.6,
    eyeWideRight: 0.6,
    jawOpen: 0.9,
  },
  fearful: {
    browInnerUp: 0.6,
    eyeWideLeft: 0.55,
    eyeWideRight: 0.55,
    mouthStretchLeft: 0.45,
    mouthStretchRight: 0.45,
  },
  disgusted: {
    noseSneerLeft: 1,
    noseSneerRight: 1,
    mouthUpperUpLeft: 0.5,
    mouthUpperUpRight: 0.5,
  },
};

// Anger is scored separately: its one reliable blendshape is lowered brows,
// and averaging that with sneer/lip-press (which barely move in most real
// angry faces) diluted it below the server's 0.45 "strong emotion" bar, so
// anger was never reported. Lowered brows carry the score; squint, pressed
// lips and sneer add to it; a smile, raised inner brows (worry/sadness) or a
// raised upper lip (disgust) pull it back down.
function scoreAnger(get: (name: string) => number): number {
  const avg = (a: string, b: string) => (get(a) + get(b)) / 2;
  const browDown = avg("browDownLeft", "browDownRight");
  const squint = avg("eyeSquintLeft", "eyeSquintRight");
  const press = avg("mouthPressLeft", "mouthPressRight");
  const sneer = avg("noseSneerLeft", "noseSneerRight");
  const upperLip = avg("mouthUpperUpLeft", "mouthUpperUpRight");
  const smile = avg("mouthSmileLeft", "mouthSmileRight");
  // Many faces rest with slightly lowered brows; only lowering beyond that counts.
  let score =
    Math.max(0, browDown - 0.1) * 1.15
    + Math.max(0, squint - 0.2) * 0.35
    + press * 0.25
    + sneer * 0.25
    - get("browInnerUp") * 0.3
    - upperLip * 0.4;
  if (smile > 0.25) score *= 0.3;
  return Math.max(0, Math.min(1, score));
}

// The winning emotion's score must clear this to count as a real read;
// below it the face is closer to neutral than to any single expression.
const CONFIDENCE_FLOOR = 0.18;

export function classifyBlendshapes(
  categories: Array<{ categoryName: string; score: number }>,
): EmotionReading {
  const byName = new Map(categories.map((c) => [c.categoryName, c.score]));
  const scores: Partial<Record<Emotion, number>> = {};

  const angry = scoreAnger((name) => byName.get(name) ?? 0);
  scores.angry = angry;
  let best: Emotion = angry > 0 ? "angry" : "neutral";
  let bestScore = angry;
  for (const emotion of Object.keys(EMOTION_WEIGHTS) as Array<Exclude<Emotion, "neutral" | "angry">>) {
    const weights = EMOTION_WEIGHTS[emotion];
    let sum = 0;
    let weightSum = 0;
    for (const [blendshape, weight] of Object.entries(weights)) {
      sum += (byName.get(blendshape) ?? 0) * weight;
      weightSum += weight;
    }
    const score = weightSum > 0 ? sum / weightSum : 0;
    scores[emotion] = score;
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }

  if (bestScore < CONFIDENCE_FLOOR) {
    return { emotion: "neutral", confidence: 1 - bestScore, scores };
  }
  return { emotion: best, confidence: Math.max(0, Math.min(1, bestScore)), scores };
}

export function detectEmotion(
  landmarker: FaceLandmarker,
  videoEl: HTMLVideoElement,
  timestampMs: number,
): EmotionReading | null {
  const result = landmarker.detectForVideo(videoEl, timestampMs);
  const categories = result.faceBlendshapes?.[0]?.categories;
  if (!categories || !categories.length) return null;
  return classifyBlendshapes(categories);
}

/**
 * Smooths raw per-frame readings into a stable signal: a single noisy frame
 * (blink, head turn) shouldn't flip the detected emotion. Confidence-weighted
 * majority vote over a short sliding window.
 */
export class EmotionSmoother {
  private readonly history: EmotionReading[] = [];

  constructor(private readonly windowSize = 3) {}

  push(reading: EmotionReading): EmotionReading {
    this.history.push(reading);
    if (this.history.length > this.windowSize) this.history.shift();

    const tally = new Map<Emotion, number>();
    for (const r of this.history) tally.set(r.emotion, (tally.get(r.emotion) ?? 0) + r.confidence);

    let best: Emotion = reading.emotion;
    let bestTally = -1;
    for (const [emotion, score] of tally) {
      if (score > bestTally) {
        bestTally = score;
        best = emotion;
      }
    }

    const matching = this.history.filter((r) => r.emotion === best);
    const avgConfidence = matching.reduce((sum, r) => sum + r.confidence, 0) / matching.length;
    return { emotion: best, confidence: avgConfidence, scores: reading.scores };
  }
}
