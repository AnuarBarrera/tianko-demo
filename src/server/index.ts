import fs from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { app } from "./app";
import { db } from "./db";

function loadEnv() {
  const p = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();
db();

const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env.API_PORT || process.env.PORT || (isProd ? 3457 : 3456));
const host = process.env.HOST || "0.0.0.0";

if (isProd) {
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("*", async (c) => {
    const html = await fs.promises.readFile("./dist/client/index.html", "utf8");
    return c.html(html);
  });
}

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`[api] http://localhost:${info.port}`);
  console.log(`[api] webhook POST /api/public/pey-webhook`);
});
