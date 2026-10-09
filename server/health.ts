/**
 * SIYA — wearable health data storage.
 *
 * Mirrors the memory/settings persistence pattern (server/paths.ts's
 * dataFile()): a single append-only JSON-lines file in the per-user data
 * directory. No second storage system, no external database -- readings
 * persist across app restarts the same way memories and settings do.
 *
 * Readings arrive from desktop_agent's getHeartRate/getBloodOxygen tools
 * (live BLE sync with the paired watch) via a periodic collector in
 * server/index.ts, and get appended here. Everything the dashboard and SIYA's
 * conversational tools need reads back from this file -- never from the
 * watch directly, so a stale/out-of-range watch doesn't block history
 * queries.
 */
import fs from "fs";
import { dataFile } from "./paths";
import { decryptText, encryptText } from "./secureStore";

export interface HealthReading {
  /** ISO 8601 timestamp of when this reading was captured. */
  timestamp: string;
  heartRate?: number;
  spo2?: number;
}

const HEALTH_FILE = dataFile("health_history.jsonl");

export function appendHealthReading(reading: HealthReading): void {
  try {
    fs.appendFileSync(HEALTH_FILE, encryptText(JSON.stringify(reading)) + "\n", "utf-8");
  } catch {
    /* best-effort, matches the rest of SIYA's local persistence */
  }
}

/** Rewrite the history so every line uses the current (encrypted) format. */
export function reencryptHealthHistory(): void {
  if (!fs.existsSync(HEALTH_FILE)) return;
  const readings = loadAllHealthReadings();
  const temp = `${HEALTH_FILE}.tmp`;
  fs.writeFileSync(temp, readings.map((r) => encryptText(JSON.stringify(r)) + "\n").join(""), "utf-8");
  fs.renameSync(temp, HEALTH_FILE);
}

/** "Delete all my data": remove every stored health reading. */
export function deleteHealthHistory(): void {
  fs.rmSync(HEALTH_FILE, { force: true });
}

export function loadAllHealthReadings(): HealthReading[] {
  try {
    if (!fs.existsSync(HEALTH_FILE)) return [];
    const lines = fs.readFileSync(HEALTH_FILE, "utf-8").split("\n").filter(Boolean);
    const out: HealthReading[] = [];
    for (const line of lines) {
      try {
        const parsed = JSON.parse(decryptText(line));
        if (parsed && typeof parsed.timestamp === "string") out.push(parsed);
      } catch {
        /* skip a corrupt line rather than fail the whole read */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export type HealthRange = "live" | "1h" | "today" | "7d" | "30d" | "all";
export const HEALTH_RANGES: readonly HealthRange[] = ["live", "1h", "today", "7d", "30d", "all"];

export function isHealthRange(value: unknown): value is HealthRange {
  return typeof value === "string" && (HEALTH_RANGES as readonly string[]).includes(value);
}

export function rangeStartMs(range: HealthRange, now: number = Date.now()): number {
  switch (range) {
    case "live":
      return now - 5 * 60 * 1000;
    case "1h":
      return now - 60 * 60 * 1000;
    case "today": {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "7d":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return now - 30 * 24 * 60 * 60 * 1000;
    case "all":
    default:
      return 0;
  }
}

export function loadHealthReadings(range: HealthRange, now: number = Date.now()): HealthReading[] {
  const start = rangeStartMs(range, now);
  return loadAllHealthReadings()
    .filter((r) => {
      const t = Date.parse(r.timestamp);
      return !Number.isNaN(t) && t >= start && t <= now;
    })
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export interface MetricStats {
  latest: number | null;
  latestAt: string | null;
  min: number | null;
  max: number | null;
  avg: number | null;
  count: number;
}

function statsFor(readings: HealthReading[], field: "heartRate" | "spo2"): MetricStats {
  const points = readings.filter((r) => typeof r[field] === "number");
  if (points.length === 0) {
    return { latest: null, latestAt: null, min: null, max: null, avg: null, count: 0 };
  }
  const values = points.map((p) => p[field] as number);
  const last = points[points.length - 1];
  return {
    latest: last[field] as number,
    latestAt: last.timestamp,
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    count: values.length,
  };
}

export interface HealthSummary {
  range: HealthRange;
  heartRate: MetricStats;
  spo2: MetricStats;
}

export function healthSummary(range: HealthRange, now: number = Date.now()): HealthSummary {
  const readings = loadHealthReadings(range, now);
  return {
    range,
    heartRate: statsFor(readings, "heartRate"),
    spo2: statsFor(readings, "spo2"),
  };
}

/** Evenly-spaced downsampling so long ranges stay cheap for charts/tool payloads. */
export function downsample(readings: HealthReading[], maxPoints: number): HealthReading[] {
  if (readings.length <= maxPoints || maxPoints <= 0) return readings;
  const step = readings.length / maxPoints;
  const out: HealthReading[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(readings[Math.floor(i * step)]);
  }
  return out;
}

export function toCsv(readings: HealthReading[]): string {
  const lines = ["Timestamp,Heart Rate (BPM),SpO2 (%)"];
  for (const r of readings) {
    lines.push(`${r.timestamp},${r.heartRate ?? ""},${r.spo2 ?? ""}`);
  }
  return lines.join("\n");
}
