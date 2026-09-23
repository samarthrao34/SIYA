/*
 * Recovered from SIYA-Setup-1.0.1.exe (dist/assets/index-qnLjC2CG.js), a
 * minified Vite/Rollup bundle with NO sourcemap. De-minified with prettier
 * and reorganized into this file by inferring component boundaries; the
 * top-level name(s) below were renamed for readability from their minified
 * originals (noted in a comment where relevant). Internal local variable
 * names inside function bodies are still the original minified short names
 * -- full renaming of those was out of scope. Behavior preserved verbatim.
 *
 * ts-nocheck below: this class assigns its fields inside one grouped
 * comma-expression in the constructor (minifier output), which defeats
 * TypeScript's constructor-based property inference, and it also touches
 * non-standard browser globals (webkitSpeechRecognition, webkitAudioContext)
 * with no lib.dom types. Left untyped rather than guessing field types.
 */
// @ts-nocheck


export function getSpeechRecognitionCtor() {
  if (typeof window > "u") return null;
  const a = window;
  return a.SpeechRecognition || a.webkitSpeechRecognition || null;
}
export class WakeWordListener {
  constructor() {
    ((this.recognition = null),
      (this.phrase = "hey siya"),
      (this.sensitivity = 60),
      (this.onTriggered = null),
      (this.onState = null),
      (this.intended = !1),
      (this.active = !1),
      (this.lastTrigger = 0),
      (this.debounceMs = 4e3),
      (this.restartTimer = null),
      (this.consecutiveErrors = 0),
      (this.ctor = getSpeechRecognitionCtor()));
  }
  static isSupported() {
    return getSpeechRecognitionCtor() !== null;
  }
  start(i) {
    return this.ctor
      ? ((this.phrase = (i.phrase || "hey siya").toLowerCase().trim()),
        (this.sensitivity = i.sensitivity ?? this.sensitivity),
        (this.onTriggered = i.onTriggered ?? null),
        (this.onState = i.onState ?? null),
        (this.debounceMs = Math.round(7e3 - (this.sensitivity / 100) * 5500)),
        (this.intended = !0),
        (this.consecutiveErrors = 0),
        this.launch(),
        !0)
      : (this.setState("error"), !1);
  }
  stop() {
    ((this.intended = !1),
      this.restartTimer &&
        (clearTimeout(this.restartTimer), (this.restartTimer = null)),
      this.teardown(),
      this.setState("stopped"));
  }
  setPhrase(i) {
    this.phrase = (i || "hey siya").toLowerCase().trim();
  }
  setSensitivity(i) {
    ((this.sensitivity = Math.max(0, Math.min(100, i))),
      (this.debounceMs = Math.round(7e3 - (this.sensitivity / 100) * 5500)));
  }
  launch() {
    if (!(!this.ctor || !this.intended)) {
      this.teardown();
      try {
        const i = new this.ctor();
        ((i.continuous = !0),
          (i.interimResults = !0),
          (i.lang = "en-US"),
          (i.maxAlternatives = 3),
          (i.onstart = () => {
            ((this.consecutiveErrors = 0),
              (this.active = !0),
              this.setState("listening"));
          }),
          (i.onresult = (s) => {
            var o;
            for (let r = s.resultIndex; r < s.results.length; r++) {
              const h = s.results[r];
              if (h) {
                for (let f = 0; f < h.length; f++)
                  if (
                    (((o = h[f]) == null ? void 0 : o.transcript) || "")
                      .toString()
                      .toLowerCase()
                      .includes(this.phrase)
                  ) {
                    this.fire();
                    return;
                  }
              }
            }
          }),
          (i.onerror = (s) => {
            const o = (s == null ? void 0 : s.error) || "unknown";
            o === "no-speech" ||
              o === "aborted" ||
              (this.consecutiveErrors++, this.setState("error"));
          }),
          (i.onend = () => {
            if (((this.active = !1), !this.intended)) return;
            const s = Math.min(1e3 * this.consecutiveErrors * 2, 15e3);
            this.restartTimer = setTimeout(
              () => this.launch(),
              Math.max(150, s),
            );
          }),
          (this.recognition = i),
          i.start());
      } catch {
        (this.setState("error"),
          (this.restartTimer = setTimeout(() => this.launch(), 1e3)));
      }
    }
  }
  teardown() {
    if (this.recognition) {
      try {
        ((this.recognition.onresult = null),
          (this.recognition.onerror = null),
          (this.recognition.onend = null),
          (this.recognition.onstart = null),
          this.recognition.abort());
      } catch {}
      this.recognition = null;
    }
    this.active = !1;
  }
  fire() {
    var s;
    const i = Date.now();
    if (!(i - this.lastTrigger < this.debounceMs)) {
      ((this.lastTrigger = i),
        this.playActivationSound(),
        this.setState("triggered"));
      try {
        (s = this.onTriggered) == null || s.call(this);
      } catch {}
    }
  }
  playActivationSound() {
    try {
      const i = window.AudioContext || window.webkitAudioContext;
      if (!i) return;
      const s = new i(),
        o = s.currentTime;
      ([
        { f: 660, t: 0 },
        { f: 880, t: 0.12 },
      ].forEach(({ f: h, t: f }) => {
        const d = s.createOscillator(),
          g = s.createGain();
        ((d.type = "sine"),
          (d.frequency.value = h),
          g.gain.setValueAtTime(1e-4, o + f),
          g.gain.exponentialRampToValueAtTime(0.18, o + f + 0.02),
          g.gain.exponentialRampToValueAtTime(1e-4, o + f + 0.18),
          d.connect(g),
          g.connect(s.destination),
          d.start(o + f),
          d.stop(o + f + 0.2));
      }),
        setTimeout(() => s.close().catch(() => {}), 600));
    } catch {}
  }
  setState(i) {
    var s;
    try {
      (s = this.onState) == null || s.call(this, i);
    } catch {}
  }
  get isActive() {
    return this.active;
  }
}
