# Constitución — apps/web

> Versión 1.2 | Última actualización: cycle-02 | Fecha: 2026-09-01
> Fragmentos consolidados: spec-e-burgos-001 cycle-03 (2026-08-18) + spec-e-burgos-004 cycle-01 (2026-08-19) + spec-e-burgos-008 cycle-02 (2026-09-01)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Frontend SPA de la plataforma: landing pública, auth, onboarding de 3 pasos y dashboard completo (overview, chart, posiciones, análisis del bot, noticias, config, settings, notificaciones, analytics, help, admin).

## 2. Stack tecnológico

- **React 19** + **Vite 8**, **React Router DOM 6**, **TanStack Query 5** (server state), **Zustand 5** (auth/market/sidebar/theme/chat), **React Hook Form 7** + **Zod 4**, **Tailwind CSS 3**, **GSAP 3**, **Socket.io-client**, **lightweight-charts**, **Recharts**, **react-i18next** (ES/EN ~1400 claves), **axios**, **Sonner**.
- **Deploy: la SPA se sirve desde el mismo VPS propio (Hetzner) que `apps/api`** (spec-e-burgos-008 cycle-02), no desde un hosting estático externo (Cloudflare Pages quedó descartado — DEC-PAGES). Vive en `/` y la API en `/api`, **mismo origen, detrás del mismo nginx**: ver §3.1.

## 3. Estructura y patrones

- Patrón Container/Presenter: `libs/ui` = presenters stateless; `apps/web/src/containers/` = containers con hooks/stores/i18n.
- `src/pages/` por ruta, `src/hooks/` un hook por dominio (use-auth, use-trading, use-market, ...), `src/stores/` Zustand, `src/locales/es.ts|en.ts`.
- Consume el API solo por HTTP/WebSocket — nunca importa `apps/api`.
- Tipos del wire del backend (agentes, data sources, etc.) se importan de `@crypto-trader/shared` — **nunca** se redeclaran localmente. Fue una interfaz local del wire de agentes la que dejó pasar sin error de typecheck un renombre del backend (`agentId`→`slot`) hasta romper producción; ver `libs/shared/constitution.md` §3.

### 3.1 Despliegue same-origin con la API (spec-e-burgos-008 cycle-02)

Servir la SPA desde el mismo VPS que `apps/api`, en el mismo origen, **elimina CORS por completo**,
deja un solo certificado TLS que renovar y hace que el WebSocket sea same-origin — una cosa menos
que pueda fallar.

- **`src/hooks/use-websocket.ts` — `VITE_API_URL` se usaba con dos significados contradictorios**:
  `lib/api.ts`/`use-chat.ts` lo esperan **con** el prefijo `/api`; `use-websocket.ts` lo esperaba
  **sin** él. Con un único valor el cliente negociaba el namespace `/api/ws` (que el gateway no
  sirve) y **el socket conectaba y fallaba en silencio** — la peor forma de fallar. El hook ahora
  deriva el origen quitando el sufijo `/api` de la base REST, con `VITE_WS_URL` como escape por si el
  gateway alguna vez vive en otro origen. Seis tests cubren la resolución, incluido que un `/api` que
  **no** es el último segmento no se toca.
  - El gateway está en el namespace `/ws` con path `/socket.io/`. Nginx rutea `/socket.io/` a la API
    **antes** que `/`, y sin `proxy_set_header Upgrade`/`Connection` el handshake entra por el
    location genérico y muere.
- **`Dockerfile` estaba roto de antes**: hacía `COPY apps/web/package.json`, archivo que **no existe**
  en este monorepo — las dependencias viven en la raíz, como el `Dockerfile` de `apps/api` ya
  documentaba. Ningún workflow construía esta imagen, por eso nunca se detectó. La imagen se
  construye con `VITE_API_URL=/api` — relativo, para que el mismo origen funcione sin hardcodear el
  host.
- El fallback de rutas es del nginx del contenedor (`try_files → index.html`): una ruta inexistente
  renderiza la landing en vez de un 404 propio. Aceptable para una SPA, pero es lo que quedó, no una
  decisión tomada.

## 4. Convenciones propias

- Todo dato del servidor vía TanStack Query (no useState+useEffect). Zustand solo para estado global cross-componente.
- Todo texto visible pasa por `t('clave')` — convención `seccion.componente.elemento`. Nunca hardcodear texto.
- Tailwind para estilos (sin CSS modules/styled-components). Animaciones ≤300ms, respetar `prefers-reduced-motion`.
- Correr: `pnpm dev:web` (localhost:4200). Tests: `pnpm nx test web` (Vitest).
- El criterio de done de una pantalla que consume un wire compartido es **test de comportamiento en verde sobre un fixture del wire real**, no solo `tsc` — el typecheck no detecta un desalineamiento si ambos lados comparten los mismos tipos por casualidad de forma, no por importarlos de la misma fuente.
- Un valor de wire fuera del union esperado (ej. `source` en `ResolutionSource`) debe degradar esa fila/elemento a un estado neutro (`unknown`), nunca romper el render de la pantalla entera.

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
