# Stack Tecnológico — crypto-trader

## Monorepo & Build System

| Tecnología     | Versión | Uso                                                        |
| -------------- | ------- | ---------------------------------------------------------- |
| **Nx**         | 22.7.0  | Orquestador de monorepo, cacheo de tasks, dependency graph |
| **pnpm**       | 9.x     | Package manager con workspaces (`apps/*`, `libs/*`)        |
| **TypeScript** | 6.x     | Tipado en todo el proyecto (target ES2020)                 |
| **SWC**        | 1.15.x  | Compilador rápido para transpilación (reemplaza ts-loader) |

## Backend (`apps/api/`)

| Tecnología                              | Versión       | Uso                                                                                     |
| --------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| **NestJS**                              | 11            | Framework backend (módulos, controllers, services, guards, decorators)                  |
| **Prisma**                              | 7             | ORM con migraciones, schema declarativo, Prisma Studio                                  |
| **PostgreSQL**                          | 16 (pgvector) | Base de datos principal con soporte para embeddings vectoriales                         |
| **Redis**                               | 7             | Cache, colas de trabajo (Bull), pub/sub                                                 |
| **Bull**                                | 4.x           | Job queues (procesamiento asíncrono de trading)                                         |
| **Passport + JWT**                      | —             | Autenticación con guards de NestJS                                                      |
| **Socket.io**                           | 4.x           | WebSockets para notificaciones en tiempo real (`@nestjs/websockets`)                    |
| **Swagger**                             | —             | Documentación de API auto-generada (`@nestjs/swagger` + `@scalar/nestjs-api-reference`) |
| **Webpack**                             | 5.x           | Bundler del backend                                                                     |
| **class-validator + class-transformer** | —             | Validación de DTOs                                                                      |
| **Zod**                                 | 4.x           | Validación de schemas en runtime                                                        |

## Frontend (`apps/web/`)

| Tecnología                  | Versión | Uso                                                                  |
| --------------------------- | ------- | -------------------------------------------------------------------- |
| **React**                   | 19      | Framework UI                                                         |
| **Vite**                    | 8       | Dev server + bundler del frontend                                    |
| **React Router**            | 6       | Routing SPA                                                          |
| **TanStack Query**          | 5       | Fetching, cache y sincronización de datos del servidor               |
| **Zustand**                 | 5       | State management global (client-side)                                |
| **Tailwind CSS**            | 3       | Utility-first styling                                                |
| **Radix UI**                | —       | Primitivas accesibles (Dialog, Dropdown, Tabs, Tooltip, Collapsible) |
| **Lucide React**            | —       | Iconos                                                               |
| **GSAP**                    | 3       | Animaciones (`@gsap/react`)                                          |
| **react-i18next + i18next** | —       | Internacionalización (español/inglés)                                |
| **react-hook-form**         | 7       | Formularios                                                          |
| **Socket.io-client**        | 4.x     | WebSockets client                                                    |
| **Lightweight Charts**      | 5       | Gráficos de trading (TradingView)                                    |
| **Recharts**                | 3       | Gráficos/dashboards                                                  |
| **react-markdown**          | —       | Renderizado de Markdown (+ rehype-highlight, remark-gfm)             |
| **Sonner**                  | 2       | Toast notifications                                                  |
| **clsx + tailwind-merge**   | —       | Composición de clases CSS                                            |

## AI / LLM

| Tecnología                              | Uso                             |
| --------------------------------------- | ------------------------------- |
| **Anthropic SDK** (`@anthropic-ai/sdk`) | Claude como agente de trading   |
| **OpenAI SDK**                          | GPT como proveedor alternativo  |
| **Groq SDK**                            | Modelos rápidos (Llama/Mixtral) |
| **OpenRouter SDK** (`@openrouter/sdk`)  | Router multi-modelo             |
| **VoyageAI**                            | Embeddings para RAG             |

## Librerías compartidas (`libs/`)

