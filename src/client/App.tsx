import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Page = "home" | "auth" | "producto";
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

const DEMO = {
  key: "ana",
  nombre: "Ana López",
  etiqueta: "Comprador (pago CoDi)",
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

function Header({
  me,
  page,
  go,
  onLogout,
}: {
  me: Me | null;
  page: Page;
  go: (p: Page) => void;
  onLogout: () => void;
}) {
  return (
    <header className="header">
      <div className="papel-picado" />
      <div className="header-inner">
        <button type="button" className="brand" style={{ border: 0, background: "transparent", cursor: "pointer" }} onClick={() => go("home")}>
          Tianko
        </button>
        <nav className="nav">
          <button type="button" className="linkish" onClick={() => go("producto")}>Portal</button>
          {me ? (
            <>
              <span className="linkish" style={{ cursor: "default" }}>{me.nombre}</span>
              <button type="button" className="linkish" onClick={onLogout}>Salir</button>
            </>
          ) : (
            <button type="button" className="btn" style={{ padding: "0.35rem 0.9rem", fontSize: "0.875rem", borderRadius: "999px" }} onClick={() => go("auth")}>
              Entrar
            </button>
          )}
          {page === "auth" ? null : null}
        </nav>
      </div>
    </header>
  );
}

function PagoQrDialog({
  cobro,
  onClose,
}: {
  cobro: { pagoId: string; qrString: string; monto: number };
  onClose: () => void;
}) {
  const [estado, setEstado] = useState<"pendiente" | "pagado">("pendiente");
  const [conf, setConf] = useState<{ fecha: string | null; transaccion: string | null; monto: number | null } | null>(null);

  useEffect(() => {
    setEstado("pendiente");
    setConf(null);
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
  }, [cobro.pagoId]);

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="dialog">
        <h2>{estado === "pagado" ? "Pago confirmado" : "Pagar con CoDi"}</h2>
        {estado === "pagado" ? (
          <div className="ok-box">
            <div aria-hidden style={{ fontSize: "2.5rem" }}>✅</div>
            <p className="title">Pago confirmado</p>
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
            <p className="muted">Escanea el código con la app de tu banco. Monto: <b>$0.01 MXN</b></p>
            <div className="qr-box">
              <QRCodeSVG value={cobro.qrString} size={220} />
            </div>
            <p className="muted center">Esperando tu pago…</p>
          </>
        )}
        <button type="button" className={`btn ${estado === "pagado" ? "" : "btn-outline"} btn-block mt-4`} onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [me, setMe] = useState<Me | null>(null);
  const [producto, setProducto] = useState<Producto | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cobro, setCobro] = useState<{ pagoId: string; qrString: string; monto: number } | null>(null);

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
        setError(e instanceof Error ? e.message : "No se pudo cargar");
      }
    })();
  }, []);

  const logout = useCallback(async () => {
    await api("/api/demo/logout", { method: "POST" }).catch(() => null);
    setMe(null);
    setPage("home");
  }, []);

  const demoLogin = useCallback(async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const r = await api<{ me: Me }>("/api/demo/login", { method: "POST" });
      setMe(r.me);
      setPage("producto");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar con la cuenta demo");
    } finally {
      setDemoLoading(false);
    }
  }, []);

  const comprar = useCallback(async () => {
    if (!me) {
      setPage("auth");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ pagoId: string; qrString: string; monto: number }>("/api/comprar", { method: "POST" });
      setCobro({ pagoId: r.pagoId, qrString: r.qrString, monto: r.monto });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el pago");
    } finally {
      setBusy(false);
    }
  }, [me]);

  return (
    <>
      <Header me={me} page={page} go={setPage} onLogout={() => void logout()} />

      {page === "home" && (
        <main>
          <section className="hero">
            <img src="/hero-tianguis.jpg" alt="Tianguis mexicano con papel picado" width={1600} height={1008} />
            <div className="hero-veil" />
            <div className="hero-content">
              <span className="pill">Conectando al Barrio. . .</span>
              <div className="hero-card">
                <h1>Tianko</h1>
                <p>El tianguis en tu mano: descubre dónde ponen, qué venden y a cuánto, o registra tu puesto.</p>
              </div>
              <div className="hero-actions">
                <button type="button" className="btn btn-lg" onClick={() => setPage("auth")}>Entrar o registrarme</button>
                <button type="button" className="btn btn-lg btn-secondary" onClick={() => setPage("producto")}>Solo quiero ver el portal</button>
              </div>
            </div>
          </section>

          <section className="features">
            <div className="feature f1">
              <h3>Tianguis cerca</h3>
              <p>Días, horarios y ubicación en el mapa.</p>
            </div>
            <div className="feature f2">
              <h3>Puestos y marchantes</h3>
              <p>Conoce a quién le compras.</p>
            </div>
            <div className="feature f3">
              <h3>Precios claros</h3>
              <p>Compara antes de ir.</p>
            </div>
          </section>
        </main>
      )}

      {page === "auth" && (
        <main className="page">
          <div className="card">
            <h1>¡Bienvenido!</h1>
            <p className="muted mb-3">Entra a tu cuenta</p>
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Demo local con SQLite: usa la cuenta comprador para probar el pago CoDi.
            </p>
          </div>

          <div className="demo-box">
            <h2>Cuenta demo</h2>
            <p className="muted mb-3" style={{ fontSize: "0.9rem" }}>
              Entra como comprador para probar pedido, pago CoDi y confirmación.
            </p>
            <button type="button" className="demo-btn" disabled={demoLoading} onClick={() => void demoLogin()}>
              <strong>{DEMO.nombre}</strong>
              <span>{demoLoading ? "Entrando…" : DEMO.etiqueta}</span>
            </button>
            {error && <p className="error">{error}</p>}
          </div>

          <p className="center mt-4">
            <button type="button" className="btn btn-ghost" onClick={() => setPage("producto")}>
              Solo quiero consultar el portal →
            </button>
          </p>
        </main>
      )}

      {page === "producto" && (
        <main className="page page-wide">
          {producto ? (
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="product-grid">
                <div className="product-media">
                  <img src={producto.imagen_url} alt={producto.nombre} />
                </div>
                <div className="product-body">
                  <div>
                    <p className="muted" style={{ margin: 0 }}>{producto.puesto_nombre}</p>
                    <h2 style={{ fontSize: "1.75rem", marginTop: "0.25rem" }}>{producto.nombre}</h2>
                  </div>
                  <span className="price-pill">
                    ${producto.precio.toFixed(2)} <small>/{producto.unidad}</small>
                  </span>
                  <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                    {me
                      ? `Hola ${me.nombre}. El cobro de prueba es $0.01 vía Pey CoDi.`
                      : "Entra con la cuenta demo para comprar y pagar."}
                  </p>
                  {me ? (
                    <button type="button" className="btn btn-block" disabled={busy || producto.stock < 1} onClick={() => void comprar()}>
                      {busy ? "Generando QR…" : "Comprar y pagar con CoDi"}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-block" onClick={() => setPage("auth")}>
                      Entra para comprar
                    </button>
                  )}
                  {error && <p className="error">{error}</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="card"><p className="muted">Cargando producto…</p></div>
          )}
        </main>
      )}

      {cobro && <PagoQrDialog cobro={cobro} onClose={() => setCobro(null)} />}
    </>
  );
}
