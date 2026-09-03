# Constitución del Proyecto

> **Nombre y descripción del proyecto:** `sdd/global.json` → `project` / `description`.
> Es la única fuente de verdad — este documento nunca los hardcodea, así `sdd/` se copia
> a otro repo sin editarlo. `pnpm sdd:validate` falla si el nombre se filtra acá.
> Versión 1.0 | Metodología: SDD (Spec-Driven Development) | Última actualización: cycle-0 (inicial)
> Este documento representa la base institucional, tecnológica y metodológica del proyecto.
> **PLANTILLA:** completar las secciones marcadas con `[...]` al inicializar el proyecto.

---

## 1. Resumen Ejecutivo y Visión

### 1.1 Propósito del Sistema

- **Nombre:** ver `sdd/global.json` → `project`
- **Rol arquitectónico:** plataforma fullstack de trading autónomo de criptomonedas. Un agente de IA híbrida (indicadores técnicos + razonamiento LLM multi-proveedor) opera en nombre de cada usuario comprando y vendiendo BTC/ETH contra USDT/USDC en Binance, con modos Sandbox/Testnet/Live y aislamiento total por usuario.
- **Descripción:** ver `sdd/global.json` → `description`

### 1.2 Responsabilidades del Sistema

**Sí hacemos:**

- Trading spot de BTC/ETH contra USDT/USDC en Binance (Sandbox, Testnet y Live)
- Agente IA híbrido: indicadores técnicos (RSI, MACD, BB, EMA, volumen, S&R) + decisión LLM multi-proveedor
- Multi-usuario aislado: claves API cifradas por usuario (Binance, LLM, noticias), nunca globales
- Dashboard en tiempo real (WebSocket): posiciones, P&L, decisiones del agente, noticias con sentimiento
- Chat con asistente IA, notificaciones in-app, analytics de rendimiento, i18n ES/EN

**No hacemos:**

- Trading on-chain, DEX ni MetaMask; tampoco futuros, margen o apalancamiento
- Assets fuera de BTC/ETH; app móvil; push/email; backtesting; copy/social trading

### 1.3 Principios de Diseño

1. Seguro por defecto — modo Sandbox obligatorio y enforced server-side hasta que el usuario elija Live explícitamente.
2. Transparencia total — cada decisión del agente queda registrada con razonamiento, indicadores, proveedor/modelo y contexto de noticias.
3. Multi-usuario aislado — claves y configuraciones cifradas por usuario (AES-256-GCM); costos LLM atribuibles al usuario.
4. Gobernanza admin — el administrador controla qué proveedores LLM están activos globalmente (kill-switch incluido).
5. Ver `docs/CONSTITUTION.md` en la raíz del repo para la constitución histórica completa del proyecto (decisiones 1–17).

### 1.4 Objetivos de Desarrollo

- Establecer un proceso de desarrollo guiado por especificaciones (SDD) robusto y de calidad.
- Garantizar que todo cambio pase por una fase de diseño funcional, de planificación y de arquitectura antes de codificar.
- Mantener un contrato de API coherente, versionado y documentado.

---

## 2. Arquitectura del Sistema

### 2.1 Estructura General

El sistema está organizado como un monorepo administrado con Nx.
Para el detalle técnico de cada subproyecto, ver su constitución específica:

| Subproyecto | Tipo | Rol en el sistema | Constitución específica |
| ----------- | ---- | ----------------- | ----------------------- |
| `apps/api` | app | Backend NestJS: auth, trading, análisis, LLM, WebSocket | `sdd/context/apps/api/constitution.md` |
| `apps/web` | app | Frontend React 19 (SPA): dashboard, chat, settings | `sdd/context/apps/web/constitution.md` |
| `apps/api-e2e` | app | Tests de integración del API (Jest + Supertest) | `sdd/context/apps/api-e2e/constitution.md` |
| `apps/web-e2e` | app | Tests E2E del frontend (Playwright) | `sdd/context/apps/web-e2e/constitution.md` |
| `libs/analysis` | lib | Indicadores técnicos + integración LLM | `sdd/context/libs/analysis/constitution.md` |
| `libs/data-fetcher` | lib | OHLCV Binance, noticias, RSS | `sdd/context/libs/data-fetcher/constitution.md` |
| `libs/trading-engine` | lib | Lógica de órdenes y posiciones | `sdd/context/libs/trading-engine/constitution.md` |
| `libs/openrouter` | lib | Catálogo dinámico de modelos OpenRouter (SDK + cache) | `sdd/context/libs/openrouter/constitution.md` |
| `libs/providers` | lib | Proveedores de datos de mercado externos (CoinGecko, DefiLlama, etc.) | `sdd/context/libs/providers/constitution.md` |
| `libs/shared` | lib | Types, DTOs, constantes, utils compartidos | `sdd/context/libs/shared/constitution.md` |
| `libs/ui` | lib | Design system React stateless (50+ componentes) | `sdd/context/libs/ui/constitution.md` |

