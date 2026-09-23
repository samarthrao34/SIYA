/*
 * Recovered from SIYA-Setup-1.0.1.exe (dist/assets/index-qnLjC2CG.js), a
 * minified Vite/Rollup bundle with NO sourcemap. De-minified with prettier
 * and reorganized into this file by inferring component boundaries; the
 * top-level name(s) below were renamed for readability from their minified
 * originals (noted in a comment where relevant). Internal local variable
 * names inside function bodies are still the original minified short names
 * -- full renaming of those was out of scope. Behavior preserved verbatim.
 *
 * UI sizing (container widths, padding, gaps, icon sizes) shrunk down from
 * the originally recovered values per user request -- functionality/logic
 * untouched.
 */

import * as L from "react";
import * as b from "react/jsx-runtime";
import { motion as mn, AnimatePresence as Ti } from "motion/react";
import { Mic as $g, X as Is, KeyRound as Jg, Check as Jx, Sparkles as Qo, Settings as ey, Volume2 as iy, TriangleAlert as ny, LoaderCircle as th, Power as ty, Info as vp, Cpu as yp } from "lucide-react";

// Gemini Live prebuilt voices with a clearly higher-pitched/female-leaning
// character, per Google's voice list. "Leda" is the default -- if it still
// doesn't land right, try the others here.
const VOICE_OPTIONS = [
  { id: "Leda", label: "Leda (Youthful)" },
  { id: "Zephyr", label: "Zephyr (Bright)" },
  { id: "Aoede", label: "Aoede (Breezy)" },
  { id: "Kore", label: "Kore (Firm)" },
  { id: "Autonoe", label: "Autonoe (Bright)" },
  { id: "Callirrhoe", label: "Callirrhoe (Easy-going)" },
];

