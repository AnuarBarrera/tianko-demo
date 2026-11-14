import { Hono } from "hono";
import { db, DEMO_PRODUCTO, DEMO_USER, newId } from "./db";
import { clearDemoSession, readSession, setDemoSession } from "./auth";
import {
  EVENTO_PAGO_QR,
  EventoPey,
  MONTO_COBRO,
  crearCodiQr,
  firmaValida,
  peyQrPagado,
} from "./pey";

export type AppEnv = { Variables: Record<string, never> };

export const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ ok: true }));

app.post("/api/demo/login", (c) => {
  setDemoSession(c);
  // Cookie is on the response; return seed user directly (getCookie won't see it yet).
  return c.json({ me: { id: DEMO_USER.id, email: DEMO_USER.email, nombre: DEMO_USER.nombre } });
});

app.post("/api/demo/logout", (c) => {
  clearDemoSession(c);
  return c.json({ ok: true });
});

app.get("/api/me", (c) => {
  const me = readSession(c);
  return c.json({ me });
});

app.get("/api/producto", (c) => {
  const row = db()
    .prepare(
      `SELECT id, puesto_id, puesto_nombre, nombre, precio, unidad, imagen_url, stock
       FROM productos WHERE id = ?`,
    )
    .get(DEMO_PRODUCTO.id) as
    | {
        id: string;
        puesto_id: string;
        puesto_nombre: string;
        nombre: string;
        precio: number;
        unidad: string;
        imagen_url: string;
        stock: number;
      }
    | undefined;
  if (!row) return c.json({ error: "Sin producto" }, 404);
  return c.json({ producto: row });
});

app.post("/api/comprar", async (c) => {
  const me = readSession(c);
  if (!me) return c.json({ error: "Entra con la cuenta demo" }, 401);

  const prod = db()
    .prepare(`SELECT * FROM productos WHERE id = ?`)
    .get(DEMO_PRODUCTO.id) as typeof DEMO_PRODUCTO | undefined;
  if (!prod || prod.stock < 1) return c.json({ error: "Producto no disponible" }, 400);

  const pedidoId = newId();
  const pagoId = newId();
  const now = new Date().toISOString();
  const cantidad = 1;
  const total = prod.precio * cantidad;

  const qr = await crearCodiQr({
    orderId: pedidoId,
    customerId: me.id,
    customerEmail: me.email,
    storeId: prod.puesto_id,
    vendorId: prod.vendor_id,
  });
  if (!qr.ok) return c.json({ error: qr.error }, 502);

  const d = db();
  d.exec("BEGIN");
  try {
    d.prepare(
      `INSERT INTO pedidos (id, comprador_id, comprador_nombre, puesto_id, producto_id, cantidad, total, estado, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
    ).run(pedidoId, me.id, me.nombre, prod.puesto_id, prod.id, cantidad, total, now);

    d.prepare(
      `INSERT INTO pagos (id, pedido_id, comprador_id, monto, estado, pey_id, qr_string, created_at)
       VALUES (?, ?, ?, ?, 'pendiente', ?, ?, ?)`,
    ).run(pagoId, pedidoId, me.id, MONTO_COBRO, qr.data.id, qr.data.qrString, now);

    d.prepare(`UPDATE productos SET stock = stock - 1 WHERE id = ? AND stock > 0`).run(prod.id);
    d.exec("COMMIT");
  } catch (e) {
    d.exec("ROLLBACK");
    console.error("comprar", e);
    return c.json({ error: "No se pudo crear el pedido" }, 500);
  }

  return c.json({
    pedidoId,
    pagoId,
    qrString: qr.data.qrString,
    monto: MONTO_COBRO,
  });
});

app.post("/api/pagos/:id/revisar", async (c) => {
  const me = readSession(c);
  if (!me) return c.json({ error: "No autenticado" }, 401);
  const pagoId = c.req.param("id");

  const pago = db()
    .prepare(
      `SELECT id, pey_id, estado, pagado_at, pey_transaction_id, monto_pagado, comprador_id
       FROM pagos WHERE id = ?`,
    )
    .get(pagoId) as
    | {
        id: string;
        pey_id: string | null;
        estado: string;
        pagado_at: string | null;
        pey_transaction_id: string | null;
        monto_pagado: number | null;
        comprador_id: string;
      }
    | undefined;

  if (!pago || pago.comprador_id !== me.id) return c.json({ estado: "desconocido", confirmacion: null });

  const conf = {
    fecha: pago.pagado_at,
    transaccion: pago.pey_transaction_id,
    monto: pago.monto_pagado == null ? null : Number(pago.monto_pagado),
  };

  if (pago.estado === "pagado") return c.json({ estado: "pagado", confirmacion: conf });
  if (!pago.pey_id) return c.json({ estado: pago.estado, confirmacion: null });

  if (await peyQrPagado(pago.pey_id)) {
    const at = new Date().toISOString();
    db()
      .prepare(`UPDATE pagos SET estado = 'pagado', pagado_at = COALESCE(pagado_at, ?) WHERE id = ? AND estado = 'pendiente'`)
      .run(at, pago.id);
    return c.json({
      estado: "pagado",
      confirmacion: { ...conf, fecha: conf.fecha ?? at, monto: conf.monto ?? MONTO_COBRO },
    });
  }
  return c.json({ estado: "pendiente", confirmacion: null });
});

app.post("/api/public/pey-webhook", async (c) => {
  const secret = process.env.PEY_WEBHOOK_SECRET;
  if (!secret) return c.text("not configured", 503);

  const body = await c.req.text();
  const id = c.req.header("webhook-id") ?? "";
  const ts = c.req.header("webhook-timestamp") ?? "";
  const sig = c.req.header("webhook-signature") ?? "";
  if (!id || !ts || !sig || !(await firmaValida(secret, id, ts, body, sig))) {
    return c.text("invalid signature", 401);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return c.text("invalid json", 400);
  }
  const parsed = EventoPey.safeParse(raw);
  if (!parsed.success) return c.text("bad payload", 400);
  const ev = parsed.data;

  if (ev.type !== EVENTO_PAGO_QR) return c.text("ignored", 200);
  if (!ev.codiQrId) return c.text("missing codiQrId", 400);

  const existente = db()
    .prepare(`SELECT id, estado, pey_transaction_id FROM pagos WHERE pey_id = ?`)
    .get(ev.codiQrId) as { id: string; estado: string; pey_transaction_id: string | null } | undefined;

  if (!existente) {
    console.warn("pey-webhook: no pago for pey_id", ev.codiQrId);
    return c.text("ok", 200);
  }

  if (existente.estado === "pagado") {
    if (!existente.pey_transaction_id && ev.transactionId) {
      db()
        .prepare(`UPDATE pagos SET pey_transaction_id = ?, monto_pagado = ? WHERE id = ?`)
        .run(ev.transactionId, ev.amount ?? null, existente.id);
    }
    return c.text("ok", 200);
  }

  const pagadoAt = new Date((ev.datePaid ?? Date.now() / 1000) * 1000).toISOString();
  db()
    .prepare(
      `UPDATE pagos SET estado = 'pagado', pagado_at = ?, pey_transaction_id = ?, monto_pagado = ?
       WHERE id = ? AND estado = 'pendiente'`,
    )
    .run(pagadoAt, ev.transactionId ?? null, ev.amount ?? null, existente.id);

  return c.text("ok", 200);
});
