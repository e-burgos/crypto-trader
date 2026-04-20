# Crypto Trader — Constitución del Proyecto

**Versión:** 1.0  
**Fecha:** 2026-04-12  
**Estado:** Documento vivo — actualizar ante cambios arquitecturales significativos

---

## 1. Propósito y Visión

**Crypto Trader** es una plataforma fullstack de trading autónomo de criptomonedas. Un agente de inteligencia artificial híbrida (indicadores técnicos + razonamiento LLM) opera en nombre del usuario para comprar y vender BTC/ETH contra USDT/USDC en Binance.

**Principios fundacionales:**

1. **Autonomía** — el agente opera sin intervención manual una vez configurado.
2. **Inteligencia híbrida** — análisis técnico clásico + LLM multi-proveedor (Claude, OpenAI, Groq).
3. **Multi-usuario aislado** — cada usuario gestiona sus propias claves, configuraciones y fondos independientes.
4. **Seguro por defecto** — modo Sandbox obligatorio hasta que el usuario elija explícitamente modo Live.
5. **Transparencia total** — cada decisión del agente queda registrada con razonamiento, indicadores y contexto de noticias.
6. **Adaptable** — el agente aprende intervalos óptimos de análisis basados en experiencia acumulada.

---

## 2. Estructura del Monorepo

```
crypto-trader/                    ← raíz del workspace NX
├── apps/
│   ├── api/                      ← Backend NestJS (Railway)
│   └── web/                      ← Frontend React 19 (GitHub Pages)
├── libs/
│   ├── analysis/                 ← Indicadores técnicos + integración LLM
│   ├── data-fetcher/             ← Binance OHLCV, noticias, RSS
│   ├── trading-engine/           ← Lógica de órdenes y posiciones
│   ├── shared/                   ← Types, DTOs, constantes, utils
│   └── ui/                       ← Design system React (52 componentes stateless)
├── docs/
│   ├── CONSTITUTION.md           ← Este archivo
│   ├── specs/                    ← Specs por rama (01–27+)
│   └── plans/                    ← Planes de implementación
├── e2e/                          ← Tests Playwright cross-app
├── docker-compose.yml            ← Infra local (postgres, redis)
├── nx.json
├── package.json                  ← Workspace raíz (pnpm)
└── pnpm-workspace.yaml
```

### Reglas de dependencias entre libs

```
web  →  shared, ui, analysis (tipos)
api  →  shared, analysis, data-fetcher, trading-engine
analysis   →  shared, data-fetcher
trading-engine  →  shared, analysis, data-fetcher
data-fetcher  →  shared
ui  →  shared
```

> **Nunca** importar `apps/api` desde `apps/web` directamente — toda comunicación va por HTTP/WebSocket.

---

## 3. Stack Tecnológico

### 3.1 Gestor de paquetes y build

| Herramienta    | Versión | Rol                                     |
| -------------- | ------- | --------------------------------------- |
| **pnpm**       | 9.x     | Package manager del workspace           |
| **NX**         | 22.x    | Monorepo orchestration, cache, affected |
| **TypeScript** | 6.x     | Lenguaje base en todos los packages     |
| **Node.js**    | ≥20     | Runtime requerido                       |

### 3.2 Backend (`apps/api`)

| Tecnología          | Versión | Rol                                                     |
| ------------------- | ------- | ------------------------------------------------------- |
| **NestJS**          | 11.x    | Framework HTTP + DI + módulos                           |
| **Prisma ORM**      | 7.x     | Acceso a base de datos + migraciones                    |
| **PostgreSQL**      | 16      | Base de datos principal (Railway en prod)               |
| **Redis**           | 7       | Cache de noticias, estado del agente, pub/sub WebSocket |
| **Bull**            | 4.x     | Colas de trabajos: análisis, órdenes, noticias          |
| **Socket.io**       | 4.x     | Gateway WebSocket para actualizaciones en tiempo real   |
| **Passport + JWT**  | —       | Autenticación (access token 15min + refresh token)      |
| **bcrypt**          | 6.x     | Hash de contraseñas                                     |
| **class-validator** | 0.15.x  | Validación de DTOs                                      |
| **Webpack**         | —       | Build de producción del API (NX target)                 |

**Bundler runtime API:** `@swc-node/register` para desarrollo, Webpack para producción.

