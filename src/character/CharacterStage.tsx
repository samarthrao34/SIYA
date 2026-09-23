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
import { CharacterEngine, CHARACTER_REGISTRY, DEFAULT_CHARACTER_ID } from "./characterEngine";
import { SIYA_CHARACTER } from "./siyaCharacter";
import { Sparkles as Qo, TriangleAlert as ny } from "lucide-react";
import * as THREE from "three";

// Camera debug controls (view lock, eye tracking, presets, key hints) are for
// development. Set localStorage "siya.devControls" to "1" to show them; the
// keyboard shortcuts work either way.
function showCameraDevControls(): boolean {
  try {
    return localStorage.getItem("siya.devControls") === "1";
  } catch {
    return false;
  }
}

// SIYA's own VRoid avatar is the default. localStorage "siya.character" =
// "evelyn" switches back to the original PMX character.
const REGISTRY = { ...CHARACTER_REGISTRY, [SIYA_CHARACTER.id]: SIYA_CHARACTER };
function defaultCharacterId(): string {
  try {
    return localStorage.getItem("siya.character") || SIYA_CHARACTER.id;
  } catch {
    return SIYA_CHARACTER.id;
  }
}

export function getCharacterPreset(a = defaultCharacterId()) {
  return REGISTRY[a] ?? REGISTRY[DEFAULT_CHARACTER_ID];
}
export const CharacterViewport = ({
  characterId: a,
  activity: i,
  emotion: s,
  motionIntent: mi = "idle",
  outputAnalyser: o,
  inputAnalyser: r,
  className: h,
  controlsEnabled: f = !0,
  showControlHint: d = !0,
  reflectionStrength: g = 1,
}) => {
  const m = L.useRef(null),
    y = L.useRef(null),
    v = L.useRef(null),
    [S, T] = L.useState({ phase: "Starting", ratio: 0, error: null }),
    [A, N] = L.useState(!1),
    [D, _] = L.useState(!1);
  (L.useEffect(() => {
    const k = m.current;
    if (!k) return;
    const U = document.createElement("canvas");
    ((U.className = "absolute inset-0 w-full h-full"),
      (U.style.touchAction = "none"),
      (U.style.opacity = "0"),
      (U.style.transition = "opacity 1s ease"),
      k.appendChild(U),
      (v.current = U));
    let W = !1;
    const $ = getCharacterPreset(a),
      ot = new CharacterEngine({
        canvas: U,
        config: $,
        onProgress: (lt, xt) => {
          W || T({ phase: lt, ratio: xt, error: null });
        },
        onError: (lt) => {
          (console.error("[SiyaCharacter]", lt),
            W || T((xt) => ({ ...xt, error: lt.message })));
        },
      });
    y.current = ot;
    // Debug handle for visual checks of the avatar (e.g. gesture tuning).
    (window as any).__siyaEngine = ot;
    // Other parts of the app ask for gestures with a "siya:gesture" event.
    const onGesture = (e: Event) => ot.playGesture((e as CustomEvent).detail?.name);
    window.addEventListener("siya:gesture", onGesture);
    ot.resize(k.clientWidth, k.clientHeight);
    ot.load()
      .then(() => {
        W || ot.start();
      })
      .catch(() => {});

    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const pointerDown = (event: PointerEvent) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { U.setPointerCapture(event.pointerId); } catch {}
      if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      }
      event.preventDefault();
    };
    const pointerMove = (event: PointerEvent) => {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        ot.orbitBy((event.clientX - previous.x) * 0.012, (previous.y - event.clientY) * 0.009);
      } else if (pointers.size === 2) {
        const [first, second] = [...pointers.values()];
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        if (pinchDistance) ot.zoomBy((pinchDistance - distance) * 0.04);
        pinchDistance = distance;
      }
      event.preventDefault();
    };
    const pointerUp = (event: PointerEvent) => {
      pointers.delete(event.pointerId);
      pinchDistance = 0;
      event.preventDefault();
    };
    U.addEventListener("pointerdown", pointerDown);
    U.addEventListener("pointermove", pointerMove);
    U.addEventListener("pointerup", pointerUp);
    U.addEventListener("pointercancel", pointerUp);

    return (
      () => {
        ((W = !0),
          U.removeEventListener("pointerdown", pointerDown),
          U.removeEventListener("pointermove", pointerMove),
          U.removeEventListener("pointerup", pointerUp),
          U.removeEventListener("pointercancel", pointerUp),
          window.removeEventListener("siya:gesture", onGesture),
          (y.current = null),
          ot.dispose(),
          U.remove(),
          v.current === U && (v.current = null));
      }
    );
  }, [a]),
    L.useEffect(() => {
      const k = v.current;
      k && (k.style.opacity = S.ratio >= 1 && !S.error ? "1" : "0");
    }, [S.ratio, S.error]),
    L.useEffect(() => {
      const k = m.current;
      if (!k) return;
      const U = new ResizeObserver((W) => {
        var xt;
        const $ = W[0];
        if (!$) return;
        const { width: ot, height: lt } = $.contentRect;
        (xt = y.current) == null || xt.resize(ot, lt);
      });
      return (U.observe(k), () => U.disconnect());
    }, []));
  const Y = L.useCallback((k) => {
    var $;
    const U = (k.clientX / window.innerWidth) * 2 - 1,
      W = -((k.clientY / window.innerHeight) * 2 - 1);
    ($ = y.current) == null || $.setPointer(U, W);
  }, []);
  (L.useEffect(
    () => (
      window.addEventListener("pointermove", Y, { passive: !0 }),
      () => window.removeEventListener("pointermove", Y)
    ),
    [Y],
  ),
    L.useEffect(() => {
      if (!f) return;
      const k = new Set();
      let U = 0,
        W = performance.now();
      const $ = 1.9,
        ot = 14,
        lt = () => {
          U = requestAnimationFrame(lt);
          const Q = performance.now(),
            J = Math.min((Q - W) / 1e3, 0.1);
          W = Q;
          const st = y.current;
          if (!st) return;
          let dt = 0,
            E = 0;
          (k.has("a") && (dt -= $ * J),
            k.has("d") && (dt += $ * J),
            k.has("w") && (E += $ * 0.6 * J),
            k.has("s") && (E -= $ * 0.6 * J),
            (dt || E) && st.orbitBy(dt, E));
          let w = 0;
          (k.has("q") && (w += ot * J),
            k.has("e") && (w -= ot * J),
            w && st.zoomBy(w));
        };
      U = requestAnimationFrame(lt);
      const xt = (Q) => {
          const J = Q;
          if (!J) return !1;
          const st = J.tagName;
          return (
            st === "INPUT" ||
            st === "TEXTAREA" ||
            st === "SELECT" ||
            J.isContentEditable
          );
        },
        kt = (Q) => {
          if (xt(Q.target) || Q.metaKey || Q.ctrlKey || Q.altKey) return;
          const J = Q.key.toLowerCase(),
            st = y.current;
          if (st) {
            if ("wasdqe".includes(J)) {
              (k.add(J), Q.preventDefault());
              return;
            }
            switch (J) {
              case "l":
                (st.setViewLocked(!st.isViewLocked), N(st.isViewLocked));
                break;
              case "f":
                (st.setEyeTracking(!st.isEyeTracking), _(st.isEyeTracking));
                break;
              case "r":
                st.resetView();
                break;
              case "1":
                st.setView("front");
                break;
              case "2":
                st.setView("threeQuarter");
                break;
              case "3":
                st.setView("right");
                break;
              case "4":
                st.setView("back");
                break;
              default:
                return;
            }
            Q.preventDefault();
          }
        },
        Nt = (Q) => k.delete(Q.key.toLowerCase()),
        B = () => k.clear();
      return (
        window.addEventListener("keydown", kt),
        window.addEventListener("keyup", Nt),
        window.addEventListener("blur", B),
        () => {
          (cancelAnimationFrame(U),
            window.removeEventListener("keydown", kt),
            window.removeEventListener("keyup", Nt),
            window.removeEventListener("blur", B));
        }
      );
    }, [f]),
    L.useEffect(() => {
      const k = () => {
        const U = y.current;
        U != null && U.isLoaded && (document.hidden ? U.stop() : U.start());
      };
      return (
        document.addEventListener("visibilitychange", k),
        () => document.removeEventListener("visibilitychange", k)
      );
    }, []),
    L.useEffect(() => {
      var k;
      (k = y.current) == null ||
        k.setFrameInput({
          activity: i,
          emotion: s,
          motionIntent: mi,
          outputAnalyser: o,
          inputAnalyser: r,
        });
    }, [i, s, mi, o, r]),
    L.useEffect(() => {
      var k;
      (k = y.current) == null || k.setReflectionStrength(g);
    }, [a, g]));
  const X = () => {
      const k = y.current;
      k && (k.setViewLocked(!k.isViewLocked), N(k.isViewLocked));
    },
    P = () => {
      const k = y.current;
      k && (k.setEyeTracking(!k.isEyeTracking), _(k.isEyeTracking));
    },
    tt = (k) => {
      var U;
      (U = y.current) == null || U.setView(k);
    },
    F = S.ratio >= 1 && !S.error;
  return b.jsxs("div", {
    ref: m,
    className: `relative w-full h-full overflow-hidden ${h ?? ""}`,
    children: [
      !F &&
        !S.error &&
        b.jsxs("div", {
          className:
            "absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none",
          children: [
            b.jsx(Qo, { className: "text-cyan-400 animate-pulse", size: 28 }),
            b.jsx("div", {
              className:
                "font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/70",
              children: S.phase,
            }),
            b.jsx("div", {
              className: "h-px w-40 bg-white/10 overflow-hidden rounded-full",
              children: b.jsx("div", {
                className:
                  "h-full bg-cyan-400/70 transition-[width] duration-300",
                style: { width: `${Math.round(S.ratio * 100)}%` },
              }),
            }),
          ],
        }),
      F &&
        f &&
        d &&
        showCameraDevControls() &&
        b.jsxs("div", {
          className:
            "absolute bottom-3 right-3 z-40 flex flex-col items-end gap-1 select-none",
          children: [
            b.jsxs("div", {
              className: "flex gap-1",
              children: [
                b.jsx("button", {
                  type: "button",
                  onClick: X,
                  "aria-pressed": A,
                  title: "Lock or unlock the current camera view (L)",
                  className: `px-1 py-px rounded border text-[6px] font-mono tracking-widest uppercase transition ${A ? "border-amber-400/60 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-400 hover:border-amber-400/40 hover:text-amber-200"}`,
                  children: A ? "View locked" : "View free",
                }),
                b.jsx("button", {
                  type: "button",
                  onClick: P,
                  "aria-pressed": D,
                  title: "Toggle eyes following the mouse (F)",
                  className: `px-1 py-px rounded border text-[6px] font-mono tracking-widest uppercase transition ${D ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/10 bg-white/5 text-slate-400 hover:border-cyan-400/40 hover:text-cyan-200"}`,
                  children: D ? "Eyes tracking" : "Eyes auto",
                }),
              ],
            }),
            b.jsx("div", {
              className: "flex gap-0.5 pointer-events-auto",
              children: [
                ["Front", "front"],
                ["¾", "threeQuarter"],
                ["Side", "right"],
                ["Back", "back"],
              ].map(([k, U]) =>
                b.jsx(
                  "button",
                  {
                    type: "button",
                    onClick: () => tt(U),
                    disabled: A,
                    title: `${k} camera preset`,
                    className:
                      "min-w-6 px-1 py-px rounded border border-white/10 bg-slate-950/60 text-[6px] font-mono uppercase tracking-wider text-slate-400 transition hover:border-fuchsia-400/40 hover:text-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-35",
                    children: k,
                  },
                  U,
                ),
              ),
            }),
            b.jsx("div", {
              className:
                "pointer-events-none px-1.5 py-0.5 rounded border border-white/5 bg-slate-950/50 backdrop-blur-sm text-[6px] font-mono tracking-wider text-slate-500",
              children:
                "WASD rotate · Q/E zoom · L lock · F eyes · R reset · 1-4 views",
            }),
          ],
        }),
      S.error &&
        b.jsxs("div", {
          className:
            "absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center",
          children: [
            b.jsx(ny, { className: "text-amber-400", size: 26 }),
            b.jsx("div", {
              className:
                "font-mono text-[10px] uppercase tracking-[0.3em] text-amber-200/80",
              children: "Character failed to load",
            }),
            b.jsx("p", {
              className: "max-w-sm text-xs text-slate-400 leading-relaxed",
              children: S.error,
            }),
          ],
        }),
    ],
  });
};
export function getThemeColors(a) {
  switch (a) {
    case "dusk":
      return {
        primary: "rgba(255, 214, 190, 1)",
        secondary: "rgba(236, 160, 176, 0.8)",
      };
    case "violet":
      return {
        primary: "rgba(147, 51, 234, 1)",
        secondary: "rgba(192, 38, 211, 0.8)",
      };
    case "crimson":
      return {
        primary: "rgba(225, 29, 72, 1)",
        secondary: "rgba(234, 88, 12, 0.8)",
      };
    case "emerald":
      return {
        primary: "rgba(5, 150, 105, 1)",
        secondary: "rgba(13, 148, 136, 0.8)",
      };
    case "celestial":
      return {
        primary: "rgba(2, 132, 199, 1)",
        secondary: "rgba(8, 145, 178, 0.8)",
      };
    case "gold":
      return {
        primary: "rgba(202, 138, 4, 1)",
        secondary: "rgba(217, 119, 6, 0.8)",
      };
    case "rose":
      return {
        primary: "rgba(219, 39, 119, 1)",
        secondary: "rgba(236, 72, 153, 0.8)",
      };
    default:
      return {
        primary: "rgba(34, 211, 238, 1)",
        secondary: "rgba(79, 70, 229, 0.8)",
      };
  }
}
export const CharacterStage = ({
    session: a,
    state: i,
    themeColor: s,
    activeEmotion: o = "idle",
    characterState: r,
    motionIntent: mi = "idle",
    reflectionStrength: h = 1,
    animations = true,
    controlsEnabled = true,
    showControlHint = true,
  }) => {
    const f = L.useRef(null),
      d = L.useRef(null),
      g = L.useRef(0),
      m = L.useRef([]),
      y = L.useMemo(
        () =>
          r === "talking"
            ? "talking"
            : r === "thinking"
              ? "thinking"
              : i === "listening"
                ? "listening"
                : "idle",
        [r, i],
      ),
      v = (a == null ? void 0 : a.outputAnalyser) ?? null,
      S = (a == null ? void 0 : a.inputAnalyser) ?? null;
    return (
      L.useEffect(() => {
        const T = f.current;
        if (!T) return;
        const A = T.getContext("2d");
        if (!A) return;
        if (!animations) { A.clearRect(0, 0, T.width, T.height); return; }
        let N = (T.width = T.offsetWidth),
          D = (T.height = T.offsetHeight);
        const _ = () => {
          const tt = Math.min(60, Math.floor(N / 24));
          m.current = Array.from({ length: tt }, () => ({
            x: Math.random() * N,
            y: Math.random() * D + D * 0.1,
            speed: Math.random() * 0.35 + 0.12,
            size: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.6 + 0.2,
          }));
        };
        _();
        const Y = () => {
          ((N = T.width = T.offsetWidth), (D = T.height = T.offsetHeight), _());
        };
        window.addEventListener("resize", Y);
        const X = new Uint8Array(64),
          P = () => {
            A.clearRect(0, 0, N, D);
            const tt = getThemeColors(s),
              F = i === "speaking" ? v : i === "listening" ? S : null;
            let k = 0;
            if (F)
              try {
                F.getByteFrequencyData(X);
                let lt = 0;
                for (let xt = 0; xt < X.length; xt++) lt += X[xt];
                k = lt / X.length;
              } catch {}
            g.current += (k / 255 - g.current) * 0.2;
            const U = Math.max(0.95, Math.min(1.85, D / 440)),
              W = N / 2;
            A.save();
            const $ = A.createLinearGradient(W, D * 0.25, W, D);
            ($.addColorStop(0, "rgba(0,0,0,0)"),
              $.addColorStop(0.4, tt.primary.replace("1)", "0.03)")),
              $.addColorStop(0.75, tt.primary.replace("1)", "0.08)")),
              $.addColorStop(1, tt.secondary.replace("0.8)", "0.18)")),
              (A.fillStyle = $));
            const ot = 280 * U;
            (A.beginPath(),
              A.moveTo(W - ot * 0.35, D - 105),
              A.lineTo(W + ot * 0.35, D - 105),
              A.lineTo(W + ot * 1.5, D),
              A.lineTo(W - ot * 1.5, D),
              A.closePath(),
              A.fill(),
              A.restore());
            for (const lt of m.current) {
              ((lt.y -= lt.speed * (1 + g.current * 1.8)),
                (lt.x += Math.sin(lt.y * 0.015 + lt.size) * 0.4));
              const xt = lt.opacity * Math.max(0, lt.y / D);
              (lt.y < D * 0.12 &&
                ((lt.y = D + Math.random() * 30), (lt.x = Math.random() * N)),
                (A.fillStyle = tt.primary.replace("1)", `${xt * 0.45})`)),
                A.beginPath(),
                A.arc(lt.x, lt.y, lt.size * U, 0, Math.PI * 2),
                A.fill());
            }
            d.current = requestAnimationFrame(P);
          };
        return (
          P(),
          () => {
            (window.removeEventListener("resize", Y),
              d.current && cancelAnimationFrame(d.current));
          }
        );
      }, [i, s, v, S, animations]),
      b.jsxs("div", {
        className:
          "relative w-full h-full flex items-center justify-center overflow-hidden",
        children: [
          b.jsx("div", {
            className:
              "absolute inset-0 flex items-center justify-center pointer-events-none z-0",
            children: b.jsx("div", {
              className: `w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 bg-gradient-to-tr transition-all duration-1000 ${s === "violet" ? "from-purple-600/30 to-fuchsia-600/5" : s === "crimson" ? "from-rose-600/30 to-orange-600/5" : s === "emerald" ? "from-emerald-600/30 to-teal-600/5" : s === "celestial" ? "from-sky-600/30 to-cyan-600/5" : s === "gold" ? "from-amber-600/30 to-yellow-600/5" : s === "rose" ? "from-rose-600/30 to-pink-600/5" : "from-indigo-600/30 to-cyan-600/5"}`,
            }),
          }),
          b.jsx("div", {
            className: "absolute inset-0 z-10",
            children: b.jsx(CharacterViewport, {
              activity: y,
              emotion: o,
              motionIntent: mi,
              outputAnalyser: v,
              inputAnalyser: S,
              reflectionStrength: h,
              controlsEnabled,
              showControlHint,
            }),
          }),
          b.jsx("canvas", {
            id: "siya-hologram-living-canvas",
            ref: f,
            className:
              "absolute inset-0 w-full h-full pointer-events-none z-20",
          }),
        ],
      })
    );
  };