> Al generar una nueva app/lib/tool, sumar una fila por subproyecto (solo agregar filas — nunca reformatear la tabla completa).
> Las constituciones de subproyecto son la **fuente de verdad** del stack y las convenciones técnicas.
> La sección 3 de este documento es un resumen de alto nivel — siempre leer el subproyecto para detalles.

---

## 3. Stack Tecnológico (resumen — fuente de verdad en cada subproyecto)

> ⚠️ Este resumen es mantenido por el Reviewer al cerrar cada ciclo.
> Para el stack completo y actualizado de un subproyecto, leer su `constitution.md` individual.

### Monorepo

- **Nx 22** + **pnpm 9** como workspace manager, **TypeScript** estricto en todos los packages, Node.js ≥ 20

### Snapshot de stacks por subproyecto

| Subproyecto | Stack base | Última actualización |
| ----------- | ---------- | -------------------- |
| `apps/api` | NestJS 11, Prisma 7, PostgreSQL 16, Redis 7 (Bull + ioredis directo para coordinación entre réplicas), Bull, Socket.io, Passport+JWT, zod 4 | spec-e-burgos-005 cycle-02 (2026-09-01) |
| `apps/web` | React 19, Vite 8, TanStack Query 5, Zustand 5, Tailwind 3, react-i18next | spec-e-burgos-009 cycle-01 (2026-09-03) |
| `apps/api-e2e` | Jest + Supertest | cycle-0 (inicial) |
| `apps/web-e2e` | Playwright | cycle-0 (inicial) |
| `libs/analysis` | TypeScript, SDKs LLM (OpenRouter, Anthropic, OpenAI, Groq, Gemini, Mistral) | spec-e-burgos-005 cycle-01 (2026-08-30) |
| `libs/data-fetcher` | TypeScript, Binance REST/WS (spot: MARKET/LIMIT/LIMIT_MAKER/STOP_LOSS_LIMIT con trailingDelta/OCO de venta y de compra; WS con heartbeat ping/pong y suscripción dinámica), rss-parser | spec-e-burgos-005 cycle-02 (2026-09-01) |
| `libs/trading-engine` | TypeScript (Jest) | spec-e-burgos-005 cycle-02 (2026-09-01) |
| `libs/openrouter` | TypeScript, @openrouter/sdk | cycle-0 (inicial) |
| `libs/providers` | TypeScript (Vitest), APIs públicas de mercado | cycle-0 (inicial) |
| `libs/shared` | TypeScript puro | spec-e-burgos-009 cycle-01 (2026-09-03) |
| `libs/ui` | React 19, Tailwind, Radix UI, lucide-react (Vitest) | spec-e-burgos-009 cycle-01 (2026-09-03) |

---

## 4. Metodología SDD (Spec-Driven Development)

El proyecto se rige estrictamente por SDD. Ninguna funcionalidad se codifica sin antes completar el ciclo de diseño.

### 4.1 Ciclo de Agentes y Roles

1. **Orquestador:** Lee la especificación (`sdd/specs/`) y el estado (`sdd/global.json`), valida dependencias y prepara el `cycle_brief` con contexto mínimo para cada agente especializado.
2. **Funcional:** Toma el `cycle_brief` y genera historias de usuario (HU) y requisitos funcionales (RF) en lenguaje de negocio.
3. **Planner:** Descompone las historias en tareas técnicas ordenadas y estimadas (story points).
4. **Arquitecto:** (En paralelo con el Planner) Diseña la estructura técnica, define el esquema de datos y los contratos de la API.
5. **Implementador Backend:** Desarrolla la API y lógica de backend siguiendo los contratos y la tarea asignada.
6. **Implementador Frontend:** Desarrolla la UI y vistas del frontend.
7. **Reviewer:** Valida la calidad, tests, cumplimiento de requisitos y aprueba para cerrar el ciclo.

### 4.2 Reglas Estrictas del Proyecto