### 3.3 Frontend (`apps/web`)

| Tecnología             | Versión | Rol                                                      |
| ---------------------- | ------- | -------------------------------------------------------- |
| **React**              | 19.x    | UI framework                                             |
| **Vite**               | 8.x     | Dev server + build tool                                  |
| **React Router DOM**   | 6.x     | Routing SPA                                              |
| **TanStack Query**     | 5.x     | Server state, caché de peticiones                        |
| **Zustand**            | 5.x     | Client state global (auth, market, sidebar, theme, chat) |
| **React Hook Form**    | 7.x     | Manejo de formularios                                    |
| **Zod**                | 4.x     | Validación de esquemas (forms + API responses)           |
| **Tailwind CSS**       | 3.x     | Utility-first CSS                                        |
| **GSAP**               | 3.x     | Animaciones (landing, counters, transiciones)            |
| **Socket.io-client**   | 4.x     | Conexión WebSocket al API                                |
| **lightweight-charts** | 5.x     | Gráfico de velas (TradingView-style)                     |
| **Recharts**           | 3.x     | Gráficos de analytics (línea, área, barras)              |
| **react-i18next**      | 17.x    | Internacionalización (ES + EN, ~1400 claves)             |
| **Lucide React**       | 1.x     | Librería de iconos                                       |
| **Sonner**             | 2.x     | Toast notifications                                      |
| **axios**              | 1.x     | Cliente HTTP                                             |
| **react-markdown**     | 10.x    | Render de markdown (chat, decisiones)                    |

### 3.4 Proveedores LLM (multi-proveedor, por usuario)

| Proveedor              | SDK                 | Modelos soportados                  |
| ---------------------- | ------------------- | ----------------------------------- |
| **OpenRouter** ⭐       | HTTP (OpenAI-compat) | 200+ modelos de todos los providers |
| **Anthropic (Claude)** | `@anthropic-ai/sdk` | claude-sonnet-4-6, claude-haiku-4-5 |
| **OpenAI**             | `openai`            | gpt-4o, gpt-4o-mini                 |
| **Groq**               | `groq-sdk`          | llama-3.3-70b, mixtral-8x7b         |
| **Google (Gemini)**    | `@google/generative-ai` | gemini-2.5-flash, gemini-2.5-pro |
| **Mistral**            | `@mistralai/mistralai` | mistral-large, mistral-small      |
| **Together**           | HTTP (OpenAI-compat) | llama, mixtral, qwen               |

> **OpenRouter** es el proveedor **primario recomendado**: una sola API key da acceso a todos los modelos con fallback automático y billing unificado. Los proveedores directos siguen soportados como alternativa.

> Las claves API son **por usuario**, almacenadas cifradas en DB. Nunca como variable de entorno global.

### 3.5 Fuentes de datos de mercado

| Fuente                                     | Tipo              | Dato                           |
| ------------------------------------------ | ----------------- | ------------------------------ |
| **Binance REST API**                       | Polling           | OHLCV velas, balance, órdenes  |
| **Binance WebSocket**                      | Streaming         | Precio en tiempo real (ticker) |
| **CryptoPanic**                            | API libre         | Noticias con sentimiento       |
| **NewsData.io**                            | API (por usuario) | Noticias crypto                |
| **RSS (CoinDesk, Cointelegraph, Decrypt)** | Polling           | Headlines, `rss-parser`        |

### 3.6 Testing

| Herramienta    | Scope                     | Runner                |
| -------------- | ------------------------- | --------------------- |
| **Vitest**     | Frontend (libs + web)     | `pnpm nx test web`    |
| **Jest**       | Backend (api + libs node) | `pnpm nx test api`    |
| **Playwright** | E2E cross-app             | `pnpm nx e2e web-e2e` |
| **Supertest**  | Integration API           | `pnpm nx e2e api-e2e` |

### 3.7 Infra y despliegue

| Entorno       | Servicio                    | Método                                          |
| ------------- | --------------------------- | ----------------------------------------------- |
| Frontend prod | **GitHub Pages**            | GitHub Actions → `nx build web` → static deploy |
| Backend prod  | **Railway**                 | Dockerfile en `apps/api/Dockerfile`             |
| DB prod       | **Railway** (PostgreSQL 16) | `prisma migrate deploy` en CI                   |
| Cache prod    | **Railway** (Redis 7)       | Compartido con API                              |
| Local dev     | **Docker Compose**          | `docker compose up -d postgres redis`           |
| CI/CD         | **GitHub Actions**          | Lint → test → build → deploy on merge to main   |

