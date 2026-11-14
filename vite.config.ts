import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  publicDir: "public",
  server: {
    // Served by src/server/index.ts on PORT (default 1234) — middlewareMode.
    middlewareMode: true,
    allowedHosts: ["tianko.anuarbarrera.dev", "localhost"],
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
