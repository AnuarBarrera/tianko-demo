# Tianko

**El tianguis en tu mano.** Tianko acerca el comercio de barrio a una experiencia digital simple: descubrir puestos, apartar o comprar, y pagar con CoDi sin fricción.

Este repositorio es la **demo pública del flujo de pago y confirmación**: un comprador entra, elige un producto de tianguis, paga $0.01 MXN con CoDi (Pey) y ve la confirmación en pantalla.

---

## Qué es (como solución)

Tianko no pretende reemplazar el tianguis: lo **extiende**.

En la calle el valor está en el trato, el surtido y la comunidad. Lo que suele faltar es:

- saber **dónde** ponen hoy y **qué** venden a **cuánto**
- poder **apartar o pagar** antes de llegar
- dar a comerciantes y compradores un canal confiable sin apps bancarias raras ni fricción innecesaria

Tianko propone una capa digital ligera sobre ese mundo: portal + pedido + **pago CoDi** con confirmación automática.

Esta demo aísla la pieza más crítica del producto —**cobrar y confirmar**— para poder mostrarla de punta a punta sin depender de un backend cloud completo.

---

## Para qué es y qué se busca

**Para quién**

- Compradores que ya van al tianguis y quieren llegar con el pago (o la garantía) resuelto
- Comerciantes que quieren recibir pedidos sin inventar un ecommerce desde cero
- Quienes evalúan Tianko (hackathon, partners, banca/fintech) y necesitan ver CoDi funcionando de verdad

**Qué buscamos demostrar**

1. Que un comprador puede autenticarse de forma simple (cuenta demo)
2. Que un pedido genera un QR CoDi real
3. Que el pago se confirma (consulta a Pey y/o webhook) y la UI lo refleja al instante

**Qué no es (aún) esta demo**

- El portal completo de CDMX, mapas, roles de líder/admin o inventario multi-puesto
- Un marketplace en producción con todos los flujos del producto final

Es el **núcleo de confianza del pago**, empaquetado para enseñarlo y probarlo.

---

## Cómo funciona

Flujo feliz de la demo:

```text
Entrar (Ana · comprador)
        ↓
Ver producto de tianguis
        ↓
Comprar → se crea pedido + cobro CoDi ($0.01)
        ↓
Escanear QR con la app del banco
        ↓
Confirmación en pantalla (poll y/o webhook)
```

Arquitectura (un solo proceso en el puerto `1234`):

| Capa | Rol |
|------|-----|
| **UI (React + Vite)** | Landing Tianko, auth con cuenta demo, ficha de producto, diálogo de QR / pago confirmado |
| **API (Hono)** | Sesión demo, catálogo seed, crear cobro, revisar estado, recibir notificaciones de pago |
| **SQLite local** | Persiste usuarios demo, productos, pedidos y pagos sin un backend cloud |
| **Pey CoDi** | Emite el QR y reporta si el cobro quedó pagado |

Piezas relevantes del código:

- `src/client/` — interfaz (home, auth, producto, diálogo CoDi)
- `src/server/app.ts` — rutas HTTP del flujo
- `src/server/pey.ts` — creación de QR, consulta de estado, verificación de webhook
- `src/server/db.ts` — esquema SQLite y datos seed
- `src/server/index.ts` — sirve UI + API en el mismo puerto

---

## Arranque local

Requisitos: **Node.js ≥ 22.5** (usa `node:sqlite` nativo).

```bash
git clone https://github.com/AnuarBarrera/tianko-demo.git
cd tianko-demo
npm install
# Configura el entorno local (hay un archivo de ejemplo en la raíz del repo)
npm run dev
```

Abre [http://localhost:1234](http://localhost:1234).

1. **Entrar o registrarme** → cuenta demo **Ana López** (comprador)
2. **Comprar y pagar con CoDi**
3. Escanea el QR ($0.01 MXN) y espera la confirmación

Para que Pey pueda notificar pagos a tu máquina, expón públicamente:

`POST /api/public/pey-webhook`

(mismo host/puerto de la app; por ejemplo vía túnel hacia `1234`).

---

## Stack

- React 19 + Vite
- Hono (API)
- SQLite (`node:sqlite`)
- Pey CoDi (QR y confirmación)
- TypeScript

---

## Visión a futuro

Esta demo es el ancla. El producto completo Tianko suma portal de tianguis, puestos, inventario, jornadas, mensajería y roles — pero **sin un cobro confiable no hay producto**. Aquí está esa prueba.

Si te late el problema del comercio popular + pagos digitales en México, este repo es el lugar para ver (y romper) el flujo que más importa.
