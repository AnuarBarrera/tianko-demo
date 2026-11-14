# Tianko Demo (SQLite + Pey CoDi)

Demo mínima del flujo **login comprador → comprar → QR CoDi $0.01 → confirmación**.  
Sin Supabase. Datos locales en `data/tianko-demo.sqlite`.

## Setup

```bash
cp .env.example .env
# Llena PEY_API_KEY, PEY_WEBHOOK_SECRET, DEMO_SESSION_SECRET
npm install
npm run dev
```

- App (UI + API): http://localhost:1234  
- Webhook: `POST /api/public/pey-webhook` (mismo puerto)
En [portal.mipey.mx](https://portal.mipey.mx) registra una URL pública a ese webhook (p. ej. con túnel) usando la misma API key.

## Secretos

- **Nunca** commits de `.env` ni `data/*.sqlite`
- Usa solo `.env.example` en el repo

## Stack

Vite + React, Hono, SQLite (`node:sqlite`, Node ≥ 22.5), Pey CoDi.
