// On-device behaviour and gesture reading for SIYA's camera: how the user is
// doing when they are *not* talking. Facial expression alone is a snapshot;
// this watches patterns over the last minutes -- yawns, heavy eyes, head
// hanging down, fidgeting, hands on the face or head in hands, and moods
// held for a long time -- and turns them into one behavioural state.
//
// Everything runs locally (MediaPipe FaceLandmarker + HandLandmarker, models
// bundled under public/models/), sampled ~4x a second by MainExperience.tsx.
// Only the final state and its human-readable cues reach the server.
//
// Thresholds are first-pass values tuned on typical webcam blendshape and
// landmark ranges; each cue needs to persist over several samples, so one
// odd frame never creates a state.

import { FilesetResolver, HandLandmarker, type FaceLandmarkerResult, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { classifyBlendshapes, type Emotion } from "./emotionDetector";

export type BehaviorState = "calm" | "tired" | "stressed" | "frustrated" | "low" | "restless" | "cheerful" | "away";

export interface BehaviorReading {
  state: BehaviorState;
  confidence: number; // 0..1
  cues: string[];
}

let handPromise: Promise<HandLandmarker> | null = null;

/** Lazily creates (once) and caches the HandLandmarker instance. */
export function ensureHandDetector(): Promise<HandLandmarker> {
  if (!handPromise) {
    handPromise = FilesetResolver.forVisionTasks("/mediapipe/wasm")
      .then((vision) => HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      }))
      .catch((err) => {
        handPromise = null; // allow retry on a later camera start
        throw err;
      });
  }
  return handPromise;
}

interface Sample {
  t: number;
  face: boolean;
  emotion: Emotion;
  jawOpen: number;
  eyesClosed: number;
  pitch: number; // (nose - forehead) / (chin - forehead): grows as the head tips down
  cx: number; // nose position in face widths, for movement
  cy: number;
  handsOnFace: number;
  handNearEyes: boolean;
}

type Point = { x: number; y: number };

const WINDOW_MS = 3 * 60_000;
const FOREHEAD = 10, NOSE = 1, CHIN = 152, FACE_LEFT = 234, FACE_RIGHT = 454;
const FINGERTIPS = [4, 8, 12, 16, 20];

function runs(samples: Sample[], test: (s: Sample) => boolean, minMs: number): number {
  let count = 0;
  let start: number | null = null;
  let counted = false;
  for (const s of samples) {
    if (test(s)) {
      if (start === null) (start = s.t), (counted = false);
      if (!counted && s.t - start >= minMs) (count += 1), (counted = true);
    } else start = null;
  }
  return count;
}

function fraction(samples: Sample[], test: (s: Sample) => boolean): number {
  return samples.length ? samples.filter(test).length / samples.length : 0;
}

export class BehaviorAnalyzer {
  private samples: Sample[] = [];
  private pitchBaseline: number | null = null;
  private readonly calibration: number[] = [];

  push(face: FaceLandmarkerResult | null, hands: HandLandmarkerResult | null, t = performance.now()): void {
    const landmarks = face?.faceLandmarks?.[0];
    const blend = face?.faceBlendshapes?.[0]?.categories;
    if (!landmarks?.length || !blend?.length) {
      this.add({ t, face: false, emotion: "neutral", jawOpen: 0, eyesClosed: 0, pitch: 0, cx: 0, cy: 0, handsOnFace: 0, handNearEyes: false });
      return;
    }
    const get = (name: string) => blend.find((c) => c.categoryName === name)?.score ?? 0;
    const forehead = landmarks[FOREHEAD], nose = landmarks[NOSE], chin = landmarks[CHIN];
    const width = Math.max(1e-3, Math.abs(landmarks[FACE_RIGHT].x - landmarks[FACE_LEFT].x));
    const pitch = (nose.y - forehead.y) / Math.max(1e-3, chin.y - forehead.y);

    // Face box, padded a little so a hand resting on the cheek or forehead counts.
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (const p of landmarks) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const padX = (maxX - minX) * 0.15, padY = (maxY - minY) * 0.15;
    const inFace = (p: Point) => p.x >= minX - padX && p.x <= maxX + padX && p.y >= minY - padY && p.y <= maxY + padY;
    const inEyeBand = (p: Point) => p.x >= minX && p.x <= maxX && p.y >= forehead.y && p.y <= nose.y;

    let handsOnFace = 0;
    let handNearEyes = false;
    for (const hand of hands?.landmarks ?? []) {
      if (hand.filter(inFace).length / hand.length >= 0.3) handsOnFace += 1;
      if (FINGERTIPS.some((i) => hand[i] && inEyeBand(hand[i]))) handNearEyes = true;
    }

    this.add({
      t,
      face: true,
      emotion: classifyBlendshapes(blend).emotion,
      jawOpen: get("jawOpen"),
      eyesClosed: (get("eyeBlinkLeft") + get("eyeBlinkRight")) / 2,
      pitch,
      cx: nose.x / width,
      cy: nose.y / width,
      handsOnFace,
      handNearEyes,
    });
  }