---

## 4. Arquitectura del Backend

### 4.1 Módulos NestJS

```
api/src/
├── auth/               AuthModule       — JWT, refresh tokens, bcrypt
├── users/              UsersModule      — CRUD, Binance keys (AES-256), LLM keys
├── trading/            TradingModule    — Ciclo de vida agente, órdenes, posiciones
├── analysis/           AnalysisModule   — LLM, indicadores, noticias
├── market/             MarketModule     — OHLCV, Market snapshot, noticias caché
├── notifications/      NotificationsModule — Centro de notificaciones + WebSocket
├── analytics/          AnalyticsModule  — P&L, win rate, decisiones
├── admin/              AdminModule      — Kill-switch global, gestión de usuarios
└── chat/               ChatModule       — Chat IA con historial de sesión
```

### 4.2 Pipeline del agente (por TradingConfig activo)

```
1. Bull Queue: análisis job programado cada N minutos (adaptativo)
2. data-fetcher: Fetch OHLCV velas de Binance
3. analysis: Calcular indicadores (RSI, MACD, BB, EMA, Volumen, S&R)
4. data-fetcher: Noticias recientes (CryptoPanic / RSS)
5. analysis: LLM call → { decision, confidence, reasoning, waitMinutes }
6. trading-engine: Si confidence ≥ threshold → ejecutar orden en Binance
7. DB: Guardar AgentDecision + Trade + actualizar Position
8. WebSocket: Emitir eventos al frontend (trade:executed, agent:decision)
9. Bull: Reprogramar siguiente job según waitMinutes
```

### 4.3 Seguridad

- Claves Binance: cifrado **AES-256-GCM**, clave maestra en variable de entorno (`BINANCE_KEY_ENCRYPTION_KEY`).
- Claves LLM/NewsAPI: mismo esquema AES-256-GCM por usuario.
- JWT access token: vida útil 15 minutos + refresh token rotation.
- Rate limiting: NestJS Throttler en todos los endpoints.
- CORS: restringido a orígenes conocidos (GitHub Pages).
- Modo Sandbox: imposibilidad de ejecutar órdenes reales enforced **server-side**.
- Modo Testnet: usa endpoint Binance Testnet (órdenes reales en red de prueba).

### 4.4 WebSocket events

| Evento             | Dirección       | Descripción                 |
| ------------------ | --------------- | --------------------------- |
| `trade:executed`   | server → client | Nueva orden ejecutada       |
| `position:updated` | server → client | P&L de posición actualizado |
| `agent:decision`   | server → client | Nueva decisión del agente   |
| `price:tick`       | server → client | Precio en tiempo real       |
| `notification:new` | server → client | Nueva notificación in-app   |

---

## 5. Arquitectura del Frontend

### 5.1 Estructura de páginas

```
web/src/
├── pages/
│   ├── landing/         LandingPage       — Pública, GSAP animations
│   ├── auth/            LoginPage, RegisterPage
│   ├── onboarding/      OnboardingWizard  — 3 pasos: Binance → LLM → Start
│   └── dashboard/
│       ├── overview/    PortfolioOverview — P&L, posiciones activas
│       ├── chart/       TradingChart      — Velas + indicadores
│       ├── positions/   PositionsPage     — OPEN/CLOSED, P&L tiempo real
│       ├── bot-analysis/ BotAnalysisPage  — Snapshot mercado, decisiones, noticias
│       ├── news/        NewsFeedPage      — Feed de noticias con sentimiento
│       ├── config/      ConfigPage        — Multi-config, thresholds, modo
│       ├── settings/    SettingsPage      — AI (3 sub-tabs: Primary/Providers/Analytics), Binance, NewsAPI, perfil
│       ├── notifications/ NotificationsPage — Centro de notificaciones
│       ├── analytics/   AnalyticsPage     — Métricas de rendimiento
│       ├── help/        HelpPage          — Documentación y guías
│       └── admin/       AdminPage         — Solo ADMIN: kill-switch, usuarios
├── components/           Solo protected-route.tsx (guardia de rutas)
├── containers/           Componentes con hooks/stores/i18n (container pattern)
│   ├── chat/            Chat widget, messages, session panel
│   ├── settings/        Dynamic model select, AI usage, news config, provider status
│   └── *.tsx            Navbar, sidebar, price ticker, dropdowns, mode selector
├── hooks/
│   ├── use-auth.ts
│   ├── use-trading.ts
│   ├── use-market.ts
│   ├── use-notifications.ts
│   ├── use-analytics.ts
│   ├── use-user.ts
│   ├── use-binance-ticker.ts
│   └── use-chat.ts
├── stores/               Zustand stores (auth, market, sidebar, theme, chat)
├── locales/              es.ts / en.ts — ~1400 claves i18n c/u
├── lib/                  utils, api client (axios), constants
└── router/               React Router config, rutas protegidas
```

