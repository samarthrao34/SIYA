/*
 * Recovered from SIYA-Setup-1.0.1.exe (dist/assets/index-qnLjC2CG.js), a
 * minified Vite/Rollup bundle with NO sourcemap. De-minified with prettier
 * and reorganized into this file by inferring component boundaries; the
 * top-level name(s) below were renamed for readability from their minified
 * originals (noted in a comment where relevant). Internal local variable
 * names inside function bodies are still the original minified short names
 * -- full renaming of those was out of scope. Behavior preserved verbatim.
 */



export const DEFAULT_SETTINGS = {
    autoStart: !1,
    wakeWordEnabled: !1,
    wakePhrase: "hey siya",
    micDeviceId: "",
    camDeviceId: "",
    voiceName: "Leda",
    sensitivity: 60,
    animations: !0,
    characterShine: 50,
  },
  SETTINGS_STORAGE_KEY = "siya.settings.v2",
  SETTINGS_EXCLUDED_KEYS = new Set([]);
export function loadSettings() {
  if (typeof window > "u") return { ...DEFAULT_SETTINGS };
  try {
    const a = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!a) return { ...DEFAULT_SETTINGS };
    const i = JSON.parse(a),
      s = { ...DEFAULT_SETTINGS, ...i },
      o = Number(s.characterShine);
    return {
      ...s,
      characterShine: Number.isFinite(o) ? Math.max(0, Math.min(100, o)) : 50,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
// Serialize writes so rapid changes cannot overwrite a newer setting.
let saveQueue: Promise<unknown> = Promise.resolve();
export function saveSettings(patch) {
  const operation = saveQueue.catch(() => {}).then(async () => {
    const next = { ...loadSettings(), ...patch };
    await syncSettingsToServer(patch);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    return next;
  });
  saveQueue = operation;
  return operation;
}
export async function syncSettingsToServer(settings) {
  const response = await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Settings could not be saved (${response.status}).`);
  }
}
