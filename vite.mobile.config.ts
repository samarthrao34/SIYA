import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Standalone mobile build: a self-contained bundle with no dependency on
// server/index.ts -- it talks to Gemini directly from the browser. Shares the
// character model/textures and the pcm-capture-worklet with the desktop app
// via the same public/ dir. Output feeds mobile/build-mobile.sh, which packs
// it into the Android app's assets/ so it's served locally on-device (see
// AssetServer.java) instead of needing a laptop relay.
export default defineConfig({
  root: "mobile/app",
  plugins: [react(), tailwindcss()],
  publicDir: "../../public",
  build: {
    outDir: "../webapp-dist",
    emptyOutDir: true,
  },
});
