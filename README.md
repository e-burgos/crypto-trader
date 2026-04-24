# Crypto Trader

Plataforma fullstack de **trading autónomo de criptomonedas** impulsada por un agente de IA híbrida. El agente combina análisis técnico clásico (RSI, MACD, Bollinger Bands, EMA, Volumen, S&R) con razonamiento LLM multi-proveedor (OpenRouter, Claude, OpenAI, Groq, Gemini, Mistral, Together) para tomar decisiones de compra/venta de BTC y ETH en Binance.

---

## Características principales

- **Agente autónomo** — opera sin intervención manual; detecta oportunidades de BTC/ETH vs USDT/USDC.
- **IA híbrida** — indicadores técnicos + LLM multi-proveedor (OpenRouter, Claude, OpenAI, Groq, Gemini, Mistral, Together) con claves propias por usuario.
- **OpenRouter como hub** — 200+ modelos con una sola API key, catálogo dinámico con cache 15min.
- **Multi-agente configurable** — cada agente (orchestrator, market, risk, technical, fundamentals, chat) tiene su propio par proveedor/modelo.
- **Toggle admin de proveedores** — el admin puede activar/desactivar proveedores LLM globalmente; los usuarios afectados reciben notificación.
- **Multi-usuario aislado** — cada usuario gestiona su propia cuenta Binance, configuraciones y fondos.
- **Tres modos de operación** — Sandbox (paper trading), Testnet (Binance Testnet) y Live.
- **Seguro por defecto** — sandbox obligatorio al inicio; live requiere activación explícita.
- **Transparencia total** — cada decisión del agente se registra con indicadores, razonamiento, proveedor/modelo y noticias.
- **Dashboard en tiempo real** — gráficos de velas, P&L, posiciones abiertas y log de decisiones via WebSocket.
- **Internacionalización** — interfaz en Español e Inglés (~1400 claves i18n).

---

## Stack

| Capa             | Tecnología                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Monorepo         | NX 22 + pnpm workspaces                                                                       |
| Frontend         | React 19, Vite, React Router, TanStack Query, Zustand                                         |
| UI / Animaciones | Tailwind CSS, GSAP, Lucide React, lightweight-charts                                          |
| Backend          | NestJS 11, Bull queues, Socket.io                                                             |
| ORM / DB         | Prisma 7, PostgreSQL 16                                                                       |
| Cache / Colas    | Redis 7                                                                                       |
| Auth             | JWT (15min) + refresh tokens, bcrypt                                                          |
| LLM              | OpenRouter (`@openrouter/sdk`), Claude, OpenAI, Groq, Gemini, Mistral, Together — por usuario |
| Trading API      | Binance REST + WebSocket                                                                      |
| Tests            | Vitest (frontend), Jest (backend), Playwright (E2E)                                           |
| CI/CD            | GitHub Actions → GitHub Pages (web) + Railway (api)                                           |

---

## Requisitos previos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Docker** (para PostgreSQL + Redis en local)

---

## Inicio rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/e-burgos/crypto-trader.git
cd crypto-trader

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores (ver sección Variables de entorno)

# 4. Levantar infraestructura local (PostgreSQL + Redis)
pnpm docker:infra

# 5. Aplicar migraciones de base de datos
pnpm db:migrate

# 6. (Opcional) Poblar con datos de prueba
pnpm db:seed

# 7. Iniciar backend y frontend en paralelo
pnpm dev:api   # NestJS en http://localhost:3000
pnpm dev:web   # Vite en http://localhost:4200
```

---

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Base de datos
DATABASE_URL=postgresql://crypto:crypto123@localhost:5432/crypto_trader

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=cambia_esto_por_un_secreto_seguro
JWT_REFRESH_SECRET=cambia_esto_por_otro_secreto_seguro

# Cifrado de claves (AES-256-GCM — 32 bytes en hex)
BINANCE_KEY_ENCRYPTION_KEY=tu_clave_maestra_aes256_aqui

# CryptoPanic (noticias — free tier en https://cryptopanic.com/developers/api/)
CRYPTOPANIC_API_KEY=tu_clave_de_cryptopanic

# Entorno
NODE_ENV=development
PORT=3000
```

