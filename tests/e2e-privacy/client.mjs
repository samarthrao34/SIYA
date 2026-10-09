// Scripted SIYA client: drives the real server over /live and checks, from the
// fake services' logs, what reached the "model" and the capture back ends.
import fs from "node:fs";
import { createRequire } from "node:module";

const [, , appDir, outDir, pathName] = process.argv;
const require = createRequire(`${appDir}/package.json`);
const WebSocket = require("ws");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (s) => Buffer.from(s).toString("base64");
const readLines = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const llm = () => readLines(`${outDir}/llm-requests.jsonl`);
const agent = () => readLines(`${outDir}/agent-requests.jsonl`);
const ipc = () => readLines(`${outDir}/electron-capture-requests.jsonl`);
const results = [];
const check = (name, pass, evidence) => { results.push({ name, pass, evidence }); };

const ws = new WebSocket("ws://127.0.0.1:3000/live");
const connected = new Promise((resolve, reject) => {
  ws.on("message", (raw) => { try { const m = JSON.parse(raw); if (m.type === "status" && m.status === "connected") resolve(); if (m.type === "error") reject(new Error(m.error)); } catch {} });
  setTimeout(() => reject(new Error("no connected status within 20s")), 20_000);
});
await new Promise((r) => ws.on("open", r));
await connected;
const send = (m) => ws.send(JSON.stringify(m));
const captures = () => agent().filter((a) => a.path === "/execute" && /viewScreen|takeScreenshot/.test(a.tool)).length + ipc().length;
const since = (t) => llm().filter((r) => r.at >= t);
const imagesSince = (t) => since(t).flatMap((r) => r.images);

// 1. Share screen off (default): screen frame dropped, viewScreen refused.
let t = Date.now();
send({ type: "video", source: "camera", video: b64("CAMFRAME-1"), changeScore: 20 });
send({ type: "video", source: "screen", video: b64("SCREENFRAME-OFF-1"), changeScore: 20 });
await sleep(300);
let c0 = captures();
send({ type: "text", text: "RUN viewScreen" });
await sleep(3000);
check("off: no capture request reached agent or Electron", captures() === c0, `captures ${c0}->${captures()}`);
check("off: screen frame never reached the model", !imagesSince(t).some((i) => i.includes("SCREENFRAME")), `images: ${JSON.stringify(imagesSince(t))}`);
check("off: model told screen access is off", since(t).some((r) => /Screen access is off/.test(r.last)), since(t).map((r) => r.last.slice(0, 80)).join(" | "));

// 2. Share screen on: frames and capture allowed.
t = Date.now();
send({ type: "screen_share", active: true });
await sleep(200);
send({ type: "video", source: "screen", video: b64("SCREENFRAME-ON-1"), changeScore: 20 });
c0 = captures();
send({ type: "text", text: "RUN viewScreen" });
await sleep(3000);
check("on: capture request made", captures() === c0 + 1, `captures ${c0}->${captures()}`);
check("on: captured image reached the model", imagesSince(t).some((i) => /AGENTIMG|ELECTRONIMG/.test(i)), `images: ${JSON.stringify(imagesSince(t))}`);

// 3. Share screen off again: no new capture, and no earlier screen image re-sent.
send({ type: "screen_share", active: false });
await sleep(200);
t = Date.now();
send({ type: "video", source: "screen", video: b64("SCREENFRAME-OFF-2"), changeScore: 20 });
c0 = captures();
send({ type: "text", text: "RUN viewScreen" });
await sleep(3000);
check("off again: no capture request", captures() === c0, `captures ${c0}->${captures()}`);
check("off again: no screen image of any age reached the model", !imagesSince(t).some((i) => /SCREENFRAME|AGENTIMG|ELECTRONIMG/.test(i)), `images: ${JSON.stringify(imagesSince(t))}`);

// 4. Capture in flight when sharing stops: result discarded.
fs.writeFileSync(`${outDir}/slow-capture`, "");
send({ type: "screen_share", active: true });
await sleep(200);
c0 = captures();
t = Date.now();
send({ type: "text", text: "RUN viewScreen" });
await sleep(1200);
send({ type: "screen_share", active: false });
await sleep(4500);
fs.rmSync(`${outDir}/slow-capture`);
check("in flight: capture had started", captures() === c0 + 1, `captures ${c0}->${captures()}`);
check("in flight: its image never reached the model", !imagesSince(t).some((i) => /AGENTIMG|ELECTRONIMG/.test(i)), `images: ${JSON.stringify(imagesSince(t))}`);
check("in flight: model told the capture was discarded", since(t).some((r) => /discarded/.test(r.last)), since(t).map((r) => r.last.slice(0, 80)).join(" | "));

// 5. Activity awareness off (default): titles never reach the model.
t = Date.now();
const a0 = agent().filter((a) => a.tool === "getActiveWindow").length;
send({ type: "text", text: "RUN minimizeWindow" });
await sleep(2500);
send({ type: "text", text: "RUN getActiveWindow" });
await sleep(2500);
check("activity off: getActiveWindow refused before the agent", agent().filter((a) => a.tool === "getActiveWindow").length === a0, `agent getActiveWindow calls ${a0}->${agent().filter((a) => a.tool === "getActiveWindow").length}`);
check("activity off: minimizeWindow ran", agent().some((a) => a.tool === "minimizeWindow"), "agent log");
check("activity off: no window title in anything sent to the model", !since(t).some((r) => r.mentionsSecretTitle), `${since(t).length} model requests checked`);

ws.close();
fs.writeFileSync(`${outDir}/results-${pathName}.json`, JSON.stringify(results, null, 2));
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `  [${r.evidence}]`}`);
