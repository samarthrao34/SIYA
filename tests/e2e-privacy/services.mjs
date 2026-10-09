// Fake downstream services for the SIYA end-to-end privacy harness.
// Everything binds to 127.0.0.1 inside an isolated network namespace.
//   :9379 fake local LLM (OpenAI-compatible, streamed). Records every request.
//         Replies "TOOL: {name}" when the latest user text contains "RUN <tool>".
//   :8795 fake voice service (health, /tts, ws /vad).
//   :8765 fake desktop agent (health, /observe, /execute). Records every request.
import http from "node:http";
import fs from "node:fs";
import { createRequire } from "node:module";

const [, , appDir, outDir] = process.argv;
const require = createRequire(`${appDir}/package.json`);
const { WebSocketServer } = require("ws");
const llmLog = `${outDir}/llm-requests.jsonl`;
const agentLog = `${outDir}/agent-requests.jsonl`;
let agentImageCounter = 0;

function textOf(content) {
  if (typeof content === "string") return content;
  return (content || []).map((p) => (p.type === "text" ? p.text : "")).join("\n");
}
function imagesOf(messages) {
  const found = [];
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const p of m.content) {
      if (p.type === "image_url") {
        const b64 = String(p.image_url?.url || "").split(",")[1] || "";
        found.push(Buffer.from(b64, "base64").toString("latin1").slice(0, 40));
      }
    }
  }
  return found;
}

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url.endsWith("/models")) return res.end(JSON.stringify({ data: [{ id: "fake" }] }));
    const json = JSON.parse(body || "{}");
    const messages = json.messages || [];
    const last = textOf(messages[messages.length - 1]?.content);
    const allText = messages.map((m) => textOf(m.content)).join("\n");
    fs.appendFileSync(llmLog, JSON.stringify({ at: Date.now(), last: last.slice(0, 400), images: imagesOf(messages.slice(-1)), mentionsSecretTitle: /SECRET-WINDOW-TITLE|secret-app/.test(allText) }) + "\n");
    const run = last.match(/RUN (\w+)/);
    const reply = run && !/^\w+: /m.test(last) ? `TOOL: {"name": "${run[1]}", "args": {}}` : "SIYA: theek hai.";
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: reply + "\n" } }] })}\n\n`);
    res.end("data: [DONE]\n\n");
  });
}).listen(9379, "127.0.0.1");

const voice = http.createServer((req, res) => {
  if (req.url === "/health") return res.end(JSON.stringify({ ok: true }));
  if (req.url === "/tts") { req.resume(); res.writeHead(200, { "Content-Type": "application/octet-stream" }); return res.end(Buffer.alloc(4800)); }
  res.end("{}");
});
new WebSocketServer({ server: voice, path: "/vad" }).on("connection", (ws) => ws.on("message", () => {}));
voice.listen(8795, "127.0.0.1");

http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    const tool = (() => { try { return JSON.parse(body || "{}").tool || ""; } catch { return ""; } })();
    fs.appendFileSync(agentLog, JSON.stringify({ at: Date.now(), path: req.url, tool }) + "\n");
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/observe") return res.end(JSON.stringify({ timestamp: new Date().toISOString(), activeWindow: { title: "SECRET-WINDOW-TITLE", application: "secret-app", pid: 1 }, applications: ["secret-app"], userIdleSeconds: 0 }));
    if (req.url === "/execute") {
      if (tool === "viewScreen" || tool === "takeScreenshot") {
        agentImageCounter += 1;
        if (fs.existsSync(`${outDir}/slow-capture`)) await new Promise((r) => setTimeout(r, 3000));
        return res.end(JSON.stringify({ ok: true, tool, result: { result: "captured", image_base64: Buffer.from(`AGENTIMG-${agentImageCounter}`).toString("base64"), image_mime: "image/jpeg", width: 10, height: 10, active_window: "SECRET-WINDOW-TITLE" } }));
      }
      if (tool === "minimizeWindow") return res.end(JSON.stringify({ ok: true, tool, result: { result: "Minimized window: SECRET-WINDOW-TITLE (moved to special workspace)." } }));
      return res.end(JSON.stringify({ ok: true, tool, result: { result: "ok" } }));
    }
    res.end(JSON.stringify({ status: "ok", tools: ["viewScreen"] }));
  });
}).listen(8765, "127.0.0.1");
console.log("fake services up");
