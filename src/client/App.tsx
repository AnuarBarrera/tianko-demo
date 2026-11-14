import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Me = { id: string; email: string; nombre: string };
type Producto = {
  id: string;
  puesto_nombre: string;
  nombre: string;
  precio: number;
  unidad: string;
  imagen_url: string;
  stock: number;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  return data;
}

export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cobro, setCobro] = useState<{ pagoId: string; qrString: string; monto: number } | null>(null);
  const [estado, setEstado] = useState<"pendiente" | "pagado">("pendiente");
  const [conf, setConf] = useState<{ fecha: string | null; transaccion: string | null; monto: number | null } | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [{ me: m }, { producto: p }] = await Promise.all([
          api<{ me: Me | null }>("/api/me"),
          api<{ producto: Producto }>("/api/producto"),
        ]);
        setMe(m);
        setProducto(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo cargar la demo");
      }
    })();
  }, []);

  useEffect(() => {
    if (!cobro || estado === "pagado") return;
    const t = setInterval(async () => {
      try {
        const r = await api<{
          estado: string;
          confirmacion: { fecha: string | null; transaccion: string | null; monto: number | null } | null;
        }>(`/api/pagos/${cobro.pagoId}/revisar`, { method: "POST" });
        if (r.estado === "pagado") {
          setEstado("pagado");
          setConf(r.confirmacion);
          clearInterval(t);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [cobro, estado]);

  const login = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ me: Me }>("/api/demo/login", { method: "POST" });
      setMe(r.me);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login falló");
    } finally {
      setBusy(false);
    }
  }, []);

  const comprar = useCallback(async () => {
    setBusy(true);
    setError(null);
    setEstado("pendiente");
    setConf(null);
    try {
      const r = await api<{ pagoId: string; qrString: string; monto: number }>("/api/comprar", { method: "POST" });
      setCobro({ pagoId: r.pagoId, qrString: r.qrString, monto: r.monto });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo comprar");
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main className="shell">
      <p className="banner">Demo local · SQLite · Pey CoDi $0.01 · sin Supabase</p>
      <h1 className="brand">Tianko</h1>
      <p className="tagline">Prueba el flujo de pago y confirmación.</p>

      {!me ? (
        <section className="card">
          <h2>Cuenta demo</h2>
          <p className="muted">Entra como Ana López (comprador) para generar un QR CoDi real.</p>
          <button className="btn block" disabled={busy} onClick={login} type="button">
            {busy ? "Entrando…" : "Entrar como Ana (comprador)"}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      ) : cobro ? (
        <section className="card">
          <h2>{estado === "pagado" ? "Listo" : "Pagar con CoDi"}</h2>
          {estado === "pagado" ? (
            <div className="ok-box">
              <div aria-hidden style={{ fontSize: "2.5rem" }}>✅</div>
              <h3>Pago confirmado</h3>
              <dl className="dl">
                <dt>Monto</dt>
                <dd>${(conf?.monto ?? cobro.monto).toFixed(2)} MXN</dd>
                {conf?.fecha && (
                  <>
                    <dt>Fecha</dt>
                    <dd>{new Date(conf.fecha).toLocaleString("es-MX")}</dd>
                  </>
                )}
                {conf?.transaccion && (
                  <>
                    <dt>Folio</dt>
                    <dd style={{ wordBreak: "break-all" }}>{conf.transaccion}</dd>
                  </>
                )}
              </dl>
            </div>
          ) : (
            <>
              <p className="muted">Escanea con la app de tu banco. Monto: <b>$0.01 MXN</b></p>
              <div className="qr-wrap">
                <QRCodeSVG value={cobro.qrString} size={220} />
              </div>
              <p className="muted" style={{ textAlign: "center", marginTop: "0.75rem" }}>
                Esperando tu pago…
              </p>
            </>
          )}
          <button
            className="btn ghost block"
            style={{ marginTop: "1rem" }}
            type="button"
            onClick={() => {
              setCobro(null);
              setEstado("pendiente");
              setConf(null);
            }}
          >
            {estado === "pagado" ? "Volver al producto" : "Cancelar"}
          </button>
        </section>
      ) : producto ? (
        <section className="card product">
          <img src={producto.imagen_url} alt={producto.nombre} />
          <div>
            <p className="muted">{producto.puesto_nombre}</p>
            <h2>{producto.nombre}</h2>
            <span className="price">
              ${producto.precio.toFixed(2)} <small>/{producto.unidad}</small>
            </span>
            <p className="muted">Hola {me.nombre}. El cobro de prueba es $0.01 vía Pey.</p>
            <button className="btn block" disabled={busy || producto.stock < 1} onClick={comprar} type="button">
              {busy ? "Generando QR…" : "Comprar y pagar con CoDi"}
            </button>
            {error && <p className="error">{error}</p>}
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="muted">Cargando producto…</p>
          {error && <p className="error">{error}</p>}
        </section>
      )}
    </main>
  );
}