### 5.2 Design System (`libs/ui` — `@crypto-trader/ui`)

Todos los componentes de UI stateless viven en `libs/ui`. Las apps consumen vía `@crypto-trader/ui`.

| Categoría         | Componentes                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Primitives**    | Button, Input, Badge, InfoTooltip, Typography, Spinner, ProgressBar, CopyButton, FormField, Separator, ToggleSwitch, Avatar                     |
| **Composites**    | Select, Dialog, Card, DataTable, Tabs, Pagination, FilterPills, SliderField, Stepper, Collapsible, KeyValueRow, SectionTitle, Dropdown, Sidebar |
| **Feedback**      | EmptyState, LoadingSkeleton, Callout                                                                                                            |
| **Layout**        | PageLayout, Navbar, DashboardHeader                                                                                                             |
| **Theme**         | ThemeProvider                                                                                                                                   |
| **Charts**        | ChartCard, ChartTooltip, ChartTheme (constantes)                                                                                                |
| **Domain/Market** | StatCard, PriceTicker, IndicatorInfoModal                                                                                                       |
| **Domain/Agent**  | DecisionFlowDiagram, ExplainPanel, ParameterCards, StrategyPresets                                                                              |
| **Domain/Chat**   | AgentHeader, AgentSelector, CapabilityButtons, ChatInput, OrchestratingIndicator, ToolCallCard                                                  |
| **Domain/Help**   | HelpSidebar                                                                                                                                     |

**Reglas de libs/ui:**

1. **Sin hooks de datos** — ningún componente importa `useQuery`, `useMutation`, Zustand, React Router, o `useTranslation`. Toda data llega por props.
2. **i18n por prop `t`** — los componentes que renderizan texto reciben `t: (key: string, opts?: Record<string, unknown>) => string`.
3. **1 concepto = 1 archivo** — no duplicar componentes; consolidar variantes.
4. **Dependencias mínimas** — solo React, clsx, tailwind-merge, lucide-react, @radix-ui/\*, gsap (peerDeps).

**Patrón Container/Presenter:**

- `libs/ui/` = presenters (stateless, props-only)
- `apps/web/src/containers/` = containers (hooks, stores, i18n, pasan data a presenters)

### 5.3 Gestión de estado

| Tipo de estado    | Herramienta           | Cuándo usarla                                                                    |
| ----------------- | --------------------- | -------------------------------------------------------------------------------- |
| **Server state**  | TanStack Query        | Datos del API (posiciones, decisiones, noticias, config)                         |
| **Global client** | Zustand               | Auth session, tema, sidebar collapsed, estado de chat, símbolo activo de mercado |
| **Form state**    | React Hook Form       | Formularios validados con Zod                                                    |
| **Local**         | `useState` / `useRef` | Estado de UI temporal (modales, tabs, expanded)                                  |

### 5.4 Internacionalización

- **Idiomas soportados:** Español (ES — por defecto) e Inglés (EN).
- **Librería:** `react-i18next` + `i18next`.
- **Archivos:** `apps/web/src/locales/es.ts` y `en.ts` (~1400 claves cada uno).
- **Persistencia:** `localStorage` (`i18n_lang`).
- **Convención de claves:** `seccion.componente.elemento` — ej. `notifications.markRead`.
- **Regla:** Todo texto visible al usuario debe pasar por `t('clave')`. Nunca hardcodear texto en los componentes.

### 5.5 Principios de animación