> ⛔ **SPEC GATE — REGLA GLOBAL INVIOLABLE**
> Antes de escribir UNA SOLA LÍNEA de código de implementación, el agente DEBE verificar:
>
> 1. Existe un archivo `.spec.md` en `sdd/specs/` para el módulo que se va a desarrollar
> 2. El módulo figura en `pending_modules` o `in_progress_modules` de `sdd/global.json`
> 3. Existe un `cycle_brief` generado por el Orquestador
> 4. Existen historias de usuario generadas por el Funcional
> 5. Existen tasks técnicas en `sdd/specs/{spec-id}/cycles/cycle-[XX]/tasks.json` generadas por el Planner
> 6. Existen contratos de API y schema definidos por el Arquitecto
>
> Si alguna de estas condiciones NO se cumple → **DETENER** y completar los pasos faltantes antes de continuar.

1. **SPEC GATE:** Ninguna implementación puede iniciarse sin haber completado el flujo de diseño SDD completo para ese módulo.
2. **Memoria como Fuente de Estado:** El estado del proyecto reside en `sdd/global.json`, `sdd/schema.json`, `sdd/api.json`, `sdd/components.json` y los `tasks.json` per-cycle (índice generado en `sdd/tasks.json`). Todos validan contra `sdd/schemas/` (`pnpm sdd:validate`).
3. **Lectura Obligatoria:** Es obligatorio leer `sdd/global.json` antes de iniciar cualquier tarea.
4. **Prohibido el Cambio Manual:** Nunca edites manualmente los archivos de estado de `sdd/` (solo los agentes en su flujo SDD los actualizan al inicio o fin del ciclo).
5. **Comentarios:** sin comentarios explicativos del QUÉ ni referencias a task/spec/ciclo — ver
   "Estilo de código (INVIOLABLE)" en `sdd/agents/sdd-implementor-back.agent.md` /
   `sdd-implementor-front.agent.md`. Único comentario permitido: una línea en inglés para un POR QUÉ
   no obvio.
