# spec-e-burgos-008 cycle-02 — 2026-09-01

## Estado

**La SPA se sirve desde el VPS**, no desde Cloudflare Pages (spec §7, DEC-PAGES). Vive en `/` y la
API en `/api` del **mismo origen**, detrás del mismo nginx.

Eso no es una comodidad de despliegue: **elimina CORS por completo**, deja un solo certificado que
renovar y hace que el WebSocket sea same-origin — una cosa menos que pueda fallar.

## Estructura

### `src/hooks/use-websocket.ts` — el hallazgo E era peor de lo documentado

`VITE_API_URL` se usaba con **dos significados contradictorios**:

| Archivo | Espera |
| --- | --- |
| `lib/api.ts`, `use-chat.ts` | **con** el prefijo `/api` |
| `use-websocket.ts` | **sin** él |

Con un único valor el cliente negociaba el namespace `/api/ws`, que el gateway no sirve, y **el
socket conectaba y fallaba en silencio** — la peor forma de fallar.

El hook ahora deriva el origen quitando el sufijo `/api` de la base REST, con `VITE_WS_URL` como
escape por si el gateway alguna vez vive en otro origen. Seis tests cubren la resolución, incluido
que un `/api` que **no** es el último segmento no se toca.

> El gateway está en el namespace `/ws` con path `/socket.io/`. Nginx rutea `/socket.io/` a la API
> **antes** que `/`, y sin `proxy_set_header Upgrade`/`Connection` el handshake entra por el location
> genérico y muere.

### `Dockerfile` — estaba roto de antes

Hacía `COPY apps/web/package.json`, archivo que **no existe** en este monorepo: las dependencias
viven en la raíz, como el Dockerfile de `apps/api` ya documentaba. **Ningún workflow construía esta
imagen**, por eso nunca se detectó. La imagen se construye con `VITE_API_URL=/api` — relativo, para
que el mismo origen funcione sin hardcodear el host.

## Dependencias

Ninguna nueva. Cloudflare Pages **queda fuera del stack**.

## Qué sigue

- **El panel de trader se recorrió entero** (Overview, Market, Positions, Trade History, Agent Log,
  News, Exchange, Manage Agents) sin errores de consola, con datos reales de Binance. Lo que **no**
  se ejercitó es el camino con posiciones abiertas y trades: la base arrancó vacía.
- El fallback de rutas es del nginx del contenedor (`try_files → index.html`), así que **una ruta
  inexistente renderiza la landing** en vez de un 404 propio. Es aceptable para una SPA, pero no es
  una decisión tomada: es lo que quedó.
- La UI todavía no consume `StreamHealthState`: el estado del stream es observable por `EP-015` y
  por el evento WS `market:stream-health`, sin pantalla que lo muestre.