- **GSAP** para: página landing (scroll-triggered), contadores animados (CountUp), transiciones de página.
- **CSS Transitions / Tailwind** para: micro-interacciones de hover, estados de focus, dropdowns.
- Principios de Emil Kowalski: animaciones propositivas, rápidas (≤300ms), que no bloqueen la interacción.
- `prefers-reduced-motion` debe respetarse.

---

## 6. Modelos de Datos (Prisma Schema)

### Modelos principales

| Modelo                        | Descripción                                               |
| ----------------------------- | --------------------------------------------------------- |
| `User`                        | Cuenta de usuario (TRADER o ADMIN)                        |
| `BinanceCredential`           | Claves API Binance cifradas (prod + testnet)              |
| `LLMCredential`               | Claves API por proveedor LLM (OPENROUTER, CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL, TOGETHER) + fallbackModels |
| `NewsApiCredential`           | Claves API noticias por proveedor (CRYPTOPANIC, NEWSDATA) |
| `TradingConfig`               | Configuración de trading por asset/pair/modo              |
| `Position`                    | Posición abierta o cerrada con P&L                        |
| `Trade`                       | Orden BUY/SELL ejecutada (vinculada a Position)           |
| `AgentDecision`               | Decisión del agente con indicadores + news + reasoning    |
| `NewsItem`                    | Noticia caché con sentimiento                             |
| `Notification`                | Notificación in-app por usuario                           |
| `ChatSession` / `ChatMessage` | Historial del chat con el asistente IA                    |
| `SandboxWallet`               | Wallet virtual para modo Sandbox                          |
| `NewsConfig`                  | Config de noticias por usuario (botEnabled, newsWeight)   |
| `NewsAnalysis`                | Análisis de noticias generado por LLM                     |
| `AdminAction`                 | Log de acciones administrativas                           |

### Modos de trading (enum `TradingMode`)

| Modo      | Descripción                                        |
| --------- | -------------------------------------------------- |
| `SANDBOX` | Paper trading con wallet virtual, precios reales   |
| `TESTNET` | Órdenes reales en Binance Testnet (red de pruebas) |
| `LIVE`    | Órdenes reales en Binance Producción               |

---

## 7. Convenciones de Código

### 7.1 General

- **TypeScript estricto** en todos los packages (`strict: true`).
- **ESLint + Prettier** — ejecutar `pnpm lint:fix` antes de cada commit.
- Importaciones absolutas vía path aliases de `tsconfig.base.json` (ej. `@crypto-trader/shared`).
- Nunca importar directamente entre `apps/` — solo a través de `libs/`.

### 7.2 Backend (NestJS)

- Un módulo por dominio. Cada módulo expone su propio `Service`, `Controller`, y `Module`.
- DTOs validados con `class-validator` + `class-transformer`.
- Servicios: lógica de negocio. Controladores: solo reciben, delegan y responden.
- Errores: lanzar `HttpException` de NestJS, nunca responder errores manualmente.
- Migraciones: siempre via `prisma migrate dev` (dev) o `prisma migrate deploy` (prod).

### 7.3 Frontend (React)

- Componentes funcionales con hooks. Sin class components.
- Un hook personalizado por dominio en `hooks/` (ej. `use-trading.ts` agrupa todo lo relacionado a trading).
- TanStack Query para todo dato del servidor — no usar `useState` + `useEffect` para fetching.
- Zustand solo para estado que cruza múltiples componentes no relacionados.
- Tailwind para estilos — sin CSS modules ni styled-components.
- Todo texto visible: `t('clave')` de i18n — nunca hardcodeado.

### 7.4 Commits

Seguir Conventional Commits:

```
feat(scope): descripción
fix(scope): descripción
chore(scope): descripción
docs(scope): descripción
test(scope): descripción
refactor(scope): descripción
```

---

## 8. Comandos Esenciales