6. **Ejecución Nx:** Siempre prefiere utilizar `pnpm nx` (o el package manager configurado) para ejecutar tareas del monorepo.
7. **Orden de ciclos:** Los ciclos se ejecutan en el orden definido en `planned_cycles` de `sdd/global.json`. Un ciclo no puede comenzar si el ciclo anterior no está `completed`.
8. **Un ciclo a la vez:** Nunca iniciar un segundo ciclo si hay uno en `in_progress_modules`.
9. **Contextos siempre frescos, vía fragmentos aditivos:** durante un ciclo/fix NUNCA se editan directamente `constitution.md` ni `context_prompt.md` del subproyecto — el cierre escribe un fragmento append-only en `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md` (fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`). El contexto vigente = archivos base + `updates/*.md` en orden de nombre. La consolidación (fusionar fragmentos en los archivos base, eliminar lo obsoleto y borrar los fragmentos) es operación de un solo actor: el Orquestador al iniciar un ciclo nuevo sobre ese subproyecto, o el Reviewer si se acumulan ≥5 fragmentos.
10. **Specs numeradas y registradas:** Toda spec DEBE tener un ID con formato `spec-[gh-user]-[NNN]-[slug]`, la carpeta y el archivo `.spec.md` DEBEN seguir esa convención, y DEBE estar registrada en `sdd/specs/index.json` antes de ser referenciada en cualquier otra parte del arnés.

### 4.2.1 Convención de naming de specs

```
Formato de carpeta:   sdd/specs/spec-[gh-user]-[NNN]-[slug]/
Formato de archivo:   spec-[gh-user]-[NNN]-[slug].spec.md
Ejemplo:              sdd/specs/spec-jdoe-001-user-onboarding/spec-jdoe-001-user-onboarding.spec.md

Encabezado obligatorio en el archivo:
  > spec-id: spec-[gh-user]-[NNN]-[slug]
  > slug: [slug]
  > módulo: [nombre del módulo en global.json]
  > estado: activo | completado | deprecado
  > fecha: YYYY-MM-DD

Registro centralizado: sdd/specs/index.json
  - specs[]: array con entrada por cada spec creada (append-only, sin last_id global)
  - Al crear una nueva spec: agregar entrada al array
```

> ⛔ No crear specs sin registrarlas primero en `sdd/specs/index.json`.
> La referencia canónica al archivo de spec en `global.json`, `tasks.json` y cualquier otro lugar
> DEBE usar la ruta completa: `sdd/specs/spec-[gh-user]-[NNN]-[slug]/spec-[gh-user]-[NNN]-[slug].spec.md`.

### 4.3 Flujo Obligatorio Antes de Implementar

```
┌─────────────────────────────────────────────────┐
│              SPEC GATE (VERIFICACIÓN)           │
│  1. ¿Existe spec en sdd/specs/?  → SI / NO      │
│  2. ¿Está en global.json?        → SI / NO      │
│  3. ¿Hay {spec-id}/cycles/cycle-[XX]/brief.yaml?   → SI / NO  │
│  4. ¿Hay {spec-id}/cycles/cycle-[XX]/functional.md? → SI / NO  │
│  5. ¿Hay {spec-id}/cycles/cycle-[XX]/planner.md?   → SI / NO   │
│  6. ¿Hay {spec-id}/cycles/cycle-[XX]/architect.md? → SI / NO   │
│  7. ¿Existe contexto del subproyecto? → SI / NO  │
│                                                 │
│  TODO SI → Continuar a implementación           │
│  ALGÚN NO → Completar el paso faltante          │
└─────────────────────────────────────────────────┘
            ↓ (solo si TODO ES SI)
┌─────────────────────────────────────────────────┐
│         IMPLEMENTACIÓN (task por task)          │
│  sdd-implementor-back  →  una TASK-BE a la vez  │
│  sdd-implementor-front →  una TASK-FE a la vez  │
└─────────────────────────────────────────────────┘
            ↓ (al finalizar todas las tasks)
┌─────────────────────────────────────────────────┐
│  REVIEWER → cierra el ciclo                    │
│  Crea {spec-id}/cycles/cycle-[XX]/cycle.json    │
│  Actualiza global.json, schema.json, api.json   │
└─────────────────────────────────────────────────┘
```

### 4.4 Documentos obligatorios por ciclo

Cada ciclo de desarrollo DEBE tener los siguientes archivos en `sdd/specs/{spec-id}/cycles/cycle-[XX]/`:

| Archivo         | Generado por                                      | Momento                         |
| --------------- | ------------------------------------------------- | ------------------------------- |
| `brief.yaml`    | sdd-orchestrator                                  | Al iniciar el ciclo             |
| `functional.md` | sdd-functional                                    | Antes de planner/arquitecto     |
| `planner.md`    | sdd-planner                                       | En paralelo con arquitecto      |
| `architect.md`  | sdd-architect                                     | En paralelo con planner         |
| `tasks.json`    | sdd-planner                                       | En paralelo con arquitecto      |
| `cycle.json`    | sdd-orchestrator (inicio) / sdd-reviewer (cierre) | Al iniciar y al cerrar el ciclo |

### 4.5 Contexto de subproyectos

Cada app, lib y tool del monorepo tiene su propio contexto en `sdd/context/`.
Este contexto refleja la constitución y el context_prompt específicos para ese subproyecto,
y los agentes DEBEN leerlo antes de generar documentos o código para ese subproyecto.

```
sdd/context/
├── constitution.md          ← Contexto GLOBAL del monorepo (NO modificar directamente)
├── context_prompt.md        ← Entry point GLOBAL (NO modificar directamente)
├── apps/                    ← Un directorio por app generada en Nx
│   └── [nombre]/
│       ├── constitution.md
│       ├── context_prompt.md
│       └── updates/            (fragmentos aditivos pendientes de consolidar)
├── libs/                    ← Ídem por lib
└── tools/                   ← Ídem por tool
```

**Regla:** Todo agente que trabaje sobre un subproyecto DEBE leer primero:

1. `sdd/context/context_prompt.md` — para entender el monorepo global
2. `sdd/context/[apps|libs|tools]/[nombre]/context_prompt.md` + `constitution.md` + `updates/*.md` (en orden de nombre) — para entender el subproyecto con su contexto vigente

**Regla de frescura — mecanismo aditivo (ver sección 🧩 de `sdd/dual-harness/CLAUDE.md`):**

- Al cerrar un ciclo/fix, el delta se escribe como fragmento en
  `sdd/context/[apps|libs|tools]/[nombre]/updates/YYYY-MM-DD-[spec-id]-cycle-[XX].md`
  (fixes repo-level: `YYYY-MM-DD-fix-[gh-user]-[seq].md`) — nunca editando los archivos base
- Los archivos base y su encabezado `> Última actualización: cycle-[N] | Fase: [fase] | Fecha: [YYYY-MM-DD]`
  solo los toca la consolidación (operación de un solo actor: Orquestador al iniciar un
  ciclo nuevo sobre ese subproyecto, o Reviewer si se acumulan ≥5 fragmentos)
- La consolidación funde los fragmentos, elimina toda información obsoleta y borra los
  fragmentos consolidados
- El contexto incorrecto es peor que no tener contexto: menos y correcto > más e incorrecto
