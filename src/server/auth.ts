import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { DEMO_USER } from "./db";

const COOKIE = "tianko_demo_session";

function secret(): string {
  const s = process.env.DEMO_SESSION_SECRET;
  if (!s || s.length < 8) throw new Error("Falta DEMO_SESSION_SECRET en .env");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function setDemoSession(c: Context) {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = `${DEMO_USER.id}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function clearDemoSession(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}

export function readSession(c: Context): { id: string; email: string; nombre: string } | null {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [id, expStr, sig] = parts;
  if (!id || !expStr || !sig) return null;
  const payload = `${id}.${expStr}`;
  const expected = sign(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  if (Number(expStr) < Date.now()) return null;
  if (id !== DEMO_USER.id) return null;
  return { id: DEMO_USER.id, email: DEMO_USER.email, nombre: DEMO_USER.nombre };
}
