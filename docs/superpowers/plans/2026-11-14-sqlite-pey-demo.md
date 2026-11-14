# Tianko Demo (SQLite + Pey) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Private new repo with a minimal local demo: cookie login as buyer Ana → buy seed product → Pey CoDi QR ($0.01) → poll/webhook confirmation. No Supabase.

**Architecture:** Vite React SPA + Hono API on one Node process (`tsx server`). SQLite via `node:sqlite`. Secrets only in `.env` (gitignored).

**Tech Stack:** Vite 6, React 19, Hono, `node:sqlite`, qrcode.react, zod, TypeScript.

## File map

- `src/server/db.ts` — SQLite schema + seed
- `src/server/auth.ts` — signed demo cookie
- `src/server/pey.ts` — create QR + poll + webhook verify
- `src/server/app.ts` — Hono routes
- `src/server/index.ts` — listen + Vite middleware in dev
- `src/client/*` — login, product, pay dialog
- `.env.example` — `PEY_API_KEY`, `PEY_WEBHOOK_SECRET`, `DEMO_SESSION_SECRET`
- `.gitignore` — `.env`, `data/*.sqlite`

### Task 1: Scaffold + secrets hygiene

- [ ] Create package.json, tsconfig, vite.config, .gitignore, .env.example, README
- [ ] Copy PEY_* into local `.env` only (never commit)
- [ ] `npm install`

### Task 2: SQLite + API

- [ ] Schema: users, productos, pedidos, pagos
- [ ] Seed Ana + 1 producto
- [ ] Routes: `POST /api/demo/login`, `GET /api/me`, `GET /api/producto`, `POST /api/comprar`, `POST /api/pagos/:id/revisar`, `POST /api/public/pey-webhook`

### Task 3: UI demo

- [ ] Page: login demo → product card → Comprar → QR → “Pago confirmado”

### Task 4: Private GitHub repo

- [ ] `gh repo create` private, push without `.env`
- [ ] Document webhook URL + env setup in README
