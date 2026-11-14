import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRequestListener } from "@hono/node-server";
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
const port = Number(process.env.PORT || 1234);
const host = process.env.HOST || "0.0.0.0";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function main() {
  if (isProd) {
    app.use("/producto.jpg", serveStatic({ root: "./public" }));
    app.use("/*", serveStatic({ root: "./dist/client" }));
    app.get("*", async (c) => {
      const html = await fs.promises.readFile("./dist/client/index.html", "utf8");
      return c.html(html);
    });
    const server = http.createServer(getRequestListener(app.fetch));
    server.listen(port, host, () => {
      console.log(`Tianko demo (prod) → http://localhost:${port}`);
      console.log(`Webhook → POST /api/public/pey-webhook`);
    });
    return;
  }

  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    root,
    configFile: path.join(root, "vite.config.ts"),
    server: { middlewareMode: true, allowedHosts: ["tianko.anuarbarrera.dev", "localhost"] },
    appType: "custom",
  });

  const apiListener = getRequestListener(app.fetch);

  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url.startsWith("/api/") || url === "/api") {
      apiListener(req, res);
      return;
    }
    vite.middlewares(req, res, async () => {
      try {
        let template = await fs.promises.readFile(path.join(root, "index.html"), "utf8");
        template = await vite.transformIndexHtml(url, template);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        console.error(e);
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : String(e));
      }
    });
  });

  server.listen(port, host, () => {
    console.log(`Tianko demo → http://localhost:${port}`);
    console.log(`Webhook → POST http://localhost:${port}/api/public/pey-webhook`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
