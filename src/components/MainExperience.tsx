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
import { motion as mn, AnimatePresence as Ti, MotionConfig } from "motion/react";
import { LiveSession } from "../api/liveSession";
import { CharacterStage } from "../character/CharacterStage";
import { MemoriesPanel } from "./MemoriesPanel";
import { SettingsPanel } from "./SettingsPanel";
import { loadSettings, saveSettings } from "../settings/settingsStore";
import { WakeWordListener } from "../settings/wakeWordListener";
import { Mic as $g, X as Is, Send as MS, Square as NS, RefreshCw as TS, Brain as Vo, Settings as ey, Pause as gS, Compass as gp, Volume2 as iy, Monitor as mS, CircleAlert as tS, Power as ty, Play as vS, Camera as cS } from "lucide-react";
import { ensureEmotionDetector, classifyBlendshapes, EmotionSmoother } from "../vision/emotionDetector";
import { BehaviorAnalyzer, ensureHandDetector } from "../vision/behaviorAnalyzer";

export function MainExperience() {
  const [a, i] = L.useState("disconnected"),
    [s, o] = L.useState(!1),
    [r, h] = L.useState(!1),
    [f, d] = L.useState(!0),
    [g, m] = L.useState("idle"),
    y = L.useRef(null),
    v = L.useRef(null),
    S = L.useRef(null),
    T = L.useRef(null),
    A = L.useRef(null),
    N = L.useRef(0),
    D = L.useRef(0),
    _ = L.useRef(!1),
    Y = L.useRef(null),
    X = L.useRef(!1),
    P = L.useRef(!0),
    tt = L.useRef("disconnected"),
    [camOn, setCamOn] = L.useState(!1),
    camStreamRef = L.useRef(null),
    camVideoRef = L.useRef(null),
    camCanvasRef = L.useRef(null),
    camIntervalRef = L.useRef(null),
    [detectedEmotion, setDetectedEmotion] = L.useState(null),
    emotionDetectorRef = L.useRef(null),
    emotionSmootherRef = L.useRef(null),
    // Local ~4 Hz face/hand analysis (behaviorAnalyzer.ts). The 2.5 s camera
    // frame to the server carries the latest emotion and behaviour readings.
    [detectedBehavior, setDetectedBehavior] = L.useState(null),
    handDetectorRef = L.useRef(null),
    behaviorAnalyzerRef = L.useRef(null),
    analysisIntervalRef = L.useRef(null),
    analysisTickRef = L.useRef({ n: 0, hands: null, lastBehaviorAt: 0 }),
    latestEmotionRef = L.useRef(null),
    latestBehaviorRef = L.useRef(null);
  (L.useEffect(() => {
    X.current = r;
  }, [r]),
    L.useEffect(() => {
      P.current = f;
    }, [f]),
    L.useEffect(() => {
      tt.current = a;
    }, [a]),
    L.useEffect(
      () => () => {
        Y.current && clearInterval(Y.current);
        camIntervalRef.current && clearInterval(camIntervalRef.current);
        analysisIntervalRef.current && clearInterval(analysisIntervalRef.current);
        camStreamRef.current &&
          camStreamRef.current.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
      },
      [],
    ));
  // SIYA loses its eyes the moment the live session drops -- never leave
  // the webcam light on with nothing to send frames to.
  L.useEffect(() => {
    if (a === "disconnected") stopCamera();
  }, [a]);
  const F = (it) => {
      T.current || (T.current = document.createElement("canvas"));
      const q = T.current;
      ((q.width = 32), (q.height = 18));
      const gt = q.getContext("2d", { willReadFrequently: !0 });
      if (!gt) return !0;
      gt.drawImage(it, 0, 0, q.width, q.height);
      const Rt = gt.getImageData(0, 0, q.width, q.height).data,
        Tt = new Uint8Array(q.width * q.height);
      for (let gn = 0, Pe = 0; gn < Rt.length; gn += 4, Pe += 1)
        Tt[Pe] = Math.round(
          Rt[gn] * 0.2126 + Rt[gn + 1] * 0.7152 + Rt[gn + 2] * 0.0722,
        );
      const Ot = A.current,
        te = Date.now() - N.current >= 3e4;
      let Ci = !Ot,
        Ia = Ot ? 0 : 100;
      if (Ot) {
        let gn = 0;
        for (let Pe = 0; Pe < Tt.length; Pe++) gn += Math.abs(Tt[Pe] - Ot[Pe]);
        ((Ia = gn / Tt.length), (Ci = Ia >= 7));
      }
      return !Ci && !te
        ? !1
        : ((A.current = Tt),
          (N.current = Date.now()),
          (D.current = Ia),
          (_.current = !Ci && te),
          !0);
    },
    k = () => {
      const it = v.current;
      if (!(!it || X.current || !P.current) && tt.current !== "disconnected")
        try {
          if (it.videoWidth === 0 || it.videoHeight === 0) return;
          S.current || (S.current = document.createElement("canvas"));
          const q = S.current,
            gt = q.getContext("2d");
          if (!gt) return;
          const Rt = 720;
          let Tt = it.videoWidth,
            Ot = it.videoHeight;
          if (
            ((Tt > Rt || Ot > Rt) &&
              (Tt > Ot
                ? ((Ot = Math.round((Ot * Rt) / Tt)), (Tt = Rt))
                : ((Tt = Math.round((Tt * Rt) / Ot)), (Ot = Rt))),
            (q.width = Tt),
            (q.height = Ot),
            gt.drawImage(it, 0, 0, Tt, Ot),
            !F(it))
          )
            return;
          const Ci = q.toDataURL("image/jpeg", 0.45).split(",")[1];
          rn.current &&
            tt.current !== "disconnected" &&
            rn.current.sendVideoFrame(Ci, {
              changeScore: D.current,
              heartbeat: _.current,
            });
        } catch (q) {
          console.error("[Screen Capture] Failed drawing frame to canvas:", q);
        }
    },
    U = async () => {
      vt(null);
      try {
        const it = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 2 },
            },
            audio: !1,
          }),
          q = it.getVideoTracks()[0];
        if (!q)
          throw (
            it.getTracks().forEach((Rt) => Rt.stop()),
            new Error("The selected screen did not provide a video track.")
          );
        y.current = it;
        const gt = document.createElement("video");
        ((gt.srcObject = it),
          (gt.muted = !0),
          (gt.playsInline = !0),
          gt.play().catch((Rt) => console.error("Video play warning:", Rt)),
          (v.current = gt),
          o(!0),
          h(!1),
          (q.onended = () => {
            W();
          }),
          Y.current && clearInterval(Y.current),
          (Y.current = setInterval(() => {
            k();
          }, 2500)),
          setTimeout(() => {
            k();
          }, 500));
      } catch (it) {
        console.error("Screen sharing permission declined or missing API:", it);
        const q = (it == null ? void 0 : it.message) || String(it);
        if (
          (it == null ? void 0 : it.name) === "NotAllowedError" ||
          /denied|cancel/i.test(q)
        )
          return;
        /not supported/i.test(q)
          ? vt(
              "Continuous screen sharing isn't supported in this build, but you can still ask SIYA to look at your screen by saying 'what is on my screen?' or clicking SHARE SCREEN again.",
            )
          : vt(`Could not capture screen: ${q}`);
      }
    },
    W = () => {
      (Y.current && (clearInterval(Y.current), (Y.current = null)),
        y.current &&
          (y.current.getTracks().forEach((it) => {
            try {
              it.stop();
            } catch {}
          }),
          (y.current = null)),
        v.current && (v.current.pause(), (v.current = null)),
        o(!1),
        h(!1),
        (A.current = null),
        (N.current = 0),
        (D.current = 0),
        (_.current = !1));
    },
    sendCameraFrame = () => {
      const videoEl = camVideoRef.current;
      if (!videoEl || tt.current === "disconnected") return;
      try {
        if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) return;
        camCanvasRef.current || (camCanvasRef.current = document.createElement("canvas"));
        const canvas = camCanvasRef.current,
          ctx = canvas.getContext("2d");
        if (!ctx) return;
        const MAX_DIM = 480;
        let w = videoEl.videoWidth,
          hh = videoEl.videoHeight;
        if (w > MAX_DIM || hh > MAX_DIM) {
          if (w > hh) {
            hh = Math.round((hh * MAX_DIM) / w);
            w = MAX_DIM;
          } else {
            w = Math.round((w * MAX_DIM) / hh);
            hh = MAX_DIM;
          }
        }
        canvas.width = w;
        canvas.height = hh;
        ctx.drawImage(videoEl, 0, 0, w, hh);
        const jpeg = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
        const emotion = latestEmotionRef.current,
          behavior = latestBehaviorRef.current;
        rn.current && rn.current.sendVideoFrame(jpeg, { changeScore: 20, ...(emotion ? { emotion } : {}), ...(behavior ? { behavior } : {}) });
      } catch (err) {
        console.error("[Camera] Failed drawing frame to canvas:", err);
      }
    },
    analyzeCameraFrame = () => {
      const videoEl = camVideoRef.current,
        landmarker = emotionDetectorRef.current;
      if (!videoEl || !landmarker || videoEl.videoWidth === 0 || videoEl.readyState < 2) return;
      try {
        const now = performance.now(),
          tick = analysisTickRef.current;
        const face = landmarker.detectForVideo(videoEl, now);
        // Hands every other tick (~2 Hz) is plenty for held gestures.
        tick.n += 1;
        if (handDetectorRef.current && tick.n % 2 === 0) tick.hands = handDetectorRef.current.detectForVideo(videoEl, now);
        behaviorAnalyzerRef.current || (behaviorAnalyzerRef.current = new BehaviorAnalyzer());
        behaviorAnalyzerRef.current.push(face, tick.hands, now);
        const categories = face.faceBlendshapes?.[0]?.categories;
        if (categories && categories.length) {
          emotionSmootherRef.current || (emotionSmootherRef.current = new EmotionSmoother(8));
          const smoothed = emotionSmootherRef.current.push(classifyBlendshapes(categories));
          const previous = latestEmotionRef.current;
          latestEmotionRef.current = { label: smoothed.emotion, confidence: Number(smoothed.confidence.toFixed(2)) };
          (!previous || previous.label !== smoothed.emotion) && setDetectedEmotion(smoothed);
        }
        if (now - tick.lastBehaviorAt >= 2000) {
          tick.lastBehaviorAt = now;
          const reading = behaviorAnalyzerRef.current.read(now);
          if (reading) {
            const previous = latestBehaviorRef.current;
            latestBehaviorRef.current = { state: reading.state, confidence: Number(reading.confidence.toFixed(2)), cues: reading.cues };
            (!previous || previous.state !== reading.state) && setDetectedBehavior(reading);
          }
        }
      } catch (err) {
        console.error("[Behavior] Camera analysis failed:", err);
      }
    },
    startCamera = async () => {
      vt(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...($t.camDeviceId && !/SiyaMobile\//.test(navigator.userAgent)
                ? { deviceId: { exact: $t.camDeviceId } }
                : {}),
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 8 },
            },
            audio: !1,
          }),
          track = stream.getVideoTracks()[0];
        if (!track) {
          stream.getTracks().forEach((t) => t.stop());
          throw new Error("The camera did not provide a video track.");
        }
        camStreamRef.current = stream;
        const videoEl = document.createElement("video");
        videoEl.srcObject = stream;
        videoEl.muted = !0;
        videoEl.playsInline = !0;
        videoEl.play().catch((e) => console.error("Camera video play warning:", e));
        camVideoRef.current = videoEl;
        setCamOn(!0);
        track.onended = () => {
          stopCamera();
        };
        ensureEmotionDetector()
          .then((landmarker) => {
            emotionDetectorRef.current = landmarker;
          })
          .catch((err) => console.error("[Emotion] Failed to load face detector:", err));
        ensureHandDetector()
          .then((hands) => {
            handDetectorRef.current = hands;
          })
          .catch((err) => console.error("[Behavior] Failed to load hand detector:", err));
        analysisIntervalRef.current && clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = setInterval(analyzeCameraFrame, 250);
        camIntervalRef.current && clearInterval(camIntervalRef.current);
        camIntervalRef.current = setInterval(() => {
          sendCameraFrame();
        }, 2500);
        setTimeout(() => {
          sendCameraFrame();
        }, 500);
      } catch (err) {
        console.error("Camera permission declined or missing API:", err);
        const msg = (err && err.message) || String(err);
        if ((err && err.name) === "NotAllowedError" || /denied|cancel/i.test(msg)) return;
        /not supported/i.test(msg)
          ? vt("Camera access isn't supported in this build.")
          : vt(`Could not access camera: ${msg}`);
      }
    },
    stopCamera = () => {
      camIntervalRef.current && (clearInterval(camIntervalRef.current), (camIntervalRef.current = null));
      camStreamRef.current &&
        (camStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        }),
        (camStreamRef.current = null));
      camVideoRef.current && (camVideoRef.current.pause(), (camVideoRef.current = null));
      analysisIntervalRef.current && (clearInterval(analysisIntervalRef.current), (analysisIntervalRef.current = null));
      emotionSmootherRef.current = null;
      behaviorAnalyzerRef.current = null;
      analysisTickRef.current = { n: 0, hands: null, lastBehaviorAt: 0 };
      latestEmotionRef.current = null;
      latestBehaviorRef.current = null;
      setDetectedEmotion(null);
      setDetectedBehavior(null);
      setCamOn(!1);
    },
    $ = () => {
      h(!0);
    },
    ot = () => {
      (h(!1),
        setTimeout(() => {
          k();
        }, 100));
    },
    lt = async () => {
      (y.current &&
        y.current.getTracks().forEach((it) => {
          try {
            it.stop();
          } catch {}
        }),
        await U());
    },
    [xt, kt] = L.useState("idle"),
    [Nt, B] = L.useState("dusk"),
    [Q, J] = L.useState(""),
    [st, dt] = L.useState("idle"),
    [motionIntent, setMotionIntent] = L.useState("idle"),
    E = (it) => {
      const q = it.toLowerCase();
      return q.includes("haha") ||
        q.includes("lol") ||
        q.includes("funny") ||
        q.includes("joke") ||
        q.includes("hehe") ||
        q.includes("wink")
        ? "playful"
        : q.includes("happy") ||
            q.includes("harmony") ||
            q.includes("glad") ||
            q.includes("joy") ||
            q.includes("wonderful") ||
            q.includes("love") ||
            q.includes("smile")
          ? "happy"
          : q.includes("wow") ||
              q.includes("awesome") ||
              q.includes("excited") ||
              q.includes("amazing") ||
              q.includes("yay") ||
              q.includes("incredible") ||
              q.includes("hype")
            ? "excited"
            : q.includes("really?") ||
                q.includes("curious") ||
                q.includes("interest") ||
                q.includes("tell me more") ||
                q.includes("why") ||
                q.includes("how") ||
                q.includes("wonder")
              ? "curious"
              : q.includes("think") ||
                  q.includes("calculat") ||
                  q.includes("analyz") ||
                  q.includes("hmmm") ||
                  q.includes("process") ||
                  q.includes("let me see") ||
                  q.includes("conclude")
                ? "thinking"
                : q.includes("proud") ||
                    q.includes("achieved") ||
                    q.includes("expert") ||
                    q.includes("skill") ||
                    q.includes("confidence") ||
                    q.includes("succeed")
                  ? "proud"
                  : q.includes("sad") ||
                      q.includes("sorry") ||
                      q.includes("unfortunate") ||
                      q.includes("grief") ||
                      q.includes("bad") ||
                      q.includes("regret") ||
                      q.includes("alas") ||
                      q.includes("cry")
                    ? "sad"
                    : q.includes("shock") ||
                        q.includes("surprise") ||
                        q.includes("gasp") ||
                        q.includes("unexpected") ||
                        q.includes("seriously") ||
                        q.includes("oh my")
                      ? "surprised"
                      : q.includes("blush") ||
                          q.includes("shy") ||
                          q.includes("embarrass") ||
                          q.includes("nervous") ||
                          q.includes("oops") ||
                          q.includes("sorry about")
                        ? "embarrassed"
                        : q.includes("what?") ||
                            q.includes("confus") ||
                            q.includes("puzzled") ||
                            q.includes("dont know") ||
                            q.includes("not sure") ||
                            q.includes("wait")
                          ? "confused"
                          : "idle";
    },
    // MotionIntent classifier for the EmbodimentEngine (Kimodo integration).
    // Deliberately a fast local heuristic, not a Gemini round-trip -- body
    // language must never add latency to when SIYA starts speaking.
    // Constrained to the allowed MotionIntent categories only.
    classifyMotionIntent = (text, emotion, activity) => {
      if (activity === "listening") return "listening";
      if (activity === "thinking") return "thinking";
      if (activity !== "talking") return "idle";
      const q = text.toLowerCase().trim();
      if (/^(hi|hey|hello|namaste|good morning|good evening|good afternoon|welcome back)\b/.test(q))
        return "greeting";
      if (q.length < 60 && /^(yes|yeah|yep|haan|sure|exactly|right,|totally|absolutely|correct|indeed|of course)\b/.test(q))
        return "agreeing";
      if (q.length < 80 && /^(no,|nah|nahi|not really|actually,? no|i don'?t think so|that'?s not|hmm,? no)\b/.test(q))
        return "disagreeing";
      if (
        (emotion === "excited" || emotion === "happy") &&
        (/(yay|awesome|amazing|congrat|finally|chal gaya|great news|woo+|let'?s go)/.test(q) ||
          (q.match(/!/g) || []).length >= 2)
      )
        return "celebrating";
      if (/(i understand|that sounds (hard|tough|difficult)|it'?s ok(ay)?|don'?t worry|i'?m sorry (to hear|that)|that must be|take your time)/.test(q))
        return "comforting";
      if (
        emotion === "sad" ||
        emotion === "embarrassed" ||
        /(are you okay|that'?s concerning|i'?m a bit worried|that doesn'?t sound good|hmm,? that'?s not great)/.test(q)
      )
        return "concerned";
      if (text.length > 140 || /(because|the reason is|basically|here'?s how|let me explain|first,|for example|essentially)/.test(q))
        return "explaining";
      if (emotion === "happy" || emotion === "playful") return "happy";
      return "speaking";
    },
    [w, O] = L.useState(""),
    [I, at] = L.useState(""),
    [nt, ct] = L.useState(!1),
    [wt, vt] = L.useState(null),
    [Be, Se] = L.useState([]),
    [Re, De] = L.useState(!1),
    [$t, En] = L.useState(() => loadSettings()),
    [ke, Pn] = L.useState(!1),
    hl = L.useRef(!1);
  L.useEffect(() => {
    hl.current = ke;
  }, [ke]);
  L.useEffect(() => {
    document.documentElement.dataset.animations = $t.animations ? 'on' : 'off';
    return () => { delete document.documentElement.dataset.animations; };
  }, [$t.animations]);
  const $i = L.useRef(null),
    ta = L.useRef(() => {});
  (L.useEffect(() => {
    const it = new WakeWordListener();
    return (
      ($i.current = it),
      () => {
        it.stop();
      }
    );
  }, []),
    L.useEffect(() => {
      const it = $i.current;
      it &&
        ($t.wakeWordEnabled && a === "disconnected"
          ? it.start({
              phrase: $t.wakePhrase,
              sensitivity: $t.sensitivity,
              onTriggered: () => {
                (it.stop(), ta.current());
              },
            })
          : it.stop());
    }, [$t.wakeWordEnabled, $t.wakePhrase, $t.sensitivity, a]));
  L.useEffect(() => {
    if (camOn) {
      stopCamera();
      startCamera();
    }
  }, [$t.camDeviceId]);
  const [settingsError, setSettingsError] = L.useState(null);
  const [settingsPending, setSettingsPending] = L.useState(0);
  const Za = async (patch) => {
      setSettingsPending(count => count + 1);
      setSettingsError(null);
      try {
        const saved = await saveSettings(patch);
        En(saved);
        vt(null);
        if ('voiceName' in patch || 'micDeviceId' in patch || 'addressAs' in patch) rn.current?.restart();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Settings could not be saved. Please try again.';
        setSettingsError(message);
      } finally {
        setSettingsPending(count => count - 1);
      }
    },
    rn = L.useRef(null),
    // Greeting on starting a voice conversation, at most every 30 minutes.
    greetRef = L.useRef({ pending: !1, last: 0 }),
    [cr, Te] = L.useState(null);
  L.useEffect(() => {
    fetch("/api/memories")
      .then((it) => it.json())
      .then((it) => {
        Array.isArray(it) && Se(it);
      })
      .catch((it) =>
        console.error("Initial persistent recollections load failure:", it),
      );
  }, []);
  const hr = async (it, q) => {
      try {
        const Rt = await (
          await fetch("/api/memories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: it, text: q }),
          })
        ).json();
        Rt && Rt.id && Se((Tt) => [...Tt, Rt]);
      } catch (gt) {
        console.error("Manual database recollect upload error:", gt);
      }
    },
    fl = async (it) => {
      try {
        const gt = await (
          await fetch(`/api/memories/${it}`, { method: "DELETE" })
        ).json();
        gt && gt.success && Se((Rt) => Rt.filter((Tt) => Tt.id !== it));
      } catch (q) {
        console.error("Manual memory delete execution failed:", q);
      }
    };
  L.useEffect(() => {
    const it = new LiveSession({
      onStateChange: (q) => {
        (i(q),
          q === "disconnected"
            ? (J(""), O(""), kt("idle"), dt("idle"), setMotionIntent("idle"))
            : q === "listening"
              ? (kt("idle"), dt("idle"), setMotionIntent("listening"))
              : q === "speaking" && dt("talking"));
      },
      onTranscription: (q, gt) => {
        q === "user"
          ? (J(gt), O(""), dt("thinking"), setMotionIntent("thinking"))
          : q === "model" &&
            (O((Rt) => {
              const Tt = Rt + gt,
                Ot = E(Tt);
              return (
                kt(Ot),
                setMotionIntent(classifyMotionIntent(Tt, Ot, "talking")),
                Tt
              );
            }),
            J(""));
      },
      onToolCall: (q, gt, Rt) => {
        var Tt;
        if (
          (console.log(`[App] Tool call triggered: ${q}`, gt),
          q === "changeBackground")
        ) {
          const Ot = (Tt = gt.color) == null ? void 0 : Tt.toLowerCase(),
            te = [
              "violet",
              "crimson",
              "emerald",
              "celestial",
              "gold",
              "rose",
              "charcoal",
              "dusk",
            ];
          Ot && te.includes(Ot)
            ? (B(Ot),
              Rt({
                result: `Theme changed to ${Ot}.`,
              }))
            : Rt({
                error: `Unsupported color '${Ot}'. Supported themes are: ${te.join(", ")}`,
              });
        } else Rt({ error: `Tool ${q} is not implemented.` });
      },
      onError: (q) => {
        vt(q);
      },
      onMemorySync: (q) => {
        (console.log("[App] WebSocket memories sync triggered:", q),
          Array.isArray(q) && Se(q));
      },
      onScreenVisionState: (q, gt) => {
        (m(q),
          gt != null && gt.error
            ? vt(`SIYA couldn't see your screen: ${gt.error}`)
            : q === "ready" &&
              gt != null &&
              gt.activeWindow &&
              console.log(`[ScreenVision] Looking at: ${gt.activeWindow}`));
      },
    });
    return (
      (rn.current = it),
      Te(it),
      () => {
        (it.disconnect(), rn.current === it && (rn.current = null));
      }
    );
  }, []);
  const Wa = async () => {
      (vt(null),
        rn.current &&
          (a === "disconnected"
            ? (Date.now() - greetRef.current.last > 30 * 60 * 1e3 && (greetRef.current.pending = !0),
              await rn.current.connect())
            : rn.current.disconnect()));
    },
    ea = async (it) => {
      it.preventDefault();
      const q = I.trim(),
        gt = rn.current;
      !q ||
        !gt ||
        (vt(null),
        at(""),
        gt.sendText(q),
        a === "disconnected" && (await gt.connect(!1)));
    };
  ta.current = Wa;
  // Once the voice conversation is up: SIYA waves and greets for the time of day.
  L.useEffect(() => {
    if (a !== "listening" || !greetRef.current.pending || !rn.current) return;
    greetRef.current.pending = !1;
    greetRef.current.last = Date.now();
    window.dispatchEvent(new CustomEvent("siya:gesture", { detail: { name: "wave" } }));
    rn.current.requestGreeting();
  }, [a]);
  const fr = () => {
    switch (Nt) {
      case "violet":
        return "from-purple-950/40 via-violet-950/20 to-slate-950";
      case "crimson":
        return "from-red-950/40 via-orange-950/20 to-slate-950";
      case "emerald":
        return "from-emerald-950/40 via-teal-950/20 to-slate-950";
      case "celestial":
        return "from-sky-950/45 via-indigo-950/25 to-slate-950";
      case "gold":
        return "from-amber-950/30 via-yellow-950/15 to-slate-950";
      case "rose":
        return "from-rose-950/40 via-pink-950/20 to-slate-950";
      case "dusk":
        return "";
      case "charcoal":
      default:
        return "from-slate-900/50 via-slate-950/30 to-slate-950";
    }
  };
  return b.jsx(MotionConfig, { skipAnimations: !$t.animations, children: b.jsxs("div", {
    id: "siya-holographic-desktop",
    // Calm panel styling (index.css) for every theme; themes only change the backdrop.
    "data-skin": "dusk",
    // "dusk" (default): a calm plum -> mauve -> warm peach evening sky instead
    // of the original near-black sci-fi backdrop.
    className: `relative w-full h-screen overflow-hidden ${Nt === "dusk" ? "bg-[linear-gradient(180deg,#1c1530_0%,#33264a_34%,#5c4063_66%,#9a6671_88%,#c48478_100%)]" : "bg-[#020205]"} text-white ${fr()} theme-transition flex flex-col justify-between p-6 sm:p-10 select-none`,
    children: [
      b.jsx("div", {
        className:
          `absolute top-[-10%] left-[-10%] w-[500px] h-[500px] ${Nt === "dusk" ? "bg-violet-300/10" : "bg-purple-900/15"} rounded-full blur-[120px] pointer-events-none`,
      }),
      b.jsx("div", {
        className:
          `absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] ${Nt === "dusk" ? "bg-orange-200/15" : "bg-cyan-900/15"} rounded-full blur-[150px] pointer-events-none`,
      }),
      b.jsx("div", {
        className:
          `absolute top-[20%] right-[10%] w-[300px] h-[300px] ${Nt === "dusk" ? "bg-rose-300/10" : "bg-indigo-800/10"} rounded-full blur-[100px] pointer-events-none`,
      }),
      b.jsx("div", {
        className:
          `absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none ${Nt === "dusk" ? "opacity-0" : "opacity-40"}`,
      }),
      // Soft glow behind SIYA so it is obvious whether she is listening or speaking.
      b.jsx("div", {
        "aria-hidden": !0,
        className: `pointer-events-none absolute left-1/2 top-[42%] z-0 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] transition-all duration-700 ${a === "speaking" ? "bg-violet-300/20 scale-105 opacity-100" : a === "listening" ? (st === "thinking" ? "bg-amber-200/15 opacity-100" : "bg-rose-200/20 opacity-100") : "opacity-0 scale-90"}`,
      }),
      b.jsx("div", {
        className: "absolute inset-0 z-0 pointer-events-auto select-none",
        children: b.jsx(CharacterStage, {
          animations: $t.animations,
          session: cr,
          state: a,
          themeColor: Nt,
          activeEmotion: xt,
          characterState: st,
          motionIntent: motionIntent,
          reflectionStrength: $t.characterShine / 50,
        }),
      }),
      b.jsxs("header", {
        className:
          "relative z-30 flex items-center justify-between w-full max-w-5xl mx-auto select-none",
        children: [
          b.jsxs("div", {
            className: "flex items-center gap-1",
            children: [
              b.jsx("span", {
                className:
                  "text-xs font-semibold tracking-[0.3em] text-white/70 uppercase font-sans",
                children: "Siya",
              }),
              b.jsx("div", {
                className: `w-1.5 h-1.5 rounded-full ${a === "listening" || a === "speaking" ? "bg-cyan-400" : "bg-white/10"}`,
              }),
            ],
          }),
          b.jsxs("div", {
            className: "flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1.5",
            children: [
              b.jsxs("button", {
                onClick: () => ct(!nt),
                className:
                  "flex items-center gap-1 opacity-60 hover:opacity-100 text-white transition text-[13px] font-medium tracking-normal cursor-pointer",
                title: "Themes",
                children: [
                  b.jsx(gp, { size: 13 }),
                  b.jsx("span", {
                    className: "hidden sm:inline",
                    children: "Themes",
                  }),
                ],
              }),
              b.jsxs("button", {
                onClick: () => De(!Re),
                className:
                  "flex items-center gap-1 opacity-60 hover:opacity-100 text-white transition text-[13px] font-medium tracking-normal cursor-pointer",
                title: "Recollections Database",
                children: [
                  b.jsx(Vo, { size: 13 }),
                  b.jsx("span", {
                    className: "hidden sm:inline",
                    children: "Memories",
                  }),
                ],
              }),
              b.jsxs("button", {
                onClick: s ? W : U,
                className: `flex items-center gap-1 transition text-[13px] font-medium tracking-normal cursor-pointer ${s ? "text-cyan-400 opacity-100 font-semibold" : "opacity-60 hover:opacity-100 text-white"}`,
                title: "Share Screen with Siya",
                children: [
                  b.jsx(mS, {
                    size: 13,
                    className: s && !r ? "animate-pulse text-cyan-400" : "",
                  }),
                  b.jsx("span", { children: s ? "Sharing" : "Share screen" }),
                  g === "capturing" &&
                    b.jsx("span", {
                      className:
                        "ml-1 inline-block w-1 h-1 rounded-full bg-amber-400 animate-pulse",
                      title: "SIYA is looking at your screen",
                    }),
                  g === "ready" &&
                    b.jsx("span", {
                      className:
                        "ml-1 inline-block w-1 h-1 rounded-full bg-cyan-400",
                      title: "SIYA just saw your screen",
                    }),
                  g === "error" &&
                    b.jsx("span", {
                      className:
                        "ml-1 inline-block w-1 h-1 rounded-full bg-rose-400",
                      title: "Could not see your screen",
                    }),
                ],
              }),
              b.jsxs("button", {
                onClick: camOn ? stopCamera : startCamera,
                className: `flex items-center gap-1 transition text-[13px] font-medium tracking-normal cursor-pointer ${camOn ? "text-cyan-400 opacity-100 font-semibold" : "opacity-60 hover:opacity-100 text-white"}`,
                title: "Let Siya see you through your camera",
                children: [
                  b.jsx(cS, {
                    size: 13,
                    className: camOn ? "animate-pulse text-cyan-400" : "",
                  }),
                  b.jsx("span", { children: camOn ? "Camera on" : "Camera" }),
                  camOn && detectedEmotion && detectedEmotion.emotion !== "neutral" &&
                    b.jsx("span", {
                      className: "opacity-70 lowercase",
                      title: `confidence ${(detectedEmotion.confidence * 100).toFixed(0)}%`,
                      children: `· ${detectedEmotion.emotion}`,
                    }),
                  camOn && detectedBehavior && detectedBehavior.state !== "calm" && detectedBehavior.state !== "away" &&
                    b.jsx("span", {
                      className: "opacity-70 lowercase",
                      title: detectedBehavior.cues.join(", "),
                      children: `· ${detectedBehavior.state}`,
                    }),
                ],
              }),
              b.jsxs("button", {
                onClick: () => Pn(!ke),
                className: `flex items-center gap-1 transition text-[13px] font-medium tracking-normal cursor-pointer ${ke ? "text-cyan-400 opacity-100 font-semibold" : "opacity-60 hover:opacity-100 text-white"}`,
                title: "Settings",
                children: [
                  b.jsx(ey, {
                    size: 13,
                    className: ke ? "animate-spin [animation-duration:6s]" : "",
                  }),
                  b.jsx("span", { children: "Settings" }),
                ],
              }),
            ],
          }),
        ],
      }),
      b.jsxs("main", {
        className:
          "relative z-10 flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-between py-6",
        children: [
          b.jsx("div", { className: "h-10 sm:h-20" }),
          b.jsx("div", {
            id: "cinematic-subtitles",
            className:
              "w-full max-w-3xl flex flex-col items-center justify-center text-center px-6 relative z-25 mt-auto mb-6 pointer-events-none min-h-[6rem]",
            children: b.jsx(Ti, {
              mode: "wait",
              children: (() => {
                const it = w ? "model" : Q ? "user" : "status",
                  q =
                    w ||
                    Q ||
                    (a === "listening"
                      ? "I am listening. Speak freely..."
                      : a === "connecting"
                        ? "Materializing presence links..."
                        : "");
                return b.jsxs(
                  mn.div,
                  {
                    initial: { opacity: 0, y: 15, filter: "blur(6px)" },
                    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
                    exit: { opacity: 0, y: -15, filter: "blur(6px)" },
                    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
                    className:
                      "flex flex-col items-center justify-center w-full",
                    children: [
                      it === "model" &&
                        b.jsx("h2", {
                          className:
                            "text-xs sm:text-sm font-light text-white leading-relaxed tracking-wide font-display max-w-2xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]",
                          children: q,
                        }),
                      it === "user" &&
                        b.jsxs("p", {
                          className:
                            "text-cyan-300 font-mono text-[10px] sm:text-xs tracking-wider flex items-center justify-center gap-2 drop-shadow-[0_1px_10px_rgba(0,0,0,0.85)] font-medium",
                          children: [
                            b.jsx("span", {
                              className:
                                "w-1 h-1 rounded-full bg-cyan-400 animate-pulse",
                            }),
                            b.jsxs("span", { children: ["“", q, "”"] }),
                          ],
                        }),
                      it === "status" &&
                        b.jsx("span", {
                          className:
                            "text-xs sm:text-sm uppercase tracking-[0.3em] font-medium text-white/30 font-sans tracking-widest drop-shadow-[0_1px_4px_rgba(0, 0, 0, 0.5)]",
                          children: q,
                        }),
                    ],
                  },
                  it,
                );
              })(),
            }),
          }),
          b.jsx(Ti, {
            children:
              nt &&
              b.jsxs(mn.div, {
                initial: { opacity: 0, scale: 0.95, y: 10 },
                animate: { opacity: 1, scale: 1, y: 0 },
                exit: { opacity: 0, scale: 0.95, y: 10 },
                className:
                  "mt-6 p-5 rounded-2xl border border-white/10 bg-slate-900/85 backdrop-blur-2xl max-w-md text-left w-full absolute z-40 shadow-2xl",
                children: [
                  b.jsxs("div", {
                    className: "flex items-center justify-between mb-3 text-white",
                    children: [
                      b.jsxs("div", {
                        className: "flex items-center gap-2 text-sm font-semibold",
                        children: [b.jsx(gp, { size: 16, className: "text-orange-200" }), b.jsx("span", { children: "Themes" })],
                      }),
                      b.jsx("button", {
                        onClick: () => ct(!1),
                        className: "text-white/50 hover:text-white transition",
                        "aria-label": "Close",
                        children: b.jsx(Is, { size: 14 }),
                      }),
                    ],
                  }),
                  // Theme swatches (the same themes SIYA can switch to by voice).
                  b.jsx("div", {
                    className: "mb-5 grid grid-cols-4 gap-2",
                    children: [
                      ["dusk", "Dusk", "linear-gradient(180deg,#33264a,#9a6671,#c48478)"],
                      ["rose", "Rose", "linear-gradient(180deg,#4c0519,#9f1239)"],
                      ["violet", "Violet", "linear-gradient(180deg,#2e1065,#6d28d9)"],
                      ["celestial", "Celestial", "linear-gradient(180deg,#082f49,#0369a1)"],
                      ["emerald", "Emerald", "linear-gradient(180deg,#022c22,#047857)"],
                      ["gold", "Gold", "linear-gradient(180deg,#451a03,#b45309)"],
                      ["crimson", "Crimson", "linear-gradient(180deg,#450a0a,#b91c1c)"],
                      ["charcoal", "Charcoal", "linear-gradient(180deg,#020617,#334155)"],
                    ].map(([id, label, bg]) =>
                      b.jsxs(
                        "button",
                        {
                          onClick: () => B(id),
                          className: `flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-[11px] transition ${Nt === id ? "bg-white/15 text-white ring-1 ring-orange-200/60" : "text-white/65 hover:bg-white/10"}`,
                          children: [
                            b.jsx("span", { className: "h-9 w-full rounded-lg ring-1 ring-white/15", style: { background: bg } }),
                            label,
                          ],
                        },
                        id,
                      ),
                    ),
                  }),
                  b.jsx("p", {
                    className: "text-xs text-white/60 mb-2",
                    children: "Things you can say to SIYA:",
                  }),
                  b.jsx("div", {
                    className: "space-y-2 text-xs",
                    children: [
                      ["“Aaj ka din thoda heavy tha…”", "Just talk — she listens"],
                      ["“Change the theme to rose”", "Changes the colours"],
                      ["“Play some calm music on YouTube”", "Uses your browser"],
                    ].map(([say, hint]) =>
                      b.jsxs(
                        "div",
                        {
                          className: "p-2.5 rounded-xl bg-white/5 border border-white/5 text-white/90",
                          children: [say, b.jsx("span", { className: "block mt-0.5 text-[11px] text-orange-200/80", children: hint })],
                        },
                        say,
                      ),
                    ),
                  }),
                ],
              }),
          }),
          b.jsx(Ti, {
            children:
              wt &&
              b.jsxs(mn.div, {
                initial: { opacity: 0, y: 15 },
                animate: { opacity: 1, y: 0 },
                exit: { opacity: 0, y: 15 },
                className:
                  "mt-6 flex items-start gap-3 p-4 rounded-2xl border border-rose-500/20 bg-rose-950/40 backdrop-blur-xl max-w-md w-full text-left",
                children: [
                  b.jsx(tS, {
                    className: "text-rose-400 shrink-0 mt-0.5",
                    size: 18,
                  }),
                  b.jsxs("div", {
                    children: [
                      b.jsx("h4", {
                        className:
                          "text-xs font-bold uppercase tracking-widest text-rose-300 font-mono",
                        children: "Core Error Protocol",
                      }),
                      b.jsx("p", {
                        className: "text-xs text-rose-200 mt-1 leading-relaxed",
                        children: wt,
                      }),
                      b.jsx("button", {
                        onClick: () => vt(null),
                        className:
                          "mt-2 text-[10px] font-bold text-rose-400 underline font-mono uppercase",
                        children: "Dismiss Code",
                      }),
                    ],
                  }),
                ],
              }),
          }),
        ],
      }),
      b.jsxs("footer", {
        className:
          "relative z-10 w-full max-w-2xl mx-auto flex flex-col items-center gap-3 mt-auto",
        children: [
          b.jsxs("form", {
            onSubmit: ea,
            style: { maxWidth: "380px", order: 3 },
            className:
              `mb-1 flex w-full items-center gap-2 rounded-full border py-1 pl-1 pr-1 shadow-[0_8px_30px_rgba(20,10,30,0.35)] transition-colors duration-500 ${a === "listening" ? (st === "thinking" ? "border-amber-200/40 bg-[#2b2140]/75" : "border-rose-200/50 bg-[#3a2540]/75") : a === "speaking" ? "border-violet-200/50 bg-[#2f2548]/75" : "border-white/15 bg-[#2b2140]/70"}`,
            children: [
              // Mic: starts/stops the voice conversation. Its colour and the
              // placeholder show what SIYA is doing.
              b.jsxs("button", {
                type: "button",
                onClick: Wa,
                "aria-label": a === "disconnected" ? "Talk to SIYA by voice" : "Stop the voice conversation",
                title: a === "disconnected" ? "Talk to SIYA by voice" : "Stop the voice conversation",
                className: `relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:brightness-110 active:scale-95 cursor-pointer ${a === "speaking" ? "bg-gradient-to-br from-violet-100 to-fuchsia-200 text-violet-900" : a === "listening" && st === "thinking" ? "bg-gradient-to-br from-amber-50 to-orange-200 text-amber-900" : "bg-gradient-to-br from-orange-100 to-rose-300 text-rose-900"}`,
                children: [
                  a === "listening" && st !== "thinking" &&
                    b.jsx("span", { className: "absolute inset-0 rounded-full bg-rose-200/60 animate-ping" }),
                  a === "connecting"
                    ? b.jsx("span", {
                        className:
                          "relative w-3.5 h-3.5 border-2 border-rose-900 border-t-transparent rounded-full animate-spin",
                      })
                    : a === "speaking"
                      ? b.jsx(iy, { size: 16, className: "relative" })
                      : b.jsx($g, { size: 16, className: "relative" }),
                ],
              }),
              b.jsx("input", {
                value: I,
                onChange: (it) => at(it.target.value),
                "aria-label": "Message SIYA",
                placeholder:
                  a === "connecting"
                    ? "Connecting…"
                    : a === "speaking"
                      ? "SIYA is speaking…"
                      : a === "listening"
                        ? st === "thinking"
                          ? "SIYA is thinking…"
                          : "Listening… tap the mic to stop"
                        : "Message SIYA, or tap the mic to talk",
                className:
                  "min-w-0 flex-1 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/45",
              }),
              b.jsx("button", {
                type: "submit",
                "aria-label": "Send message",
                disabled: !I.trim() || a === "connecting",
                className: `flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed ${I.trim() ? "bg-gradient-to-br from-orange-100 to-rose-300 text-rose-900 hover:brightness-110" : "bg-white/10 text-white/40"}`,
                children: b.jsx(MS, { size: 14 }),
              }),
            ],
          }),
          b.jsx("div", {
            className: "flex items-center justify-center gap-1 h-8 w-44",
            children: [12, 28, 16, 32, 20, 8].map((it, q) => {
              let gt = 0.35;
              a === "speaking"
                ? (gt = 0.35 + Math.sin(Date.now() * 0.02 + q * 0.9) * 0.65)
                : a === "listening"
                  ? (gt = 0.2 + Math.sin(Date.now() * 0.01 + q * 0.5) * 0.4)
                  : (gt = q % 2 === 0 ? 0.25 : 0.12);
              const Rt = Math.max(3, it * gt);
              return b.jsx(
                "div",
                {
                  className: `w-0.5 rounded-full transition-all duration-300 ${a === "speaking" ? "bg-purple-400" : a === "listening" ? "bg-cyan-400" : "bg-white/10"}`,
                  style: { height: `${Rt}px` },
                },
                q,
              );
            }),
          }),
          b.jsxs("div", {
            className: "flex w-full items-center justify-center relative",
            children: [
              wt &&
                b.jsx("button", {
                  onClick: () => {
                    vt(null);
                  },
                  className:
                    "absolute right-[-60px] p-2 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition duration-150 cursor-pointer",
                  title: "Dismiss Error",
                  children: b.jsx(Is, { size: 16 }),
                }),
            ],
          }),
        ],
      }),
      b.jsx(Ti, {
        children:
          s &&
          b.jsxs(mn.div, {
            initial: { opacity: 0, scale: 0.85, x: 50 },
            animate: { opacity: 1, scale: 1, x: 0 },
            exit: { opacity: 0, scale: 0.85, x: 50 },
            className: `absolute bottom-6 md:bottom-10 right-6 md:right-10 z-50 w-40 p-1.5 rounded-xl border ${r ? "border-amber-500/20 bg-slate-950/70" : "border-cyan-500/20 bg-slate-950/70"} backdrop-blur-2xl shadow-2xl overflow-hidden`,
            children: [
              b.jsxs("div", {
                className: "flex items-center justify-between mb-1.5",
                children: [
                  b.jsxs("div", {
                    className: "flex items-center gap-1",
                    children: [
                      b.jsx("div", {
                        className: `w-1.5 h-1.5 rounded-full ${r ? "bg-amber-400" : "bg-cyan-400 animate-pulse"}`,
                      }),
                      b.jsx("span", {
                        className:
                          "text-[7px] font-bold font-mono tracking-widest text-slate-200",
                        children: r
                          ? "Screen sharing paused"
                          : "Screen sharing on",
                      }),
                    ],
                  }),
                  b.jsx("button", {
                    onClick: W,
                    className:
                      "text-slate-400 hover:text-white transition-colors duration-150 p-0.5 rounded-md hover:bg-white/5 cursor-pointer",
                    title: "Stop Sharing",
                    children: b.jsx(Is, { size: 9 }),
                  }),
                ],
              }),
              b.jsxs("div", {
                className:
                  "relative aspect-video w-full rounded-lg overflow-hidden bg-slate-900 border border-white/5 mb-1.5 flex items-center justify-center group select-none",
                children: [
                  b.jsx("video", {
                    ref: (it) => {
                      it &&
                        y.current &&
                        it.srcObject !== y.current &&
                        ((it.srcObject = y.current),
                        (it.muted = !0),
                        it
                          .play()
                          .catch((q) =>
                            console.log("Mini preview stream play issue:", q),
                          ));
                    },
                    className: `w-full h-full object-cover transition-opacity duration-300 ${r ? "opacity-30 blur-sm" : "opacity-90"}`,
                    autoPlay: !0,
                    playsInline: !0,
                    muted: !0,
                  }),
                  r &&
                    b.jsx("div", {
                      className:
                        "absolute inset-0 flex items-center justify-center",
                      children: b.jsx("span", {
                        className:
                          "text-[6px] uppercase tracking-widest font-mono text-amber-400 font-bold px-1 py-0.5 bg-amber-950/40 border border-amber-500/20 rounded-md",
                        children: "Transmission Paused",
                      }),
                    }),
                  !r &&
                    f &&
                    b.jsxs("div", {
                      className:
                        "absolute top-1 left-1 flex items-center gap-1 px-1 py-0.5 rounded bg-cyan-950/50 border border-cyan-400/20 text-[6px] font-mono text-cyan-300",
                      children: [
                        b.jsx("span", {
                          className:
                            "w-1 h-1 bg-cyan-400 rounded-full animate-ping",
                        }),
                        b.jsx("span", { children: "Streaming FPS: 0.4" }),
                      ],
                    }),
                ],
              }),
              b.jsxs("div", {
                className: "flex items-center justify-between gap-1 mb-1.5",
                children: [
                  r
                    ? b.jsxs("button", {
                        onClick: ot,
                        className:
                          "flex-1 py-1 px-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-md text-[7px] font-mono font-medium text-cyan-300 flex items-center justify-center gap-1 transition-all cursor-pointer",
                        title: "Resume Streaming Feed",
                        children: [
                          b.jsx(vS, { size: 8 }),
                          b.jsx("span", { children: "Resume" }),
                        ],
                      })
                    : b.jsxs("button", {
                        onClick: $,
                        className:
                          "flex-1 py-1 px-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md text-[7px] font-mono font-medium text-amber-300 flex items-center justify-center gap-1 transition-all cursor-pointer",
                        title: "Pause Streaming Feed",
                        children: [
                          b.jsx(gS, { size: 8 }),
                          b.jsx("span", { children: "Pause" }),
                        ],
                      }),
                  b.jsxs("button", {
                    onClick: lt,
                    className:
                      "py-1 px-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[7px] font-mono text-slate-300 hover:text-white flex items-center justify-center gap-0.5 transition-all cursor-pointer",
                    title: "Choose Another Screen or Window",
                    children: [
                      b.jsx(TS, { size: 8 }),
                      b.jsx("span", { children: "Switch" }),
                    ],
                  }),
                  b.jsxs("button", {
                    onClick: W,
                    className:
                      "py-1 px-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-md text-[7px] font-mono text-rose-400 flex items-center justify-center gap-0.5 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
                    title: "Terminate Stream",
                    children: [
                      b.jsx(NS, { size: 8 }),
                      b.jsx("span", { children: "Stop" }),
                    ],
                  }),
                ],
              }),
              b.jsxs("div", {
                className:
                  "pt-1 border-t border-white/5 flex items-center justify-between text-left",
                children: [
                  b.jsxs("div", {
                    className: "flex flex-col",
                    children: [
                      b.jsx("span", {
                        className:
                          "text-[7px] font-bold font-mono text-slate-200",
                        children: "Screen sharing",
                      }),
                      b.jsx("span", {
                        className:
                          "text-[6px] text-slate-400 uppercase font-mono max-w-[110px]",
                        children: "Gemini Auto-Analysis",
                      }),
                    ],
                  }),
                  b.jsx("button", {
                    onClick: () => d(!f),
                    className: `w-7 h-3.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${f ? "bg-cyan-500" : "bg-white/10"}`,
                    children: b.jsx("div", {
                      className: `bg-white w-2.5 h-2.5 rounded-full shadow-md transform duration-200 ease-in-out ${f ? "translate-x-3.5" : "translate-x-0"}`,
                    }),
                  }),
                ],
              }),
            ],
          }),
      }),
      b.jsx(MemoriesPanel, {
        isOpen: Re,
        onClose: () => De(!1),
        memories: Be,
        onAddMemory: hr,
        onDeleteMemory: fl,
        themeColor: Nt,
      }),
      b.jsx(SettingsPanel, {
        isOpen: ke,
        onClose: () => Pn(!1),
        settings: $t,
        saveError: settingsError,
        saving: settingsPending > 0,
        onChange: Za,
        themeColor: Nt,
      }),
    ],
  }) });
}
async function Gg(a) {
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
