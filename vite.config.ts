import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const api = Number(process.env.API_PORT || 3456);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    host: true,
    port: Number(process.env.VITE_PORT || 3457),
    allowedHosts: ["tianko.anuarbarrera.dev", "localhost"],
    proxy: {
      "/api": { target: `http://127.0.0.1:${api}`, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
  },
});