| Lib              | Package                         | Contenido                               |
| ---------------- | ------------------------------- | --------------------------------------- |
| `shared`         | `@crypto-trader/shared`         | Tipos, interfaces, DTOs compartidos     |
| `ui`             | `@crypto-trader/ui`             | Componentes React reutilizables         |
| `analysis`       | `@crypto-trader/analysis`       | Lógica de análisis técnico              |
| `trading-engine` | `@crypto-trader/trading-engine` | Motor de trading                        |
| `data-fetcher`   | `@crypto-trader/data-fetcher`   | Fetching de datos de mercado            |
| `openrouter`     | `@crypto-trader/openrouter`     | Integración OpenRouter                  |
| `providers`      | `@crypto-trader/providers`      | Providers de datos externos (8 fuentes) |

Los path aliases se resuelven vía `tsconfig.base.json` con el patrón `@crypto-trader/<nombre>`.

## Testing

| Nivel                | Herramienta                                            | Ubicación                                              |
| -------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Unit backend         | **Jest** (con `ts-jest` + `@swc-node/register`)        | `apps/api/src/**/*.spec.ts`                            |
| Unit frontend + libs | **Vitest 4** (con jsdom)                               | `apps/web/src/**/*.spec.ts`, `libs/*/src/**/*.spec.ts` |
| E2E web              | **Playwright** (browser tests, page objects, fixtures) | `e2e/*.spec.ts`                                        |
| E2E API              | **Jest**                                               | `apps/api-e2e/src/**/*.spec.ts`                        |
| Coverage             | `@vitest/coverage-v8`                                  | —                                                      |

## Infraestructura & DevOps

| Tecnología                   | Uso                                                             |
| ---------------------------- | --------------------------------------------------------------- |
| **Docker Compose**           | PostgreSQL (pgvector:pg16), Redis 7, API container, Web (nginx) |
| **Railway** (`railway.toml`) | Deployment a producción                                         |
| **Nginx**                    | Serving del frontend en producción                              |
| **ESLint 9** + **Prettier**  | Linting y formatting                                            |

## Comandos principales

```bash
# Desarrollo
pnpm dev                  # Levanta infra (Docker) + API + Web
pnpm nx serve api         # Solo backend (HMR)
pnpm nx serve web         # Solo frontend (HMR)

# Testing
pnpm nx test <proyecto>   # Tests de un proyecto específico
pnpm nx run-many --target=test --all  # Tests de todo
pnpm nx e2e web-e2e       # E2E del frontend
pnpm nx e2e api-e2e       # E2E del API

# Base de datos
pnpm db:migrate           # Ejecutar migraciones Prisma
pnpm db:seed              # Seed de datos iniciales
pnpm db:studio            # Prisma Studio (GUI)
pnpm db:reset             # Reset completo (down -v + up)

# Build & CI
pnpm nx build api         # Build del backend
pnpm nx build web         # Build del frontend
pnpm nx run-many --target=build --all  # Build de todo
pnpm nx affected --target=test   # Solo tests afectados por cambios

# Calidad
pnpm nx run-many --target=lint --all   # Lint de todo
pnpm format               # Prettier en todo el proyecto
```

## Estructura del monorepo

```
crypto-trader/
├── apps/
│   ├── api/              # NestJS backend
│   │   ├── prisma/       # Schema + migraciones
│   │   └── src/          # Módulos NestJS
│   ├── api-e2e/          # Tests E2E del API
│   ├── web/              # React frontend
│   │   └── src/          # Páginas, componentes, hooks
│   └── web-e2e/          # Config Playwright (web)
├── libs/
│   ├── shared/           # Tipos compartidos
│   ├── ui/               # Componentes UI reutilizables
│   ├── analysis/         # Análisis técnico
│   ├── trading-engine/   # Motor de trading
│   ├── data-fetcher/     # Fetching de datos
│   ├── openrouter/       # Integración OpenRouter
│   └── providers/        # Providers de datos externos
├── e2e/                  # Specs E2E globales (Playwright)
├── docs/                 # Specs, plans, constitución
├── docker-compose.yml
├── nx.json
├── tsconfig.base.json
└── package.json
```