> Las claves de LLM (OpenRouter, Claude, OpenAI, Groq, Gemini, Mistral, Together) y NewsAPI se configuran **por usuario** desde la interfaz — no van en `.env`.

---

## Comandos útiles

```bash
# Desarrollo
pnpm dev:api               # Servidor NestJS (puerto 3000)
pnpm dev:web               # Vite dev server (puerto 4200)

# Build de producción
pnpm build:api
pnpm build:web

# Tests
pnpm test:api              # Jest — backend
pnpm test:web              # Vitest — frontend
pnpm test:e2e              # Playwright — E2E

# Linting y formato
pnpm lint
pnpm lint:fix
pnpm format

# TypeScript check
pnpm typecheck

# Base de datos
pnpm db:migrate            # Crear y aplicar migración (dev)
pnpm db:migrate:deploy     # Aplicar migraciones en producción
pnpm db:studio             # Abrir Prisma Studio
pnpm db:reset              # Borrar y recrear DB (dev)

# Docker
pnpm docker:infra          # Solo postgres + redis
pnpm db:up                 # Todos los servicios
pnpm db:down               # Detener servicios

# NX
pnpm nx graph                          # Ver grafo de dependencias
pnpm nx affected --target=test         # Testear solo lo afectado
pnpm nx run api:serve                  # Equivalente a dev:api
```

---

## Estructura del proyecto

```
crypto-trader/
├── apps/
│   ├── api/               Backend NestJS — Railway (prod)
│   └── web/               Frontend React 19 — GitHub Pages (prod)
├── libs/
│   ├── analysis/          Indicadores técnicos + integración LLM
│   ├── data-fetcher/      Binance OHLCV, noticias (CryptoPanic, RSS)
│   ├── trading-engine/    Lógica de órdenes y posiciones
│   ├── openrouter/        Catálogo dinámico de modelos OpenRouter (cache + tipos)
│   ├── shared/            Types, DTOs, constantes, utils
│   └── ui/                Componentes React compartidos
├── docs/
│   ├── CONSTITUTION.md    Arquitectura, convenciones y decisiones del proyecto
│   ├── specs/             Especificaciones por rama (01–27+)
│   └── plans/             Planes de implementación
├── e2e/                   Tests Playwright cross-app
└── docker-compose.yml     Infra local
```

---

## Flujo del agente

```
Cada N minutos (adaptativo por volatilidad):

1. Fetch OHLCV velas  →  Binance REST API
2. Calcular indicadores  →  RSI, MACD, BB, EMA (9/21/50/200), Volumen, S&R
3. Obtener noticias  →  CryptoPanic / NewsData / RSS
4. AgentConfigResolver  →  resolver proveedor/modelo por agente
5. LLM analysis  →  OpenRouter / Claude / OpenAI / Groq / Gemini / Mistral / Together
         prompt: indicadores + velas + noticias + historial últimas 10 ops
         respuesta: { decision, confidence, reasoning, waitMinutes }
6. ¿confidence ≥ threshold?  →  Ejecutar orden BUY/SELL en Binance
7. Guardar AgentDecision + Trade + actualizar Position en DB
8. Emitir eventos WebSocket al dashboard
9. Reprogramar próximo análisis según waitMinutes
```

---

## Despliegue

| Entorno         | Servicio                          | Trigger                  |
| --------------- | --------------------------------- | ------------------------ |
| Frontend (prod) | GitHub Pages                      | Push a `main`            |
| Backend (prod)  | Railway                           | Push a `main`            |
| DB + Cache      | Railway (PostgreSQL 16 + Redis 7) | Provisionado manualmente |
| Local dev       | Docker Compose                    | `pnpm docker:infra`      |

---

## Documentación

| Documento                                                                                          | Descripción                                              |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [docs/CONSTITUTION.md](docs/CONSTITUTION.md)                                                       | Arquitectura, stack detallado, convenciones y decisiones |
| [docs/specs/crypto-trader-spec.md](docs/specs/crypto-trader-spec.md)                               | Especificación completa v1.2                             |
| [docs/plans/crypto-trader-implementation-plan.md](docs/plans/crypto-trader-implementation-plan.md) | Plan de implementación por tareas                        |
| `http://localhost:3000/api/docs`                                                                   | Swagger / OpenAPI (solo en dev)                          |

---

## Licencia

Proyecto privado — todos los derechos reservados.