```bash
# Desarrollo local
pnpm docker:infra          # Levanta postgres + redis
pnpm dev:api               # NestJS en localhost:3000
pnpm dev:web               # Vite en localhost:4200

# Build
pnpm build:api             # Build producción API
pnpm build:web             # Build producción Web

# Tests
pnpm test:api              # Jest (backend)
pnpm test:web              # Vitest (frontend)
pnpm test:e2e              # Playwright E2E

# Base de datos
pnpm db:migrate            # Crear migración (dev)
pnpm db:migrate:deploy     # Aplicar migraciones (prod)
pnpm db:studio             # Prisma Studio visual

# CI/CD local
pnpm lint                  # Lint todos los packages
pnpm typecheck             # TypeScript check todos los packages
pnpm format                # Prettier todos los archivos

# NX
pnpm nx graph              # Ver grafo de dependencias
pnpm nx affected --target=test   # Solo testear lo afectado por cambios
```

---

## 9. Variables de Entorno

### Backend (`.env`)

| Variable                     | Descripción                                |
| ---------------------------- | ------------------------------------------ |
| `DATABASE_URL`               | PostgreSQL connection string               |
| `REDIS_URL`                  | Redis connection string                    |
| `JWT_SECRET`                 | Secret para access tokens                  |
| `JWT_REFRESH_SECRET`         | Secret para refresh tokens                 |
| `BINANCE_KEY_ENCRYPTION_KEY` | Clave maestra AES-256 para cifrar API keys |
| `CRYPTOPANIC_API_KEY`        | CryptoPanic free tier (noticias globales)  |
| `NODE_ENV`                   | `development` \| `production`              |
| `PORT`                       | Puerto del servidor (default 3000)         |

> Las claves de LLM (Claude, OpenAI, Groq) y NewsAPI van por usuario en DB — **no son variables de entorno**.

### Frontend (`.env`)

| Variable       | Descripción                                          |
| -------------- | ---------------------------------------------------- |
| `VITE_API_URL` | URL base del backend (ej. `https://api.railway.app`) |
| `VITE_WS_URL`  | URL WebSocket del backend                            |

---

## 10. Scope del Proyecto (Phase 1)

### En scope

- Trading de BTC/ETH contra USDT/USDC en Binance
- Modos: Sandbox (paper) + Testnet + Live
- Multi-usuario con aislamiento completo
- Agente IA híbrido (indicadores + LLM multi-proveedor)
- Dashboard con gráficos, posiciones, análisis y historial
- Notificaciones in-app
- Chat con asistente IA
- Landing page pública
- Onboarding wizard de 3 pasos
- Soporte i18n ES/EN

### Fuera de scope (Phase 2+)

- MetaMask / DEX / trading on-chain
- Futuros, margen o apalancamiento
- Assets más allá de BTC/ETH
- App móvil
- Notificaciones push / email
- Backtesting engine
- Copy trading / social trading
- Estrategias de opciones

---

## 11. Decisiones Arquitecturales Clave

| #   | Decisión                         | Razón                                                                    |
| --- | -------------------------------- | ------------------------------------------------------------------------ |
| 1   | Monorepo NX                      | Compartir tipos y lógica entre web/api sin duplicación                   |
| 2   | pnpm workspaces                  | Performance y correctness en resolución de dependencias                  |
| 3   | NestJS para API                  | DI robusto, módulos, decoradores — ideal para arquitectura multi-dominio |
| 4   | Prisma ORM                       | Type-safety end-to-end, migraciones declarativas                         |
| 5   | Bull + Redis para colas          | Garantía de entrega de trabajos de análisis; reintentos automáticos      |
| 6   | AES-256-GCM para claves          | Estándar de la industria; clave maestra separada de los datos            |
| 7   | LLM por usuario (no global)      | Costos atribuibles al usuario; flexibilidad de proveedor                 |
| 8   | GitHub Pages para web            | Cero costo; build estático compatible con React Router                   |
| 9   | Railway para API                 | Deploy desde Dockerfile; PostgreSQL + Redis incluidos                    |
| 10  | Sandbox server-side enforced     | Nunca confiar en el cliente para prevenir órdenes reales                 |
| 11  | TanStack Query para server state | Caché, refetch, stale-time — evita useEffect para fetching               |
| 12  | i18n desde el inicio             | Evitar deuda de localización; arquitectura bilingüe nativa               |
| 13  | OpenRouter como provider recomendado | Una API key → 200+ modelos, fallback automático, billing unificado; reduce fricción de onboarding |

---

_Este documento es la fuente de verdad sobre la arquitectura y convenciones del proyecto. Ante cualquier discrepancia entre el código y este documento, prevalece el código — y este documento debe actualizarse._
