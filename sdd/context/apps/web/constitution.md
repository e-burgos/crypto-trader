# Constitución — apps/web

> Versión 1.0 | Última actualización: cycle-0 (inicial)

## 1. Propósito

- **Tipo:** app
- **Rol en el sistema:** Frontend SPA de la plataforma: landing pública, auth, onboarding de 3 pasos y dashboard completo (overview, chart, posiciones, análisis del bot, noticias, config, settings, notificaciones, analytics, help, admin).

## 2. Stack tecnológico

- **React 19** + **Vite 8**, **React Router DOM 6**, **TanStack Query 5** (server state), **Zustand 5** (auth/market/sidebar/theme/chat), **React Hook Form 7** + **Zod 4**, **Tailwind CSS 3**, **GSAP 3**, **Socket.io-client**, **lightweight-charts**, **Recharts**, **react-i18next** (ES/EN ~1400 claves), **axios**, **Sonner**.
- Deploy: GitHub Pages (build estático vía GitHub Actions).

## 3. Estructura y patrones

- Patrón Container/Presenter: `libs/ui` = presenters stateless; `apps/web/src/containers/` = containers con hooks/stores/i18n.
- `src/pages/` por ruta, `src/hooks/` un hook por dominio (use-auth, use-trading, use-market, ...), `src/stores/` Zustand, `src/locales/es.ts|en.ts`.
- Consume el API solo por HTTP/WebSocket — nunca importa `apps/api`.

## 4. Convenciones propias

- Todo dato del servidor vía TanStack Query (no useState+useEffect). Zustand solo para estado global cross-componente.
- Todo texto visible pasa por `t('clave')` — convención `seccion.componente.elemento`. Nunca hardcodear texto.
- Tailwind para estilos (sin CSS modules/styled-components). Animaciones ≤300ms, respetar `prefers-reduced-motion`.
- Correr: `pnpm dev:web` (localhost:4200). Tests: `pnpm nx test web` (Vitest).

> Las actualizaciones por ciclo/fix van como fragmentos aditivos en `updates/` —
> este archivo base solo lo modifica la consolidación (ver `sdd/context/context_prompt.md` sección 6).
