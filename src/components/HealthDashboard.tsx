/*
 * SIYA Health Data Dashboard -- shows heart rate / SpO2 readings synced
 * from the paired smartwatch (see desktop_agent/tools_health.py and
 * server_health.ts). Follows the same visual language and panel-shell
 * pattern as SettingsPanel.tsx / MemoriesPanel.tsx (dark glass, cyan accents,
 * mono uppercase labels, motion/react slide+fade), just wider to fit charts.
 */
import * as L from "react";
import * as b from "react/jsx-runtime";
import { motion as mn, AnimatePresence as Ti } from "motion/react";
import {
  X as Is,
  HeartPulse as HeartIcon,
  Droplets as DropIcon,
  Download as DownloadIcon,
  RefreshCw as RefreshIcon,
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  Minus as TrendFlatIcon,
  WifiOff as WifiOffIcon,
} from "lucide-react";

const RANGES = [
  { id: "live", label: "Live" },
  { id: "1h", label: "1H" },
  { id: "today", label: "Today" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "all", label: "All" },
];

// A reading is considered "live" (sensor currently reachable) if it's newer
// than this -- a bit more than the watch's own ~15 minute auto-test cycle.
const STALE_AFTER_MS = 20 * 60 * 1000;

function themeAccent(theme) {
  switch (theme) {
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
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatAxisTime(iso, range) {
  try {
    const d = new Date(iso);
    if (range === "live" || range === "1h" || range === "today") {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

/** Small trend indicator: latest vs. the average of the rest of the range. */
function Trend({ latest, avg }) {
  if (latest == null || avg == null) return null;
  const diff = latest - avg;
  if (Math.abs(diff) < 0.5) {
    return b.jsxs("span", {
      className: "flex items-center gap-0.5 text-slate-400",
      children: [b.jsx(TrendFlatIcon, { size: 9 }), b.jsx("span", { children: "steady" })],
    });
  }
  const up = diff > 0;
  return b.jsxs("span", {
    className: `flex items-center gap-0.5 ${up ? "text-amber-400" : "text-cyan-400"}`,
    children: [
      b.jsx(up ? TrendUpIcon : TrendDownIcon, { size: 9 }),
      b.jsxs("span", { children: [Math.abs(diff).toFixed(1), " vs avg"] }),
    ],
  });
}

/** Lightweight, dependency-free SVG line chart. `points`: {timestamp, value}[]. */
function LineChart({ points, color, unit, range, emptyLabel }) {
  const width = 300;
  const height = 90;
  const padX = 6;
  const padY = 10;

  if (!points || points.length === 0) {
    return b.jsx("div", {
      className: "h-[90px] flex items-center justify-center text-[8px] font-mono text-slate-600",
      children: emptyLabel || "No data for this range",
    });
  }

  const values = points.map((p) => p.value);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const spanPad = (max - min) * 0.15;
  min -= spanPad;
  max += spanPad;

  const times = points.map((p) => new Date(p.timestamp).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = tMax - tMin || 1;

  const xFor = (t) => padX + ((t - tMin) / tSpan) * (width - padX * 2);
  const yFor = (v) => height - padY - ((v - min) / (max - min)) * (height - padY * 2);

  const coords = points.map((p, i) => [xFor(times[i]), yFor(p.value)]);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${height - padY} L${coords[0][0].toFixed(1)},${height - padY} Z`;
  const gradId = `grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return b.jsxs("svg", {
    viewBox: `0 0 ${width} ${height}`,
    className: "w-full h-[90px]",
    preserveAspectRatio: "none",
    children: [
      b.jsx("defs", {
        children: b.jsxs("linearGradient", {
          id: gradId,
          x1: "0",
          y1: "0",
          x2: "0",
          y2: "1",
          children: [
            b.jsx("stop", { offset: "0%", stopColor: color, stopOpacity: 0.35 }),
            b.jsx("stop", { offset: "100%", stopColor: color, stopOpacity: 0 }),
          ],
        }),
      }),
      b.jsx("path", { d: areaPath, fill: `url(#${gradId})`, stroke: "none" }),
      b.jsx("path", {
        d: linePath,
        fill: "none",
        stroke: color,
        strokeWidth: 1.5,
        strokeLinejoin: "round",
        strokeLinecap: "round",
      }),
      coords.length <= 40 &&
        coords.map(([x, y], i) =>
          b.jsx("circle", { cx: x, cy: y, r: 1.4, fill: color }, i),
        ),
      b.jsx("text", {
        x: padX,
        y: 8,
        fontSize: 6,
        fill: "rgba(255,255,255,0.35)",
        fontFamily: "monospace",
        children: `${Math.round(max - spanPad)}${unit}`,
      }),
      b.jsx("text", {
        x: padX,
        y: height - 2,
        fontSize: 6,
        fill: "rgba(255,255,255,0.35)",
        fontFamily: "monospace",
        children: `${Math.round(min + spanPad)}${unit}`,
      }),
      b.jsx("text", {
        x: padX,
        y: height - padY + 8,
        fontSize: 6,
        fill: "rgba(255,255,255,0.25)",
        fontFamily: "monospace",
        children: formatAxisTime(points[0].timestamp, range),
      }),
      b.jsx("text", {
        x: width - padX,
        y: height - padY + 8,
        fontSize: 6,
        fill: "rgba(255,255,255,0.25)",
        fontFamily: "monospace",
        textAnchor: "end",
        children: formatAxisTime(points[points.length - 1].timestamp, range),
      }),
    ],
  });
}

function StatCard({ icon, label, value, unit, stats, color, connected }) {
  return b.jsxs("div", {
    className: "rounded-lg border border-white/10 bg-white/[0.02] p-2 flex-1 min-w-[130px]",
    children: [
      b.jsxs("div", {
        className: "flex items-center gap-1 mb-1",
        children: [
          b.jsx("div", {
            className: "p-1 rounded-md border bg-black/40",
            style: { borderColor: `${color}40`, color },
            children: L.createElement(icon, { size: 11 }),
          }),
          b.jsx("span", {
            className: "text-[7px] font-mono uppercase tracking-widest text-slate-400",
            children: label,
          }),
          !connected &&
            b.jsx(WifiOffIcon, { size: 9, className: "text-slate-600 ml-auto", title: "No recent reading" }),
        ],
      }),
      value == null
        ? b.jsx("div", { className: "text-[10px] font-mono text-slate-600 py-1", children: "Sensor not connected" })
        : b.jsxs(b.Fragment, {
            children: [
              b.jsxs("div", {
                className: "text-[15px] font-semibold text-white font-sans",
                children: [value, b.jsx("span", { className: "text-[9px] text-slate-400 ml-0.5", children: unit })],
              }),
              b.jsx("div", {
                className: "text-[7px] font-mono text-slate-500 mt-0.5",
                children: stats.latestAt ? `Last updated ${formatTime(stats.latestAt)}` : "",
              }),
              b.jsxs("div", {
                className: "flex items-center gap-2 mt-1 text-[7px] font-mono text-slate-500",
                children: [
                  b.jsxs("span", { children: ["min ", stats.min ?? "--"] }),
                  b.jsxs("span", { children: ["max ", stats.max ?? "--"] }),
                  b.jsxs("span", { children: ["avg ", stats.avg ?? "--"] }),
                ],
              }),
              b.jsx("div", { className: "mt-1", children: b.jsx(Trend, { latest: value, avg: stats.avg }) }),
            ],
          }),
    ],
  });
}

export function HealthDashboard({ isOpen, onClose, themeColor }) {
  const [range, setRange] = L.useState("today");
  const [summary, setSummary] = L.useState(null);
  const [hrPoints, setHrPoints] = L.useState([]);
  const [spo2Points, setSpo2Points] = L.useState([]);
  const [latest, setLatest] = L.useState(null);
  const [loading, setLoading] = L.useState(false);
  const [syncing, setSyncing] = L.useState(false);
  const [exportOpen, setExportOpen] = L.useState(false);

  const load = L.useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, historyRes, latestRes] = await Promise.all([
        fetch(`/api/health/summary?range=${range}`).then((r) => r.json()),
        fetch(`/api/health/history?range=${range}`).then((r) => r.json()),
        fetch(`/api/health/latest`).then((r) => r.json()),
      ]);
      setSummary(summaryRes);
      setLatest(latestRes);
      const readings = historyRes.readings || [];
      setHrPoints(
        readings.filter((r) => typeof r.heartRate === "number").map((r) => ({ timestamp: r.timestamp, value: r.heartRate })),
      );
      setSpo2Points(
        readings.filter((r) => typeof r.spo2 === "number").map((r) => ({ timestamp: r.timestamp, value: r.spo2 })),
      );
    } catch (e) {
      console.error("[HealthDashboard] Failed to load health data:", e);
    } finally {
      setLoading(false);
    }
  }, [range]);

  L.useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // Live updates: the server pushes a `siya:health_reading` window event
  // (see MainExperience's onHealthReading -> LiveSession bridge) whenever the
  // background collector or a manual sync appends a new reading. Append it
  // locally instead of refetching the whole dashboard.
  L.useEffect(() => {
    const handler = (evt) => {
      const reading = evt.detail;
      if (!reading || !reading.timestamp) return;
      setLatest((prev) => {
        const next = { ...(prev || {}) };
        if (typeof reading.heartRate === "number") next.heartRate = reading;
        if (typeof reading.spo2 === "number") next.spo2 = reading;
        return next;
      });
      if (typeof reading.heartRate === "number") {
        setHrPoints((prev) => [...prev, { timestamp: reading.timestamp, value: reading.heartRate }]);
      }
      if (typeof reading.spo2 === "number") {
        setSpo2Points((prev) => [...prev, { timestamp: reading.timestamp, value: reading.spo2 }]);
      }
    };
    window.addEventListener("siya:health_reading", handler);
    return () => window.removeEventListener("siya:health_reading", handler);
  }, []);

  const [liveStatus, setLiveStatus] = L.useState(null);
  L.useEffect(() => {
    const handler = (evt) => {
      setLiveStatus(evt.detail);
      if (evt.detail.status !== "checking") {
        const token = evt.detail;
        setTimeout(() => setLiveStatus((cur) => (cur === token ? null : cur)), 5000);
      }
      if (evt.detail.status === "success") load();
    };
    window.addEventListener("siya:health_sync_status", handler);
    return () => window.removeEventListener("siya:health_sync_status", handler);
  }, [load]);

  const accent = themeAccent(themeColor);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/health/sync", { method: "POST" });
      await load();
    } catch (e) {
      console.error("[HealthDashboard] Manual sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = (format) => {
    const a = document.createElement("a");
    a.href = `/api/health/export?format=${format}&range=${range}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setExportOpen(false);
  };

  const hrConnected = !!(latest && latest.heartRate && Date.now() - new Date(latest.heartRate.timestamp).getTime() < STALE_AFTER_MS);
  const spo2Connected = !!(latest && latest.spo2 && Date.now() - new Date(latest.spo2.timestamp).getTime() < STALE_AFTER_MS);

  return b.jsx(Ti, {
    children:
      isOpen &&
      b.jsxs(b.Fragment, {
        children: [
          b.jsx(mn.div, {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            onClick: onClose,
            className: "absolute inset-0 bg-black/60 z-40 backdrop-blur-sm",
          }),
          b.jsxs(mn.div, {
            initial: { opacity: 0, y: 16, scale: 0.98 },
            animate: { opacity: 1, y: 0, scale: 1 },
            exit: { opacity: 0, y: 16, scale: 0.98 },
            transition: { type: "spring", damping: 25, stiffness: 200 },
            className:
              "absolute inset-0 m-auto w-[92vw] max-w-[560px] h-fit max-h-[88vh] bg-[#020206]/95 border border-white/15 rounded-xl backdrop-blur-2xl z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden",
            children: [
              b.jsxs("div", {
                className: "p-2 border-b border-white/10 flex items-center justify-between shrink-0",
                children: [
                  b.jsxs("div", {
                    className: "flex items-center gap-1.5",
                    children: [
                      b.jsx("div", {
                        className: `p-1.5 rounded-lg border ${accent}`,
                        children: b.jsx(HeartIcon, { size: 13, className: loading ? "animate-pulse" : "" }),
                      }),
                      b.jsxs("div", {
                        children: [
                          b.jsx("h3", {
                            className: "font-display font-medium text-[10px] tracking-tight text-white",
                            children: "Health Data",
                          }),
                          b.jsxs("p", {
                            className: "text-[7px] font-mono uppercase tracking-widest text-slate-400 mt-0.5 flex items-center gap-1",
                            children: [
                              "Synced from paired smartwatch",
                              liveStatus &&
                                liveStatus.status === "checking" &&
                                b.jsxs(b.Fragment, {
                                  children: [
                                    b.jsx("span", { className: "w-1 h-1 rounded-full bg-amber-400 animate-pulse" }),
                                    b.jsx("span", { className: "text-amber-400 normal-case tracking-normal", children: "syncing..." }),
                                  ],
                                }),
                              liveStatus &&
                                liveStatus.status === "success" &&
                                b.jsxs(b.Fragment, {
                                  children: [
                                    b.jsx("span", {
                                      className: "w-1 h-1 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)]",
                                    }),
                                    b.jsx("span", { className: "text-green-400 normal-case tracking-normal", children: "synced" }),
                                  ],
                                }),
                              liveStatus &&
                                liveStatus.status === "error" &&
                                b.jsxs(b.Fragment, {
                                  children: [
                                    b.jsx("span", { className: "w-1 h-1 rounded-full bg-rose-400" }),
                                    b.jsx("span", { className: "text-rose-400 normal-case tracking-normal", children: "sync failed" }),
                                  ],
                                }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                  b.jsxs("div", {
                    className: "flex items-center gap-1",
                    children: [
                      b.jsx("button", {
                        onClick: handleSync,
                        disabled: syncing,
                        title: "Sync now",
                        className:
                          "p-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer disabled:opacity-40",
                        children: b.jsx(RefreshIcon, { size: 11, className: syncing ? "animate-spin" : "" }),
                      }),
                      b.jsx("button", {
                        onClick: onClose,
                        className:
                          "p-1 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer",
                        children: b.jsx(Is, { size: 11 }),
                      }),
                    ],
                  }),
                ],
              }),
              b.jsxs("div", {
                className: "flex-1 overflow-y-auto p-2 space-y-2",
                children: [
                  b.jsxs("div", {
                    className: "flex gap-2 flex-wrap",
                    children: [
                      b.jsx(StatCard, {
                        icon: HeartIcon,
                        label: "Heart Rate",
                        value: latest && latest.heartRate ? latest.heartRate.heartRate : null,
                        unit: "BPM",
                        stats: (summary && summary.heartRate) || {},
                        color: "#fb7185",
                        connected: hrConnected,
                      }),
                      b.jsx(StatCard, {
                        icon: DropIcon,
                        label: "Blood Oxygen",
                        value: latest && latest.spo2 ? latest.spo2.spo2 : null,
                        unit: "% SpO2",
                        stats: (summary && summary.spo2) || {},
                        color: "#22d3ee",
                        connected: spo2Connected,
                      }),
                    ],
                  }),
                  b.jsxs("div", {
                    className: "rounded-lg border border-white/10 bg-white/[0.02] p-2",
                    children: [
                      b.jsxs("span", {
                        className: "text-[7px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1",
                        children: [b.jsx(HeartIcon, { size: 9, className: "text-rose-400" }), "Heart Rate"],
                      }),
                      b.jsx(LineChart, { points: hrPoints, color: "#fb7185", unit: "", range }),
                    ],
                  }),
                  b.jsxs("div", {
                    className: "rounded-lg border border-white/10 bg-white/[0.02] p-2",
                    children: [
                      b.jsxs("span", {
                        className: "text-[7px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-1",
                        children: [b.jsx(DropIcon, { size: 9, className: "text-cyan-400" }), "Blood Oxygen"],
                      }),
                      b.jsx(LineChart, { points: spo2Points, color: "#22d3ee", unit: "%", range }),
                    ],
                  }),
                ],
              }),
              b.jsxs("div", {
                className: "p-2 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2 shrink-0 flex-wrap",
                children: [
                  b.jsx("div", {
                    className: "flex gap-1 overflow-x-auto no-scrollbar",
                    children: RANGES.map((r) =>
                      b.jsx(
                        "button",
                        {
                          onClick: () => setRange(r.id),
                          className: `px-1.5 py-0.5 rounded-full border text-[7px] tracking-wider uppercase transition cursor-pointer shrink-0 ${range === r.id ? "border-white bg-white text-slate-950 font-bold" : "border-white/5 bg-white/5 text-slate-400 hover:border-white/15"}`,
                          children: r.label,
                        },
                        r.id,
                      ),
                    ),
                  }),
                  b.jsxs("div", {
                    className: "relative",
                    children: [
                      b.jsxs("button", {
                        onClick: () => setExportOpen(!exportOpen),
                        className:
                          "flex items-center gap-1 px-1.5 py-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-[7px] font-mono tracking-wider text-cyan-300 transition shrink-0 cursor-pointer",
                        children: [b.jsx(DownloadIcon, { size: 8 }), b.jsx("span", { children: "Export data" })],
                      }),
                      exportOpen &&
                        b.jsxs("div", {
                          className:
                            "absolute bottom-full right-0 mb-1 rounded-lg border border-white/10 bg-[#050508] shadow-lg overflow-hidden z-10",
                          children: [
                            b.jsx("button", {
                              onClick: () => handleExport("csv"),
                              className: "block w-full text-left px-2 py-1 text-[7px] font-mono text-slate-300 hover:bg-white/10 cursor-pointer",
                              children: "CSV",
                            }),
                            b.jsx("button", {
                              onClick: () => handleExport("json"),
                              className: "block w-full text-left px-2 py-1 text-[7px] font-mono text-slate-300 hover:bg-white/10 cursor-pointer",
                              children: "JSON",
                            }),
                          ],
                        }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
  });
}
