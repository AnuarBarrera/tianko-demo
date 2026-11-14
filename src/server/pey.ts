import { z } from "zod";

export const MONTO_COBRO = 0.01;
const PEY = "https://api.pey.mx";

export type QrResult = { id: string; qrString: string };

export async function crearCodiQr(args: {
  orderId: string;
  customerId: string;
  customerEmail: string;
  storeId: string;
  vendorId: string;
}): Promise<{ ok: true; data: QrResult } | { ok: false; error: string }> {
  const key = process.env.PEY_API_KEY;
  if (!key) return { ok: false, error: "Pagos no configurados (PEY_API_KEY)" };

  const corto = args.orderId.replace(/-/g, "").slice(0, 10).toUpperCase();
  const body = {
    amount: MONTO_COBRO,
    concept: `Tianko ORD-${corto}`.slice(0, 40),
    expiration: 0,
    generateImage: false,
    metadata: {
      order_id: `ORD-${corto}`,
      invoice_number: `FAC-${new Date().getFullYear()}-${corto}`,
      customer_id: args.customerId,
      customer_email: args.customerEmail,
      store_id: args.storeId,
      vendor_id: args.vendorId,
      platform: "web",
      utm_source: "demo",
      utm_campaign: "sqlite",
      pago_tipo: "completo",
      origen: "comprar",
    },
  };

  const res = await fetch(`${PEY}/codi/qr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; qrString?: string };
  if (!res.ok || !json.qrString || !json.id) {
    console.error("Pey /codi/qr", res.status, JSON.stringify(json).slice(0, 300));
    return { ok: false, error: "No se pudo generar el código de pago" };
  }
  return { ok: true, data: { id: json.id, qrString: json.qrString } };
}

export async function peyQrPagado(peyId: string): Promise<boolean> {
  const key = process.env.PEY_API_KEY;
  if (!key) return false;
  const res = await fetch(`${PEY}/transaction/codi/qr/${encodeURIComponent(peyId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { items?: { status: string }[] };
  return !!body.items?.some((t) => t.status === "PAID");
}

export const EventoPey = z
  .object({
    type: z.string(),
    codiQrId: z.string().max(100).optional(),
    transactionId: z.string().max(100).optional(),
    amount: z.number().optional(),
    datePaid: z.number().optional(),
  })
  .passthrough();

export const EVENTO_PAGO_QR = "codi.qr.payment_received";

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

function macToB64(mac: Uint8Array): string {
  return Buffer.from(mac).toString("base64");
}

/** Standard Webhooks: v1,<base64(HMAC-SHA256(id.timestamp.body))> */
export async function firmaValida(
  secret: string,
  id: string,
  ts: string,
  body: string,
  header: string,
): Promise<boolean> {
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) return false;
  const raw = secret.startsWith("whsec_") ? b64ToBytes(secret.slice(6)) : new TextEncoder().encode(secret);
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)));
  const esperado = macToB64(mac);
  return header.split(" ").some((part) => {
    const [v, sig] = part.split(",");
    if (v !== "v1" || !sig || sig.length !== esperado.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ esperado.charCodeAt(i);
    return diff === 0;
  });
}
