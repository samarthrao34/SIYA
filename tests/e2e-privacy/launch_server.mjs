// Plays the Electron main process: forks the real server bundle with an IPC
// channel (as electron/main.cjs does) and answers screen-capture requests with
// a synthetic image. Every capture request is recorded.
import { fork } from "node:child_process";
import fs from "node:fs";

const [, , appDir, outDir, useIpc] = process.argv;
const log = `${outDir}/electron-capture-requests.jsonl`;
let n = 0;
const child = fork(`${appDir}/dist/server.cjs`, [], {
  cwd: appDir,
  env: process.env,
  stdio: useIpc === "ipc" ? ["ignore", "inherit", "inherit", "ipc"] : ["ignore", "inherit", "inherit", "ipc"],
});
if (useIpc === "ipc") {
  child.on("message", (message) => {
    if (!message || message.type !== "screen-capture-request") return;
    n += 1;
    fs.appendFileSync(log, JSON.stringify({ at: Date.now(), id: message.id }) + "\n");
    const slow = fs.existsSync(`${outDir}/slow-capture`) ? 3000 : 0;
    setTimeout(() => child.send({
      type: "screen-capture-response",
      id: message.id,
      ok: true,
      result: { result: "Captured display (10x10).", width: 10, height: 10, image_base64: Buffer.from(`ELECTRONIMG-${n}`).toString("base64"), image_mime: "image/jpeg" },
    }), slow);
  });
} else {
  // Agent path: refuse Electron capture so the server falls back to the agent.
  child.on("message", (message) => {
    if (message?.type === "screen-capture-request") child.send({ type: "screen-capture-response", id: message.id, ok: false, error: "no electron in this run" });
  });
}
process.on("SIGTERM", () => child.kill("SIGKILL"));
