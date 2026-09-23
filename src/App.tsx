/*
 * Recovered from SIYA-Setup-1.0.1.exe (dist/assets/index-qnLjC2CG.js), a
 * minified Vite/Rollup bundle with NO sourcemap. De-minified with prettier
 * and reorganized into this file by inferring component boundaries; the
 * top-level name(s) below were renamed for readability from their minified
 * originals (noted in a comment where relevant). Internal local variable
 * names inside function bodies are still the original minified short names
 * -- full renaming of those was out of scope. Behavior preserved verbatim.
 */

import * as L from "react";
import * as b from "react/jsx-runtime";
import { KeyRound as Jg, ShieldCheck as RS, ExternalLink as aS, LoaderCircle as th } from "lucide-react";

async function parseJsonResponse(a: Response) {
  const i = a.headers.get("content-type") ?? "",
    s = await a.text();
  if (!i.includes("application/json") || !s.trim())
    throw new Error(
      "SIYA backend is not running. Start the main app with npm run dev and open http://localhost:3000.",
    );
  try {
    return JSON.parse(s);
  } catch {
    throw new Error(
      "SIYA backend returned an invalid response. Restart the main app and try again.",
    );
  }
}

export function AppProviders({ children: a }) {
  const [i, s] = L.useState("checking"),
    [o, r] = L.useState(""),
    [h, f] = L.useState(!1),
    [d, g] = L.useState(null);
  L.useEffect(() => {
    let y = !1;
    return (
      (async () => {
        try {
          const v = await fetch("/api/config", { cache: "no-store" }),
            S = await parseJsonResponse(v);
          if (y) return;
          s(S.hasApiKey ? "ready" : "needsKey");
        } catch {
          y || s("needsKey");
        }
      })(),
      () => {
        y = !0;
      }
    );
  }, []);
  async function m(y) {
    y.preventDefault();
    const v = o.trim();
    if (!(!v || h)) {
      (f(!0), g(null));
      try {
        const S = await fetch("/api/config/apikey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKey: v }),
          }),
          T = await parseJsonResponse(S);
        if (!S.ok) throw new Error(T.error || "Could not save the key.");
        (r(""), s("ready"));
      } catch (S) {
        g(S instanceof Error ? S.message : "Something went wrong.");
      } finally {
        f(!1);
      }
    }
  }
  return i === "ready"
    ? b.jsx(b.Fragment, { children: a })
    : b.jsxs("div", {
        className:
          "fixed inset-0 z-[100] flex items-center justify-center bg-[#050509] text-white",
        children: [
          b.jsx("div", {
            className:
              "pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-indigo-700/20 blur-[130px]",
          }),
          b.jsx("div", {
            className:
              "pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-cyan-700/15 blur-[150px]",
          }),
          i === "checking"
            ? b.jsxs("div", {
                className: "flex flex-col items-center gap-4 text-white/60",
                children: [
                  b.jsx(th, { className: "h-7 w-7 animate-spin" }),
                  b.jsx("span", {
                    className: "text-sm tracking-wide",
                    children: "Starting SIYA…",
                  }),
                ],
              })
            : b.jsxs("form", {
                onSubmit: m,
                className:
                  "relative z-10 w-[min(92vw,460px)] rounded-3xl border border-white/10 bg-white/[0.04] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl",
                children: [
                  b.jsxs("div", {
                    className: "mb-6 flex flex-col items-center text-center",
                    children: [
                      b.jsx("div", {
                        className:
                          "mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500/30 to-cyan-500/20 ring-1 ring-white/10",
                        children: b.jsx("img", {
                          src: "/assets/brand/siya-mark.png",
                          alt: "SIYA",
                          className: "h-full w-full object-cover",
                        }),
                      }),
                      b.jsx("h1", {
                        className: "text-xl font-semibold tracking-tight",
                        children: "Welcome to SIYA",
                      }),
                      b.jsx("p", {
                        className: "mt-2 text-sm leading-relaxed text-white/55",
                        children:
                          "SIYA runs on your own Google Gemini API key. Paste it below to get started — it stays on this computer and is never shared.",
                      }),
                    ],
                  }),
                  b.jsx("label", {
                    className:
                      "mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/40",
                    children: "Gemini API key",
                  }),
                  b.jsx("input", {
                    type: "password",
                    autoFocus: !0,
                    value: o,
                    onChange: (y) => r(y.target.value),
                    placeholder: "AIza…",
                    spellCheck: !1,
                    className:
                      "w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20",
                  }),
                  d &&
                    b.jsx("p", {
                      className:
                        "mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-500/20",
                      children: d,
                    }),
                  b.jsx("button", {
                    type: "submit",
                    disabled: h || !o.trim(),
                    className:
                      "mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40",
                    children: h
                      ? b.jsxs(b.Fragment, {
                          children: [
                            b.jsx(th, { className: "h-4 w-4 animate-spin" }),
                            " Verifying…",
                          ],
                        })
                      : b.jsx(b.Fragment, { children: "Continue" }),
                  }),
                  b.jsxs("div", {
                    className:
                      "mt-5 flex items-center justify-between text-xs text-white/40",
                    children: [
                      b.jsxs("span", {
                        className: "inline-flex items-center gap-1.5",
                        children: [
                          b.jsx(RS, { className: "h-3.5 w-3.5" }),
                          " Stored locally only",
                        ],
                      }),
                      b.jsxs("a", {
                        href: "https://aistudio.google.com/app/apikey",
                        target: "_blank",
                        rel: "noreferrer",
                        className:
                          "inline-flex items-center gap-1 text-indigo-300 transition hover:text-indigo-200",
                        children: [
                          "Get a free key ",
                          b.jsx(aS, { className: "h-3.5 w-3.5" }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
        ],
      });
}