export function ToggleRow({ label: a, description: i, checked: s, onChange: o }) {
  return b.jsxs("div", {
    className:
      "pt-1.5 border-t border-white/5 flex items-center justify-between text-left",
    children: [
      b.jsxs("div", {
        className: "flex flex-col",
        children: [
          b.jsx("span", {
            className: "text-[8px] font-bold font-mono text-slate-200",
            children: a,
          }),
          b.jsx("span", {
            className:
              "text-[7px] text-slate-400 uppercase font-mono max-w-[160px]",
            children: i,
          }),
        ],
      }),
      b.jsx("button", {
        onClick: () => o(!s),
        role: "switch",
        "aria-label": a,
        "aria-checked": s,
        className: `w-7 h-3.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${s ? "bg-cyan-500" : "bg-white/10"}`,
        children: b.jsx("div", {
          className: `bg-white w-2.5 h-2.5 rounded-full shadow-md transform duration-200 ease-in-out ${s ? "translate-x-3.5" : "translate-x-0"}`,
        }),
      }),
    ],
  });
}
export function SettingsPanel({
  isOpen: a,
  onClose: i,
  settings: s,
  onChange: o,
  themeColor: r,
  saveError = null,
  saving = false,
}) {
  const [h, f] = L.useState("general"),
    [d, g] = L.useState([]),
    [camDevices, setCamDevices] = L.useState([]),
    [m, y] = L.useState<{ online: boolean; toolCount?: number; error?: string }>({ online: !1 }),
    [v, S] = L.useState(!1),
    [T, A] = L.useState(""),
    [N, D] = L.useState(!1),
    [_, Y] = L.useState(null);
  (L.useEffect(() => {
    a &&
      fetch("/api/config", { cache: "no-store" })
        .then((F) => F.json())
        .then((F) => S(!!F.hasApiKey))
        .catch(() => S(!1));
  }, [a]),
    L.useEffect(() => {
      if (!a) return;
      (async () => {
        var k;
        try {
          if (!((k = navigator.mediaDevices) != null && k.enumerateDevices))
            return;
          const U = await navigator.mediaDevices.enumerateDevices();
          g(U.filter((W) => W.kind === "audioinput"));
          setCamDevices(U.filter((W) => W.kind === "videoinput"));
        } catch {}
      })();
    }, [a]),
    L.useEffect(() => {
      if (!a) return;
      const F = async () => {
        try {
          const U = await fetch("http://127.0.0.1:8765/health", {
            cache: "no-store",
          });
          if (!U.ok) {
            y({ online: !1 });
            return;
          }
          const W = await U.json();
          y({ online: !0, toolCount: W.tool_count });
        } catch {
          try {
            const U = await fetch("/api/agent-health", { cache: "no-store" });
            if (U.ok) {
              const W = await U.json();
              y({ online: !!W.online, toolCount: W.tool_count });
              return;
            }
          } catch {}
          y({ online: !1 });
        }
      };
      F();
      const k = setInterval(F, 5e3);
      return () => clearInterval(k);
    }, [a]));
  const X = async () => {
      const F = T.trim();
      if (!(!F || N)) {
        (D(!0), Y(null));
        try {
          const k = await fetch("/api/config/apikey", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ apiKey: F }),
            }),
            U = await k.text();
          let W: { error?: string } = {};
          try {
            W = U ? JSON.parse(U) : {};
          } catch {
            throw new Error("SIYA backend returned an invalid response.");
          }
          if (!k.ok)
            throw new Error(W.error || "The API key could not be saved.");
          (S(!0),
            A(""),
            Y({
              ok: !0,
              text: "API key verified and saved. Restart the voice link with Awake Siya.",
            }));
        } catch (k) {
          Y({
            ok: !1,
            text:
              k instanceof Error
                ? k.message
                : "The API key could not be saved.",
          });
        } finally {
          D(!1);
        }
      }
    },
    P = () => {
      switch (r) {
        case "violet":
          return "border-purple-500/30 text-purple-400 bg-purple-500/10";
        case "crimson":
          return "border-rose-500/30 text-rose-400 bg-rose-500/10";
        case "emerald":
          return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
        case "celestial":
          return "border-sky-500/30 text-sky-400 bg-sky-500/10";
        case "gold":
          return "border-amber-500/30 text-amber-400 bg-amber-500/10";
        case "rose":
          return "border-pink-500/30 text-pink-400 bg-pink-500/10";
        case "dusk":
          return "border-orange-300/30 text-orange-200 bg-orange-300/10";
        case "charcoal":
        default:
          return "border-indigo-500/30 text-indigo-400 bg-indigo-500/10";
      }
    },
    tt = [
      { id: "general", label: "GENERAL", icon: ty },
      { id: "character", label: "CHARACTER", icon: Qo },
      { id: "voice", label: "VOICE", icon: $g },
      { id: "system", label: "SYSTEM", icon: yp },
      { id: "about", label: "ABOUT", icon: vp },
    ];
  return b.jsx(Ti, {
    children:
      a &&
      b.jsxs(b.Fragment, {
        children: [
          b.jsx(mn.div, {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            onClick: i,
            className: "absolute inset-0 bg-black/60 z-40 backdrop-blur-sm",
          }),
          b.jsxs(mn.div, {
            initial: { x: "100%" },
            animate: { x: 0 },
            exit: { x: "100%" },
            transition: { type: "spring", damping: 25, stiffness: 200 },
            className:
              "absolute inset-y-0 right-0 w-full max-w-[230px] bg-[#020206]/95 border-l border-white/15 backdrop-blur-2xl z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]",
            children: [
              b.jsxs("div", {
                className:
                  "p-2 border-b border-white/10 flex items-center justify-between",
                children: [
                  b.jsxs("div", {
                    className: "flex items-center gap-1.5",
                    children: [
                      b.jsx("div", {
                        className: `p-1.5 rounded-lg border ${P()}`,
                        children: b.jsx(ey, {
                          size: 13,
                          className: "animate-spin [animation-duration:6s]",
                        }),
                      }),
                      b.jsxs("div", {
                        children: [
                          b.jsxs("h3", {
                            className:
                              "font-display font-medium text-[10px] tracking-tight text-white flex items-center gap-1",
                            children: [
                              "Siya Configuration",
                              b.jsx(Qo, {
                                size: 9,
                                className: "text-cyan-400",
                              }),
                            ],
                          }),
                          b.jsx("p", {
                            className:
                              "text-[7px] font-mono uppercase tracking-widest text-slate-400 mt-0.5",
                            children: "System settings & preferences",
                          }),
                        ],
                      }),
                    ],
                  }),
                  b.jsx("button", {
                    onClick: i,
                    className:
                      "p-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer",
                    children: b.jsx(Is, { size: 11 }),
                  }),
                ],
              }),
              b.jsx("div", {
                className:
                  "px-2 py-1.5 border-b border-white/5 flex items-center gap-1 overflow-x-auto",
                children: tt.map((F) => {
                  const k = F.icon,
                    U = h === F.id;
                  return b.jsxs(
                    "button",
                    {
                      onClick: () => f(F.id),
                      className: `flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[7px] font-mono tracking-wider transition shrink-0 cursor-pointer ${U ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10"}`,
                      children: [
                        b.jsx(k, { size: 8 }),
                        b.jsx("span", { children: F.label }),
                      ],
                    },
                    F.id,
                  );
                }),
              }),
              b.jsxs("div", {
                className: "flex-1 overflow-y-auto p-2 space-y-2",
                children: [
                  h === "general" &&
                    b.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        b.jsx("div", {
                          className:
                            "text-[8px] font-mono uppercase tracking-widest text-slate-500",
                          children: "Startup & Appearance",
                        }),
                        b.jsx(ToggleRow, {
                          label: "LAUNCH AT STARTUP",
                          description:
                            "Start Siya when you log in",
                          checked: s.autoStart,
                          onChange: (F) => o({ autoStart: F }),
                        }),
                        b.jsx(ToggleRow, {
                          label: "UI ANIMATIONS",
                          description: "Enable motion and orb transitions",
                          checked: s.animations,
                          onChange: (F) => o({ animations: F }),
                        }),
                        s.autoStart &&
                          b.jsxs("div", {
                            className:
                              "mt-1 p-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-1.5",
                            children: [
                              b.jsx(Jx, {
                                size: 9,
                                className: "text-emerald-400 shrink-0",
                              }),
                              b.jsx("span", {
                                className:
                                  "text-[7px] font-mono text-emerald-300/80",
                                children:
                                  "Siya will auto-launch on next Windows login.",
                              }),
                            ],
                          }),
                      ],
                    }),
                  h === "character" &&
                    b.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        b.jsx("div", {
                          className:
                            "text-[8px] font-mono uppercase tracking-widest text-slate-500",
                          children: "3D Character Rendering",
                        }),
                        b.jsxs("div", {
                          className:
                            "space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2",
                          children: [
                            b.jsxs("div", {
                              className: "flex items-center justify-between",
                              children: [
                                b.jsxs("div", {
                                  children: [
                                    b.jsx("label", {
                                      className:
                                        "block text-[8px] font-mono tracking-wider text-slate-200 uppercase",
                                      children: "Character Shine",
                                    }),
                                    b.jsx("span", {
                                      className:
                                        "text-[7px] text-slate-500 uppercase font-mono",
                                      children:
                                        "Reflection highlights only — not scene brightness",
                                    }),
                                  ],
                                }),
                                b.jsxs("span", {
                                  className:
                                    "text-[8px] font-mono text-cyan-300",
                                  children: [s.characterShine, "%"],
                                }),
                              ],
                            }),
                            b.jsx("input", {
                              "aria-label": "Character shine",
                              type: "range",
                              min: 0,
                              max: 100,
                              step: 1,
                              value: s.characterShine,
                              onChange: (F) =>
                                o({ characterShine: Number(F.target.value) }),
                              className:
                                "w-full accent-cyan-500 cursor-pointer",
                            }),
                            b.jsxs("div", {
                              className:
                                "flex justify-between text-[7px] font-mono uppercase tracking-wider text-slate-600",
                              children: [
                                b.jsx("span", { children: "Matte" }),
                                b.jsx("span", { children: "Balanced" }),
                                b.jsx("span", { children: "Glossy" }),
                              ],
                            }),
                          ],
                        }),
                        b.jsx("div", {
                          className:
                            "rounded-lg border border-cyan-400/10 bg-cyan-400/[0.04] p-1.5 text-[7px] font-mono leading-relaxed text-slate-400",
                          children:
                            "Camera: WASD rotate · Q/E zoom · L lock · 1–4 views. Press F to make her eyes follow the mouse.",
                        }),
                      ],
                    }),
                  h === "voice" &&
                    b.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        b.jsx("div", {
                          className:
                            "text-[8px] font-mono uppercase tracking-widest text-slate-500",
                          children: "Gemini Voice & Microphone",
                        }),
                        b.jsxs("div", {
                          className:
                            "space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-2",
                          children: [
                            b.jsxs("div", {
                              className:
                                "flex items-center justify-between gap-1.5",
                              children: [
                                b.jsxs("div", {
                                  className: "flex items-center gap-1",
                                  children: [
                                    b.jsx(Jg, {
                                      size: 10,
                                      className: "text-indigo-300",
                                    }),
                                    b.jsxs("div", {
                                      children: [
                                        b.jsx("div", {
                                          className:
                                            "text-[8px] font-bold font-mono text-slate-200",
                                          children: "GEMINI API KEY",
                                        }),
                                        b.jsx("div", {
                                          className:
                                            "text-[7px] uppercase font-mono text-slate-500",
                                          children:
                                            "Stored securely by the local SIYA backend",
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                                b.jsx("span", {
                                  className: `shrink-0 rounded-full border px-1.5 py-0.5 text-[7px] font-mono uppercase ${v ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-amber-400/25 bg-amber-400/10 text-amber-300"}`,
                                  children: v ? "Configured" : "Missing",
                                }),
                              ],
                            }),
                            b.jsxs("div", {
                              className: "flex gap-1",
                              children: [
                                b.jsx("input", {
                                  type: "password",
                                  value: T,
                                  onChange: (F) => {
                                    (A(F.target.value), Y(null));
                                  },
                                  onKeyDown: (F) => {
                                    F.key === "Enter" && X();
                                  },
                                  autoComplete: "off",
                                  spellCheck: !1,
                                  placeholder: v
                                    ? "Enter a new key to replace it"
                                    : "Paste Gemini API key",
                                  "aria-label": "Gemini API key",
                                  className:
                                    "min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-1.5 py-1 text-[8px] text-white font-mono outline-none transition focus:border-indigo-400/50",
                                }),
                                b.jsx("button", {
                                  type: "button",
                                  onClick: () => void X(),
                                  disabled: N || !T.trim(),
                                  className:
                                    "flex min-w-14 items-center justify-center rounded-lg border border-indigo-400/25 bg-indigo-500/15 px-1.5 py-1 text-[7px] font-bold font-mono uppercase text-indigo-200 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40",
                                  children: N
                                    ? b.jsx(th, {
                                        size: 9,
                                        className: "animate-spin",
                                      })
                                    : v
                                      ? "Replace"
                                      : "Save",
                                }),
                              ],
                            }),
                            _ &&
                              b.jsx("div", {
                                className: `rounded-md border px-1.5 py-1 text-[7px] font-mono ${_.ok ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-rose-400/20 bg-rose-400/5 text-rose-300"}`,
                                children: _.text,
                              }),
                          ],
                        }),
                        b.jsx(ToggleRow, {
                          label: "WAKE WORD",
                          description:
                            "Always-listen for the activation phrase",
                          checked: s.wakeWordEnabled,
                          onChange: (F) => o({ wakeWordEnabled: F }),
                        }),
                        b.jsxs("div", {
                          className: "space-y-1",
                          children: [
                            b.jsx("label", {
                              className:
                                "block text-[8px] font-mono tracking-wider text-slate-300 uppercase",
                              children: "Wake Phrase",
                            }),
                            b.jsx("input", {
                              type: "text",
                              value: s.wakePhrase,
                              onChange: (F) =>
                                o({ wakePhrase: F.target.value }),
                              placeholder: "hey siya",
                              className:
                                "w-full px-1.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[8px] text-white font-mono focus:outline-none focus:border-cyan-400/50 transition",
                            }),
                            b.jsx("span", {
                              className:
                                "text-[7px] text-slate-500 uppercase font-mono",
                              children: "Say this phrase to activate Siya",
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className: "space-y-1",
                          children: [
                            b.jsx("label", {
                              className:
                                "block text-[8px] font-mono tracking-wider text-slate-300 uppercase",
                              children: "Microphone",
                            }),
                            b.jsxs("select", {
                              value: s.micDeviceId,
                              onChange: (F) =>
                                o({ micDeviceId: F.target.value }),
                              className:
                                "w-full px-1.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[8px] text-white font-mono focus:outline-none focus:border-cyan-400/50 transition cursor-pointer",
                              children: [
                                b.jsx("option", {
                                  value: "",
                                  children: "System Default",
                                }),
                                d.map((F, k) =>
                                  b.jsx(
                                    "option",
                                    {
                                      value: F.deviceId,
                                      children:
                                        F.label || `Microphone ${k + 1}`,
                                    },
                                    F.deviceId || k,
                                  ),
                                ),
                              ],
                            }),
                            b.jsx("span", {
                              className:
                                "text-[7px] text-slate-500 uppercase font-mono",
                              children:
                                d.length === 0
                                  ? "Grant mic permission to list devices"
                                  : `${d.length} device(s) detected`,
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className: "space-y-1",
                          children: [
                            b.jsx("label", {
                              className:
                                "block text-[8px] font-mono tracking-wider text-slate-300 uppercase",
                              children: "Camera",
                            }),
                            b.jsxs("select", {
                              value: s.camDeviceId,
                              onChange: (F) =>
                                o({ camDeviceId: F.target.value }),
                              className:
                                "w-full px-1.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[8px] text-white font-mono focus:outline-none focus:border-cyan-400/50 transition cursor-pointer",
                              children: [
                                b.jsx("option", {
                                  value: "",
                                  children: "System Default",
                                }),
                                camDevices.map((F, k) =>
                                  b.jsx(
                                    "option",
                                    {
                                      value: F.deviceId,
                                      children:
                                        F.label || `Camera ${k + 1}`,
                                    },
                                    F.deviceId || k,
                                  ),
                                ),
                              ],
                            }),
                            b.jsx("span", {
                              className:
                                "text-[7px] text-slate-500 uppercase font-mono",
                              children:
                                camDevices.length === 0
                                  ? "Grant camera permission to list devices"
                                  : `${camDevices.length} device(s) detected`,
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className: "space-y-1",
                          children: [
                            b.jsx("label", {
                              className:
                                "block text-[8px] font-mono tracking-wider text-slate-300 uppercase",
                              children: "Voice",
                            }),
                            b.jsx("select", {
                              value: s.voiceName,
                              onChange: (F) =>
                                o({ voiceName: F.target.value }),
                              className:
                                "w-full px-1.5 py-1 rounded-lg border border-white/10 bg-white/5 text-[8px] text-white font-mono focus:outline-none focus:border-cyan-400/50 transition cursor-pointer",
                              children: VOICE_OPTIONS.map((v) =>
                                b.jsx(
                                  "option",
                                  { value: v.id, children: v.label },
                                  v.id,
                                ),
                              ),
                            }),
                            b.jsx("span", {
                              className:
                                "text-[7px] text-slate-500 uppercase font-mono",
                              children: "Reconnects automatically to apply",
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className: "space-y-1",
                          children: [
                            b.jsxs("div", {
                              className: "flex items-center justify-between",
                              children: [
                                b.jsx("label", {
                                  className:
                                    "block text-[8px] font-mono tracking-wider text-slate-300 uppercase",
                                  children: "Wake-word re-arm speed",
                                }),
                                b.jsx("span", {
                                  className:
                                    "text-[8px] font-mono text-cyan-300",
                                  children: s.sensitivity,
                                }),
                              ],
                            }),
                            b.jsx("input", {
                              type: "range",
                              min: 0,
                              max: 100,
                              value: s.sensitivity,
                              onChange: (F) =>
                                o({ sensitivity: Number(F.target.value) }),
                              className:
                                "w-full accent-cyan-500 cursor-pointer",
                            }),
                            b.jsx("span", {
                              className:
                                "text-[7px] text-slate-500 uppercase font-mono",
                              children: "Higher = shorter cooldown between activations",
                            }),
                          ],
                        }),
                      ],
                    }),
                  h === "system" &&
                    b.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        b.jsx("div", {
                          className:
                            "text-[8px] font-mono uppercase tracking-widest text-slate-500",
                          children: "Desktop Control Agent",
                        }),
                        b.jsxs("div", {
                          className: `p-2 rounded-lg border flex items-center gap-1.5 ${m.online ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`,
                          children: [
                            b.jsx("div", {
                              className: `w-2 h-2 rounded-full shrink-0 ${m.online ? "bg-emerald-400 animate-pulse" : "bg-rose-400"}`,
                            }),
                            b.jsxs("div", {
                              className: "flex-1",
                              children: [
                                b.jsx("div", {
                                  className: "text-[8px] font-mono text-white",
                                  children: m.online
                                    ? "Agent Online"
                                    : "Agent Offline",
                                }),
                                b.jsx("div", {
                                  className:
                                    "text-[7px] font-mono text-slate-400",
                                  children: m.online
                                    ? `${m.toolCount ?? 0} tools registered`
                                    : "Start the Python agent on port 8765",
                                }),
                              ],
                            }),
                            b.jsx(yp, {
                              size: 11,
                              className: "text-slate-500",
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className:
                            "p-1.5 rounded-lg border border-white/5 bg-white/5 space-y-1",
                          children: [
                            b.jsxs("div", {
                              className:
                                "flex items-center gap-1 text-[7px] font-mono text-slate-400 uppercase tracking-wider",
                              children: [
                                b.jsx(iy, { size: 8 }),
                                " Capabilities",
                              ],
                            }),
                            b.jsxs("div", {
                              className:
                                "grid grid-cols-2 gap-1 text-[7px] font-mono text-slate-300",
                              children: [
                                b.jsx("span", { children: "✓ App control" }),
                                b.jsx("span", { children: "✓ Browser" }),
                                b.jsx("span", { children: "✓ Volume" }),
                                b.jsx("span", { children: "✓ Brightness" }),
                                b.jsx("span", { children: "✓ Power" }),
                                b.jsx("span", { children: "✓ Files" }),
                                b.jsx("span", { children: "✓ Screenshot" }),
                                b.jsx("span", { children: "✓ Clipboard" }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }),
                  h === "about" &&
                    b.jsxs("div", {
                      className: "space-y-2",
                      children: [
                        b.jsx("div", {
                          className:
                            "text-[8px] font-mono uppercase tracking-widest text-slate-500",
                          children: "About Siya",
                        }),
                        b.jsxs("div", {
                          className:
                            "p-2 rounded-lg border border-white/5 bg-white/5 space-y-1.5",
                          children: [
                            b.jsxs("div", {
                              className: "flex items-center gap-1",
                              children: [
                                b.jsx("img", {
                                  src: "/assets/brand/siya-mark.png",
                                  alt: "",
                                  className: "h-[9px] w-[9px] rounded-sm object-cover",
                                }),
                                b.jsx("span", {
                                  className: "text-[8px] font-display text-white",
                                  children: "SIYA AI Assistant",
                                }),
                              ],
                            }),
                            b.jsxs("div", {
                              className:
                                "space-y-1 text-[7px] font-mono text-slate-400",
                              children: [
                                b.jsxs("div", {
                                  className: "flex justify-between",
                                  children: [
                                    b.jsx("span", { children: "VERSION" }),
                                    b.jsx("span", {
                                      className: "text-slate-300",
                                      children: "V2.0.0",
                                    }),
                                  ],
                                }),
                                b.jsxs("div", {
                                  className: "flex justify-between",
                                  children: [
                                    b.jsx("span", { children: "ENGINE" }),
                                    b.jsx("span", {
                                      className: "text-slate-300",
                                      children: "Gemini Live",
                                    }),
                                  ],
                                }),
                                b.jsxs("div", {
                                  className: "flex justify-between",
                                  children: [
                                    b.jsx("span", { children: "DESKTOP" }),
                                    b.jsx("span", {
                                      className: "text-slate-300",
                                      children: "FastAPI Agent",
                                    }),
                                  ],
                                }),
                                b.jsxs("div", {
                                  className: "flex justify-between",
                                  children: [
                                    b.jsx("span", { children: "WAKE WORD" }),
                                    b.jsx("span", {
                                      className: "text-slate-300",
                                      children: "Web Speech API",
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className:
                            "p-1.5 rounded-lg border border-amber-500/15 bg-amber-500/5 flex items-start gap-1",
                          children: [
                            b.jsx(ny, {
                              size: 9,
                              className: "text-amber-400 shrink-0 mt-0.5",
                            }),
                            b.jsx("span", {
                              className:
                                "text-[7px] font-mono text-amber-300/70 leading-relaxed",
                              children:
                                "Keep this tab active for wake-word detection. Microphone access is required for voice activation.",
                            }),
                          ],
                        }),
                      ],
                    }),
                ],
              }),
              saveError && b.jsx("p", {
                role: "alert",
                className: "px-2 py-2 text-xs text-amber-200 bg-amber-950/40",
                children: saveError,
              }),
              b.jsxs("div", {
                className:
                  "px-2 py-1.5 border-t border-white/5 bg-white/5 flex items-center justify-between",
                children: [
                  b.jsx("span", {
                    className:
                      "text-[7px] font-mono uppercase tracking-widest text-slate-500",
                    role: "status",
                    children: saving ? "Saving preferences…" : saveError ? "Save failed — please retry" : "Preferences auto-save",
                  }),
                  b.jsx("span", {
                    className:
                      "text-[7px] font-mono uppercase tracking-widest text-slate-500",
                    children: "Siya V2",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  });
}