  private add(sample: Sample): void {
    this.samples.push(sample);
    const cutoff = sample.t - WINDOW_MS;
    while (this.samples.length && this.samples[0].t < cutoff) this.samples.shift();
    if (!sample.face) return;
    // Personal head-pitch baseline: the median of the first ~10 s, then a
    // slow drift (~3 min) so a changed seating position is absorbed but a
    // sustained slump is not.
    if (this.pitchBaseline === null) {
      this.calibration.push(sample.pitch);
      if (this.calibration.length >= 40) {
        const sorted = [...this.calibration].sort((a, b) => a - b);
        this.pitchBaseline = sorted[Math.floor(sorted.length / 2)];
      }
    } else {
      this.pitchBaseline += (sample.pitch - this.pitchBaseline) * 0.0015;
    }
  }

  reset(): void {
    this.samples = [];
    this.pitchBaseline = null;
    this.calibration.length = 0;
  }

  read(now = performance.now()): BehaviorReading | null {
    const all = this.samples;
    if (all.length < 20) return null;
    const last = (ms: number) => all.filter((s) => now - s.t <= ms);
    const recent = last(20_000);
    const faceRecent = recent.filter((s) => s.face);
    if (fraction(recent, (s) => s.face) < 0.2) {
      return { state: "away", confidence: 0.9, cues: ["not in front of the camera"] };
    }

    const cues: string[] = [];
    const score: Record<Exclude<BehaviorState, "calm" | "away">, number> = {
      tired: 0, stressed: 0, frustrated: 0, low: 0, restless: 0, cheerful: 0,
    };

    // Tiredness: yawns (mouth wide open >= 1.2 s), eyes kept closed >= 1 s
    // (a blink is ~0.15 s), and rubbing the eyes.
    const yawns = runs(all, (s) => s.face && s.jawOpen > 0.5, 1_200);
    const heavyEyes = runs(all, (s) => s.face && s.eyesClosed > 0.6, 1_000);
    // Fingers at the eyes with only one hand on the face; two hands there is head-in-hands.
    const rubbingEyes = fraction(last(8_000), (s) => s.handNearEyes && s.handsOnFace < 2) >= 0.3;
    if (yawns) cues.push(`yawned ${yawns === 1 ? "once" : `${yawns} times`} in the last few minutes`);
    if (heavyEyes >= 2) cues.push("eyes drooping shut for a second or more, repeatedly");
    if (rubbingEyes) cues.push("rubbing their eyes");
    score.tired += Math.min(0.7, yawns * 0.35) + (heavyEyes >= 2 ? Math.min(0.5, heavyEyes * 0.15) : 0) + (rubbingEyes ? 0.3 : 0);

    // Head hanging down, held for most of the last 20 s.
    const headDown = this.pitchBaseline !== null && faceRecent.length >= 20
      && fraction(faceRecent, (s) => s.pitch - (this.pitchBaseline as number) > 0.07) >= 0.7;
    if (headDown) cues.push("head hanging down for a while");

    // Hands on the face / head in hands, over the last 10 s.
    const last10 = last(10_000);
    const headInHands = fraction(last10, (s) => s.handsOnFace >= 2) >= 0.5;
    const handOnFace = !headInHands && fraction(last10, (s) => s.handsOnFace >= 1) >= 0.6;
    if (headInHands) cues.push("head in their hands");
    else if (handOnFace) cues.push("resting a hand on their face or forehead");

    // Fidgeting: how much the head keeps moving, in face widths.
    let jumps = 0;
    for (let i = 1; i < faceRecent.length; i++) {
      const a = faceRecent[i - 1], b = faceRecent[i];
      if (Math.hypot(b.cx - a.cx, b.cy - a.cy) > 0.12) jumps += 1;
    }
    const restless = faceRecent.length >= 20 && jumps / faceRecent.length > 0.2;
    if (restless) cues.push("fidgeting and moving around a lot");

    // Moods held for most of the last 30 s -- not a passing expression.
    const last30 = last(30_000).filter((s) => s.face);
    const held = (emotion: Emotion) => last30.length >= 30 && fraction(last30, (s) => s.emotion === emotion) >= 0.6;
    const heldAngry = held("angry"), heldSad = held("sad"), heldHappy = held("happy"), heldFear = held("fearful");
    if (heldAngry) cues.push("frowning with lowered brows for a long stretch");
    if (heldSad) cues.push("a sad expression that has not lifted");
    if (heldHappy) cues.push("smiling for a good while");
    if (heldFear) cues.push("looking worried for a long stretch");

    score.stressed += (headInHands ? 0.7 : 0) + (handOnFace && (heldAngry || heldFear || heldSad) ? 0.5 : 0) + (restless && heldFear ? 0.3 : 0);
    score.frustrated += (heldAngry ? 0.6 : 0) + (heldAngry && (handOnFace || restless) ? 0.15 : 0);
    score.low += (heldSad ? 0.5 : 0) + (headDown ? 0.3 : 0) + (headDown && heldSad ? 0.1 : 0);
    score.tired += headDown && !heldSad ? 0.2 : 0;
    score.restless += (restless ? 0.5 : 0) + (restless && heldFear ? 0.2 : 0);
    score.cheerful += heldHappy ? 0.6 : 0;

    let state: BehaviorState = "calm";
    let best = 0;
    for (const [name, value] of Object.entries(score) as Array<[BehaviorState, number]>) {
      if (value > best) (best = value), (state = name);
    }
    if (best < 0.45) return { state: "calm", confidence: 1 - best, cues };
    return { state, confidence: Math.min(1, best), cues };
  }
}
