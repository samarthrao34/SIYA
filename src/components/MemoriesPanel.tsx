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
import { User as BS, Users as HS, X as Is, Sparkles as Qo, Brain as Vo, Briefcase as Wx, Trash2 as _S, Flame as lS, Heart as rS, Plus as xS, Target as zS } from "lucide-react";

export function MemoriesPanel({
  isOpen: a,
  onClose: i,
  memories: s,
  onAddMemory: o,
  onDeleteMemory: r,
  themeColor: h,
}) {
  var tt;
  const [f, d] = L.useState("all"),
    [g, m] = L.useState(""),
    [y, v] = L.useState("identity"),
    [S, T] = L.useState(!1),
    [A, N] = L.useState(!1),
    D = {
      identity: {
        label: "Identity Core",
        icon: BS,
        color: "text-amber-400 border-amber-500/25",
        bg: "bg-amber-500/5 hover:bg-amber-500/10",
      },
      preference: {
        label: "Preferences",
        icon: rS,
        color: "text-pink-400 border-pink-500/25",
        bg: "bg-pink-500/5 hover:bg-pink-500/10",
      },
      goal: {
        label: "Life Goals",
        icon: zS,
        color: "text-emerald-400 border-emerald-500/25",
        bg: "bg-emerald-500/5 hover:bg-emerald-500/10",
      },
      project: {
        label: "Active Projects",
        icon: Wx,
        color: "text-cyan-400 border-cyan-500/25",
        bg: "bg-cyan-500/5 hover:bg-cyan-500/10",
      },
      relationship: {
        label: "Relationships",
        icon: HS,
        color: "text-purple-400 border-purple-500/25",
        bg: "bg-purple-500/5 hover:bg-purple-500/10",
      },
      emotional: {
        label: "Milestones",
        icon: lS,
        color: "text-red-400 border-red-500/25",
        bg: "bg-red-500/5 hover:bg-red-500/10",
      },
      behavior: {
        label: "Behaviors & Habits",
        icon: Vo,
        color: "text-indigo-400 border-indigo-500/25",
        bg: "bg-indigo-500/5 hover:bg-indigo-500/10",
      },
    },
    _ = () => {
      switch (h) {
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
        case "charcoal":
        default:
          return "border-indigo-500/30 text-indigo-400 bg-indigo-500/10";
      }
    },
    Y = f === "all" ? s : s.filter((F) => F.category === f),
    X = async (F) => {
      if ((F.preventDefault(), !!g.trim())) {
        N(!0);
        try {
          (await o(y, g.trim()), m(""), T(!1));
        } catch (k) {
          console.error(k);
        } finally {
          N(!1);
        }
      }
    },
    P = (F) => {
      try {
        return new Date(F).toLocaleDateString(void 0, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        return "Durable Record";
      }
    };
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
                        className: `p-1.5 rounded-lg border ${_()}`,
                        children: b.jsx(Vo, {
                          size: 13,
                          className: "animate-pulse",
                        }),
                      }),
                      b.jsxs("div", {
                        children: [
                          b.jsxs("h3", {
                            className:
                              "font-display font-medium text-[10px] tracking-tight text-white flex items-center gap-1",
                            children: [
                              "Siya Memory Core",
                              b.jsx(Qo, {
                                size: 9,
                                className: "text-cyan-400",
                              }),
                            ],
                          }),
                          b.jsxs("p", {
                            className:
                              "text-[7px] font-mono uppercase tracking-widest text-slate-400 mt-0.5",
                            children: [
                              "Persistent recollect files (",
                              s.length,
                              ")",
                            ],
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
              b.jsxs("div", {
                className:
                  "px-2 py-1.5 bg-white/5 border-b border-white/5 flex items-center justify-between gap-1.5",
                children: [
                  b.jsx("span", {
                    className: "text-[7px] text-slate-400 font-mono",
                    children:
                      "💡 Siya remembers these details naturally as you chat.",
                  }),
                  !S &&
                    b.jsxs("button", {
                      onClick: () => T(!0),
                      className:
                        "flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-[7px] font-mono tracking-wider text-cyan-300 transition shrink-0 cursor-pointer",
                      children: [
                        b.jsx(xS, { size: 8 }),
                        b.jsx("span", { children: "MANUAL SEED" }),
                      ],
                    }),
                ],
              }),
              b.jsx(Ti, {
                children:
                  S &&
                  b.jsx(mn.div, {
                    initial: { height: 0, opacity: 0 },
                    animate: { height: "auto", opacity: 1 },
                    exit: { height: 0, opacity: 0 },
                    className:
                      "overflow-hidden border-b border-white/15 bg-[#080812]",
                    children: b.jsxs("form", {
                      onSubmit: X,
                      className: "p-2 space-y-2",
                      children: [
                        b.jsxs("div", {
                          children: [
                            b.jsx("label", {
                              className:
                                "block text-[7px] font-mono tracking-wider text-slate-300 uppercase mb-1",
                              children: "Memory Archetype Category",
                            }),
                            b.jsx("div", {
                              className:
                                "grid grid-cols-2 sm:grid-cols-3 gap-1",
                              children: Object.keys(D).map((F) => {
                                const k = D[F].icon,
                                  U = y === F;
                                return b.jsxs(
                                  "button",
                                  {
                                    type: "button",
                                    onClick: () => v(F),
                                    className: `flex items-center gap-1 p-1 rounded-md border text-[7px] tracking-wide transition cursor-pointer ${U ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-white/5 bg-white/5 text-slate-400 hover:bg-white/10"}`,
                                    children: [
                                      b.jsx(k, { size: 8 }),
                                      b.jsx("span", {
                                        className: "truncate",
                                        children: D[F].label.split(" ")[0],
                                      }),
                                    ],
                                  },
                                  F,
                                );
                              }),
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          children: [
                            b.jsx("label", {
                              className:
                                "block text-[7px] font-mono tracking-wider text-slate-300 uppercase mb-1",
                              children:
                                "Recollection Statement (3rd Person declarative)",
                            }),
                            b.jsx("textarea", {
                              value: g,
                              onChange: (F) => m(F.target.value),
                              placeholder:
                                "e.g. The user's startup is called Siya, a voice AI platform.",
                              required: !0,
                              className:
                                "w-full h-14 text-[8px] p-1.5 rounded-md border border-white/10 bg-black/40 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 resize-none font-sans",
                            }),
                          ],
                        }),
                        b.jsxs("div", {
                          className: "flex gap-1.5 justify-end",
                          children: [
                            b.jsx("button", {
                              type: "button",
                              onClick: () => T(!1),
                              className:
                                "px-2 py-1 rounded-md border border-white/5 text-[7px] font-mono tracking-wide text-slate-400 hover:text-white transition cursor-pointer",
                              children: "Cancel",
                            }),
                            b.jsx("button", {
                              type: "submit",
                              disabled: A,
                              className:
                                "px-2 py-1 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[7px] uppercase font-mono tracking-widest transition disabled:opacity-50 cursor-pointer",
                              children: A ? "Saving..." : "Commit Memory",
                            }),
                          ],
                        }),
                      ],
                    }),
                  }),
              }),
              b.jsxs("div", {
                className:
                  "px-2 py-1.5 flex gap-1 overflow-x-auto no-scrollbar border-b border-light border-white/10 shrink-0",
                children: [
                  b.jsx("button", {
                    onClick: () => d("all"),
                    className: `px-1.5 py-0.5 rounded-full border text-[7px] tracking-wider uppercase transition cursor-pointer shrink-0 ${f === "all" ? "border-white bg-white text-slate-950 font-bold" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15"}`,
                    children: "All Memories",
                  }),
                  Object.keys(D).map((F) => {
                    const k = D[F],
                      U = f === F;
                    return b.jsx(
                      "button",
                      {
                        onClick: () => d(F),
                        className: `px-1.5 py-0.5 rounded-full border text-[7px] tracking-wider uppercase transition shrink-0 cursor-pointer ${U ? "border-white bg-white text-slate-950 font-bold" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15"}`,
                        children: k.label.split(" ")[0],
                      },
                      F,
                    );
                  }),
                ],
              }),
              b.jsx("div", {
                className: "flex-1 overflow-y-auto p-2 space-y-1.5",
                children: b.jsx(Ti, {
                  initial: !1,
                  children:
                    Y.length === 0
                      ? b.jsxs(mn.div, {
                          initial: { opacity: 0 },
                          animate: { opacity: 1 },
                          className:
                            "h-full flex flex-col items-center justify-center p-3 text-center text-slate-500",
                          children: [
                            b.jsx("div", {
                              className:
                                "p-2 rounded-full border border-dashed border-white/10 bg-white/[0.02] mb-1.5",
                              children: b.jsx(Vo, {
                                size: 20,
                                className: "opacity-40",
                              }),
                            }),
                            b.jsx("h4", {
                              className:
                                "text-[8px] font-semibold tracking-wide text-slate-300",
                              children: "No memories recorded yet",
                            }),
                            b.jsx("p", {
                              className:
                                "text-[7px] max-w-[180px] mt-1 leading-relaxed font-mono",
                              children:
                                f === "all"
                                  ? "Start talking aloud with Siya! Her background consolidator analyzes transcript slices and builds a life context naturally."
                                  : `No persistent recollections saved in Category "${(tt = D[f]) == null ? void 0 : tt.label}". Add one or speak with Siya.`,
                            }),
                          ],
                        })
                      : Y.map((F) => {
                          const k = D[F.category],
                            U = k.icon;
                          return b.jsxs(
                            mn.div,
                            {
                              initial: { opacity: 0, y: 10 },
                              animate: { opacity: 1, y: 0 },
                              exit: { opacity: 0, scale: 0.95 },
                              className: `flex items-start justify-between gap-2 p-1.5 rounded-lg border border-white/5 backdrop-blur-md bg-white/[0.02] ${k.bg} transition-colors group relative`,
                              children: [
                                b.jsxs("div", {
                                  className: "flex gap-1.5 overflow-hidden",
                                  children: [
                                    b.jsx("div", {
                                      className: `p-1 rounded-md border mt-0.5 shrink-0 bg-black/40 ${k.color}`,
                                      children: b.jsx(U, { size: 10 }),
                                    }),
                                    b.jsxs("div", {
                                      className: "overflow-hidden",
                                      children: [
                                        b.jsx("span", {
                                          className: `text-[7px] font-mono uppercase tracking-wider block ${k.color}`,
                                          children: k.label,
                                        }),
                                        b.jsx("p", {
                                          className:
                                            "text-[8px] text-slate-200 mt-0.5 font-sans leading-relaxed break-words font-medium",
                                          children: F.text,
                                        }),
                                        b.jsxs("span", {
                                          className:
                                            "text-[7px] font-mono text-slate-500 mt-1 block",
                                          children: [
                                            "Recalled: ",
                                            P(F.createdAt),
                                          ],
                                        }),
                                      ],
                                    }),
                                  ],
                                }),
                                b.jsx("button", {
                                  onClick: () => r(F.id),
                                  className:
                                    "opacity-0 group-hover:opacity-100 p-1 rounded-md border border-red-500/25 bg-red-950/15 text-red-400 hover:bg-red-500 hover:text-white transition duration-150 absolute top-1.5 right-1.5 sm:relative sm:top-0 sm:right-0 shrink-0 cursor-pointer",
                                  title: "Forget this memory",
                                  children: b.jsx(_S, { size: 9 }),
                                }),
                              ],
                            },
                            F.id,
                          );
                        }),
                }),
              }),
              b.jsxs("div", {
                className:
                  "p-2 border-t border-white/10 bg-black/40 flex items-center justify-between text-[7px] font-mono text-slate-600 tracking-wider",
                children: [
                  b.jsxs("span", {
                    className: "flex items-center gap-1",
                    children: [
                      b.jsx("span", {
                        className:
                          "w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_5px_rgba(34,211,238,0.7)] animate-pulse",
                      }),
                      b.jsx("span", { children: "MEM-SYNC STREAM ACTIVE" }),
                    ],
                  }),
                  b.jsx("span", { children: "DURABLE LOCAL JSON DB SEED" }),
                ],
              }),
            ],
          }),
        ],
      }),
  });
}
