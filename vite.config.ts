import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Recovered config: original was inferred from dist/index.html asset layout
// (single-page app, /assets/* bundle) plus the electron/main.cjs comment
// that the Express backend (server.ts) serves the built UI on :3000. Adjust
// server.proxy below if the backend port differs from what you remember.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/live": { target: "ws://localhost:3000", ws: true },
    },
  },
});
