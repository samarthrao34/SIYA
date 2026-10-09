import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Standalone mobile build: a self-contained bundle with no dependency on
// server/index.ts -- it talks to Gemini directly from the browser. Shares the
// character model/textures and the pcm-capture-worklet with the desktop app
// via the same public/ dir. Output feeds mobile/build-mobile.sh, which packs
// it into the Android app's assets/ so it's served locally on-device (see
// AssetServer.java) instead of needing a laptop relay.

// Every VITE_* value is compiled into the bundle and can be read out of the
// APK, so a credential must never be one. Fail the build instead of shipping it.
const CREDENTIAL_NAME = /TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|PRIVATE|BEARER|AUTH/i;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "mobile/app", "VITE_");
  const leaked = Object.keys(env).filter((name) => CREDENTIAL_NAME.test(name));
  if (leaked.length > 0) {
    throw new Error(
      `Refusing to build: ${leaked.join(", ")} would be embedded in the mobile bundle. ` +
        "Remove it from mobile/app/.env and the environment; the memory gateway authenticates the phone instead.",
    );
  }
  return {
    root: "mobile/app",
    plugins: [react(), tailwindcss()],
    publicDir: "../../public",
    build: {
      outDir: "../webapp-dist",
      emptyOutDir: true,
    },
  };
});
