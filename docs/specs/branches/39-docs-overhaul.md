# Spec 39 — Documentación: Rediseño visual + verificación de contenido

**Fecha:** 2026-04-24
**Versión:** 1.1
**Estado:** En progreso (Fases A-E completadas, Fase F pendiente)
**Branch:** `feature/llm-provider-toggle` (trabajo en progreso en esta branch)
**Dependencias:** Spec 38 (llm-provider-toggle) mergeada en main

> **v1.1 (2026-04-24):** Evolución a multi-page layout idéntico a OpenRouter Docs. Agrega Fase F: sistema multi-page con nested routing, TOC scroll-spy, buscador, paginado, y separación de contenido en ~11 páginas independientes. Reemplaza Decisión #2 (single-page → multi-page).

---

## 1. Resumen ejecutivo

La documentación actual de la plataforma (`/help`) tiene tres problemas fundamentales:

1. **Diseño visual desactualizado** — layout funcional pero genérico; no alcanza el nivel de documentación de referencia como [OpenRouter Docs](https://openrouter.ai/docs/quickstart).
2. **Contenido potencialmente desactualizado** — las secciones de agentes, proveedores LLM, API keys y modos de operación pueden no reflejar el estado real de la plataforma tras las specs 28-38.
3. **Landing page (home) desalineada** — la información de features, agentes, proveedores y modos puede estar desactualizada respecto a lo implementado.
4. **Path `/help` subóptimo** — `/docs` es el estándar de la industria para documentación.
5. **Cambios recientes no documentados** — las features de la branch actual (Spec 38: LLM provider toggle, presets inteligentes, validación de modelos contra OpenRouter, agentes con modelos recomendados) no están reflejadas en la documentación.

### Objetivo

Producir una documentación de calidad comparable a OpenRouter Docs: limpia, navegable, con componentes reutilizables de alta calidad visual, contenido 100% verificado contra la implementación real, y accesible en `/docs`.

---

## 2. Arquitectura / Diseño

### 2.1 Referencia de diseño: OpenRouter Docs

Elementos clave a replicar/adaptar:

| Elemento OpenRouter                                      | Adaptación CryptoTrader                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Sidebar izquierda con grupos colapsables y estado activo | Ya existe (`HelpSidebar`), mejorar visual: tipografía, spacing, indicador activo tipo pill |
| Code blocks con tabs de lenguaje y line numbers          | Nuevo componente `DocsCodeBlock` en `libs/ui`                                              |
| Callout boxes (info, warning, tip)                       | Nuevo componente `DocsCallout` en `libs/ui`                                                |
| Tablas limpias con headers diferenciados                 | Nuevo componente `DocsTable` en `libs/ui`                                                  |
| Cards de overview con ícono + título + descripción       | Nuevo componente `DocsCard` en `libs/ui`                                                   |
| Sección título con breadcrumb y ancla                    | Nuevo componente `DocsSectionHeader` en `libs/ui`                                          |
| Navegación "Was this page helpful?"                      | Nuevo componente `DocsPageFeedback` en `libs/ui`                                           |
| Separadores limpios entre secciones                      | Estilización via clases Tailwind                                                           |
| Step indicators (1, 2, 3...) estilo numbered             | Nuevo componente `DocsSteps` en `libs/ui`                                                  |
| Badges inline (SPOT, MARKET ORDER, etc.)                 | Nuevo componente `DocsBadge` en `libs/ui`                                                  |
| Tabla resumen tipo overview al inicio de sección         | Reutilizar `DocsTable` con variante `overview`                                             |

### 2.2 Estructura de archivos propuesta

```
libs/ui/src/lib/docs/
├── docs-callout.tsx          ← Callout (info | warning | tip | danger)
├── docs-card.tsx             ← Card de overview
├── docs-code-block.tsx       ← Code block con tabs y line numbers
├── docs-section-header.tsx   ← Título de sección con ancla copiable
├── docs-steps.tsx            ← Pasos numerados
├── docs-table.tsx            ← Tabla limpia con variantes
├── docs-badge.tsx            ← Badge inline
├── docs-page-feedback.tsx    ← "Was this page helpful?"
└── index.ts                  ← Barrel export

libs/ui/src/lib/domain/help/
├── help-sidebar.tsx          ← ACTUALIZAR: mejorar visual, agregar nuevas secciones
└── index.ts

apps/web/src/pages/
├── docs.tsx                  ← RENOMBRAR help.tsx → docs.tsx (reescritura completa)

apps/web/src/pages/admin/
├── help.tsx                  ← ACTUALIZAR: redirigir a /admin/docs si se decide
```

### 2.3 Cambio de ruta `/help` → `/docs`

```
Antes:                          Después:
/help                    →      /docs
/help#faq                →      /docs#faq
/help#agent-flow         →      /docs#agent-flow
Footer link: /help       →      /docs
Admin: /admin/help       →      /admin/docs (o mantener /admin/help si es panel interno)
```

**Impacto en routing (`app.tsx`):**

- Cambiar `path="/help"` → `path="/docs"`
- Agregar redirect: `<Route path="/help" element={<Navigate to="/docs" replace />} />`
- Actualizar import: `HelpPage` → `DocsPage`

**Impacto en links internos:**

- Landing footer: `/help` → `/docs`
- Cualquier otro link interno que apunte a `/help`
- E2E tests: `landing.unauth.spec.ts`, `navigation.spec.ts`

---

## 3. Componentes nuevos en `libs/ui`

### 3.1 `DocsCallout`

```tsx
interface DocsCalloutProps {
  variant: 'info' | 'warning' | 'tip' | 'danger';
  title?: string;
  children: React.ReactNode;
}
```

Diseño: borde izquierdo coloreado (4px), ícono automático por variant, fondo sutil. Similar al callout de OpenRouter.

### 3.2 `DocsCodeBlock`

```tsx
interface DocsCodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  copyable?: boolean;
}
```

Diseño: fondo oscuro (`bg-zinc-900`), header con título y botón copy, line numbers opcionales, scroll horizontal para código largo. No necesita tabs multi-lenguaje (no aplica para esta app).

### 3.3 `DocsCard`

```tsx
interface DocsCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  href?: string; // si es clickable, navegar
  badge?: string; // badge superior opcional
}
```

### 3.4 `DocsSectionHeader`

```tsx
interface DocsSectionHeaderProps {
  id: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  level?: 'h2' | 'h3'; // default h2
}
```

Diseño: heading + ícono de ancla hover que copia `#id` al clipboard.

### 3.5 `DocsSteps`

```tsx
interface DocsStepsProps {
  steps: Array<{ title: string; description: string | React.ReactNode }>;
}
```

Diseño: línea vertical conectando los puntos numerados, similar a OpenRouter quickstart steps.

### 3.6 `DocsTable`

```tsx
interface DocsTableProps {
  headers: string[];
  rows: (string | React.ReactNode)[][];
  variant?: 'default' | 'overview'; // overview = primera columna bold
}
```

### 3.7 `DocsBadge`

```tsx
interface DocsBadgeProps {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}
```

### 3.8 `DocsPageFeedback`

Simple "Was this page helpful? Yes / No" al final de la documentación. Solo visual por ahora (no envía datos).

---

## 4. Contenido — Verificación y actualización

### 4.1 Auditoría de `/help` (ahora `/docs`)

| Sección actual           | Verificar                                                  | Acción esperada                                                                                                                  |
| ------------------------ | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **FAQ**                  | ¿Las preguntas/respuestas reflejan funcionalidad actual?   | Actualizar con info de multi-agente, OpenRouter, presets, modos                                                                  |
| **Paso a Paso (Guide)**  | ¿Los pasos de onboarding son correctos?                    | Agregar paso de selección de provider/modelo, actualizar flujo                                                                   |
| **Behaviors & Warnings** | ¿Stop All es la única advertencia relevante?               | Agregar: modo Sandbox vs Live vs Testnet, rate limits                                                                            |
| **Agents Showcase**      | ¿Muestra los 8 agentes correctos?                          | Verificar que KRYPTO (routing, orchestrator, synthesis) + NEXUS, FORGE, SIGMA, CIPHER, AEGIS estén presentes con roles correctos |
| **Agent Flow**           | ¿El diagrama de decisión sigue siendo preciso?             | Verificar contra código real del orchestrator                                                                                    |
| **Agent Cycle**          | ¿Las fuentes de wait time son correctas?                   | Verificar minInterval, suggestedWait contra código                                                                               |
| **Agent Presets**        | ¿Los presets mostrados coinciden con los implementados?    | Actualizar con Free/Balanced/Optimized + modelos recomendados                                                                    |
| **Agent Params**         | ¿Todos los parámetros de configuración están documentados? | Verificar contra schema real de AgentConfig                                                                                      |
| **Trade Execution**      | ¿El flujo de BUY/SELL es correcto?                         | Verificar contra TradingEngine real                                                                                              |
| **Binance Integration**  | ¿Pares, comisiones, modos son correctos?                   | Verificar pares soportados, fórmulas, sandbox/live/testnet                                                                       |
| **API Keys**             | ¿Sigue mostrando Claude, OpenAI, Groq individualmente?     | **IMPORTANTE:** Actualizar para priorizar OpenRouter como provider recomendado; documentar el toggle admin de providers          |

### 4.2 Contenido NUEVO a agregar

| Sección nueva                  | Contenido                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **OpenRouter Integration**     | Cómo funciona la integración, catálogo de modelos, presets, fallback model, validación live de modelos                                        |
| **LLM Providers**              | Tabla de providers soportados (OpenRouter, Claude, OpenAI, Groq, Gemini, Mistral, Together), cuáles están activos, cómo el admin los controla |
| **Presets Inteligentes**       | Explicación de Free/Balanced/Optimized, modelos recomendados por agente, fallback behavior                                                    |
| **Agent Models Configuration** | Cómo configurar modelo por agente, validación de modelos, recomendaciones                                                                     |
| **Operation Modes**            | Sandbox, Testnet, Live — diferencias, limitaciones, cómo cambiar                                                                              |
| **Admin Panel**                | Overview de funcionalidades admin (si es visible para el usuario o solo para admins documentar aparte)                                        |
| **Notifications**              | Centro de notificaciones, tipos de alertas                                                                                                    |

### 4.3 Auditoría de Landing Page (Home)

| Sección landing       | Verificar                                             | Acción esperada                                                                                |
| --------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **Hero**              | Badges ("Powered by AI", "Bank-grade security", etc.) | Verificar veracidad                                                                            |
| **Stats**             | 4 estadísticas mostradas                              | ¿Son métricas reales o placeholders? Ajustar                                                   |
| **How It Works**      | 3 pasos                                               | Verificar que reflejen el flujo real actual                                                    |
| **Agents**            | 5 agentes (NEXUS, FORGE, SIGMA, CIPHER, AEGIS)        | **FALTA:** KRYPTO (routing, orchestrator, synthesis) no está en landing. Agregar o reorganizar |
| **Risk & Protection** | 4 cards                                               | Verificar features implementadas                                                               |
| **Features**          | 6 features                                            | Verificar que todas estén implementadas y agregar las nuevas (OpenRouter, presets, etc.)       |
| **AI Providers**      | OpenRouter + 6 directos                               | Verificar que la lista sea correcta (¿Together sigue soportado?)                               |
| **Trading Modes**     | Sandbox, Testnet, Live                                | Verificar que los 3 modos estén implementados                                                  |
| **Footer**            | Links a /help                                         | Actualizar a /docs                                                                             |

### 4.4 Documentación de cambios recientes (Spec 38)

Agregar en `/docs` información sobre:

| Feature                                                                 | Dónde documentar                    |
| ----------------------------------------------------------------------- | ----------------------------------- |
| Toggle admin de providers LLM                                           | Sección LLM Providers + Admin Panel |
| Presets inteligentes (Free/Balanced/Optimized) con modelos recomendados | Sección Presets + Agent Models      |
| Validación live de modelos contra catálogo OpenRouter                   | Sección OpenRouter Integration      |
| Modelo fallback por tier                                                | Sección Presets                     |
| Click-to-apply en modelos recomendados                                  | Sección Agent Models Configuration  |
| 8 agentes con codenames (KRYPTO ×3, NEXUS, FORGE, SIGMA, CIPHER, AEGIS) | Sección Agents Showcase actualizada |

---

## 5. Fases de implementación

### Fase A — Componentes UI de documentación (`libs/ui`)

1. Crear `libs/ui/src/lib/docs/` con todos los componentes nuevos:
   - `DocsCallout`
   - `DocsCodeBlock`
   - `DocsCard`
   - `DocsSectionHeader`
   - `DocsSteps`
   - `DocsTable`
   - `DocsBadge`
   - `DocsPageFeedback`
2. Barrel export en `libs/ui/src/lib/docs/index.ts`
3. Re-export desde `libs/ui/src/index.ts`
4. Verificar: `pnpm nx lint ui && pnpm nx build ui`

### Fase B — Rediseño visual de `/docs`

1. Renombrar `/help` → `/docs` en routing (`app.tsx`)
2. Agregar redirect `/help` → `/docs`
3. Actualizar `HelpSidebar` con nuevas secciones y visual mejorado
4. Reescribir `docs.tsx` (ex `help.tsx`) usando los nuevos componentes de `libs/ui/docs`
5. Mantener toda la estructura i18n existente, agregar claves nuevas
6. Aplicar diseño inspirado en OpenRouter Docs:
   - Sidebar limpio con grupos y hover states
   - Content area con spacing generoso
   - Secciones con `DocsSectionHeader` + anclas copiables
   - FAQs con `FaqItem` existente (conservar)
   - Pasos con `DocsSteps`
   - Callouts para warnings/tips
   - Tablas para datos tabulares
   - Code blocks donde aplique (API keys, formulas, etc.)
7. Verificar: `pnpm nx lint web && pnpm nx build web`

### Fase C — Verificación y actualización de contenido `/docs`

1. Auditar cada sección contra código real:
   - Leer servicios backend, schemas Prisma, constantes frontend
   - Verificar nombres de agentes, roles, codenames
   - Verificar pares de trading soportados
   - Verificar parámetros de configuración (schema)
   - Verificar flujo de decisión del agente
   - Verificar providers LLM activos
2. Corregir contenido incorrecto en archivos i18n (`en.ts`, `es.ts`)
3. Agregar secciones nuevas (OpenRouter, Presets, Agent Models, Operation Modes)
4. Documentar features de Spec 38 (toggle, validación, recomendaciones)

### Fase D — Verificación y actualización de contenido Landing (Home)

1. Auditar landing page contra implementación real:
   - Verificar agentes mostrados (faltan KRYPTO routing/orchestrator/synthesis)
   - Verificar providers LLM listados
   - Verificar features listadas
   - Verificar stats (métricas)
   - Verificar modos de operación
2. Corregir contenido en i18n
3. Agregar agentes/features faltantes si corresponde

### Fase E — Actualización de links, E2E y cleanup

1. Actualizar todos los links internos: `/help` → `/docs`
   - Landing footer
   - Navigation components
   - Admin help page
   - Cualquier otro referencia
2. Actualizar E2E tests que referencien `/help`
3. Actualizar admin help page (`/admin/help` → `/admin/docs` o mantener)
4. Run full: `pnpm nx lint web && pnpm nx test web && pnpm nx e2e web-e2e`

### Fase F — Multi-page layout + OpenRouter-like design (v1.1)

> **Contexto:** Análisis profundo del diseño de OpenRouter Docs revela que es un sistema multi-page con layout 3 columnas (sidebar | content | TOC). Cada item del sidebar es una página independiente. Esta fase transforma la documentación single-page actual en multi-page.

#### F.1 — Análisis de diseño OpenRouter Docs

**Layout 3 columnas (desktop):**

```
┌─────────────────────────────────────────────────────────┐
│  [Logo]        [═══ Search ═══] [/] [Ask AI]    [Nav]   │  ← Header global
├─────────┬───────────────────────────────┬───────────────┤
│ Sidebar │         Main Content          │  On this page │
│ (240px) │         (flex-1)              │  (200px)      │
│         │                               │               │
│ ▸ Group │  Breadcrumb    [Copy page]    │  ▸ Section 1  │
│   • FAQ │  # Page Title                 │  ▸ Section 2  │ ← scroll-spy activo
│   • Gui │  Subtitle text                │  ▸ Section 3  │
│         │                               │  ▸ Section 4  │
│ ▸ Group │  ## Section 1                 │               │
│   • Age │  Content...                   │               │
│   • Tra │                               │               │
│         │  ## Section 2                 │               │
│         │  Content...                   │               │
│         │                               │               │
│         │  ┌─ Previous ─┬─ Next ──────┐ │               │
│         │  │ ← FAQ      │ Guide →     │ │               │
│         │  └────────────┴─────────────┘ │               │
│         │  Was this helpful? [Yes] [No] │               │
└─────────┴───────────────────────────────┴───────────────┘
```

**Componentes del layout identificados:**

| Componente               | OpenRouter                                                     | Nuestra adaptación                                                        |
| ------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Header con Search        | Search bar + shortcut `/` + "Ask AI"                           | `DocsHeader` — search bar con fuzzy match + shortcut `/`, sin AI          |
| Sidebar izquierdo        | Grupos colapsables, item activo con pill, scroll independiente | `DocsSidebar` — evolución de `HelpSidebar`, usa `NavLink` de react-router |
| TOC derecho (scroll-spy) | "On this page" sticky, H2 links, highlight en scroll           | `DocsTOC` — nuevo componente, IntersectionObserver sobre H2               |
| Content area             | Breadcrumb + título + contenido + paginado                     | `DocsLayout` — wrapper con Outlet para nested routes                      |
| Paginado footer          | "← Previous" / "Next →" con título de la página                | `DocsPagination` — links a prev/next page                                 |
| Breadcrumb               | "Overview > Quickstart"                                        | `DocsBreadcrumb` — grupo > página actual                                  |
| Page feedback            | "Was this page helpful? Yes/No"                                | `DocsPageFeedback` — ya existe                                            |

#### F.2 — Estructura de páginas (multi-page)

Mapeo de la documentación actual (single-page) a páginas independientes, agrupadas por dominio:

```
/docs                          → DocsLayout (sidebar + content + TOC)
  /docs/quickstart             → Página: Primeros Pasos (FAQ + Guide fusionados)
  /docs/platform-behavior      → Página: Comportamiento de la Plataforma
  /docs/agents                 → Página: Agentes y Multi-Agent System
  /docs/agent-flow             → Página: Cómo Decide el Agente (ciclo, decisión, flujo)
  /docs/agent-config           → Página: Configuración del Agente (presets, parámetros, conceptos)
  /docs/trade-execution        → Página: Ejecución de Trades (compra, venta, reglas)
  /docs/binance                → Página: Integración Binance (pares, comisiones, seguridad)
  /docs/operation-modes        → Página: Modos de Operación (Sandbox, Testnet, Live)
  /docs/llm-providers          → Página: Proveedores LLM (7 providers, tabla, presets)
  /docs/api-keys               → Página: API Keys (OpenRouter, Binance, Claude, OpenAI, Groq)
  /docs/faq                    → Página: FAQ (preguntas frecuentes expandidas)
```

**Redirecciones de backward compatibility:**

```
/docs                → /docs/quickstart (redirect)
/help                → /docs/quickstart (redirect existente actualizado)
/docs#faq            → /docs/faq
/docs#agent-flow     → /docs/agent-flow
/docs#binance-integration → /docs/binance
/docs#api-keys       → /docs/api-keys
```

#### F.3 — Componentes nuevos

**`DocsLayout`** — Layout wrapper con 3 columnas

```tsx
interface DocsLayoutProps {
  children: React.ReactNode; // Outlet de react-router
}
// Renderiza: DocsSidebar | <main>{children}</main> | DocsTOC
```

**`DocsTOC`** — Table of Contents con scroll-spy

```tsx
interface DocsTOCProps {
  // Auto-detecta H2 del contenido renderizado via IntersectionObserver
}
// Renderiza: "On this page" + lista de H2 + highlight activo
```

**`DocsSearch`** — Buscador fuzzy local

```tsx
interface DocsSearchProps {
  pages: DocsPageMeta[]; // título, descripción, path, keywords
}
// Renderiza: input con shortcut /, dropdown de resultados
```

**`DocsPagination`** — Footer prev/next

```tsx
interface DocsPaginationProps {
  prev?: { title: string; href: string };
  next?: { title: string; href: string };
}
```

**`DocsBreadcrumb`** — Breadcrumb de navegación

```tsx
interface DocsBreadcrumbProps {
  group: string; // "Getting Started"
  page: string; // "Quickstart"
}
```

**`DocsSidebar`** — Evolución de HelpSidebar para multi-page

```tsx
// Usa NavLink de react-router en vez de scroll-to-id
// Highlight basado en ruta activa, no IntersectionObserver
```

#### F.4 — Generación de contenido

Antes de implementar las páginas, generar un documento MD (`docs/content/docs-content.md`) que sirva como fuente de verdad del contenido. Para cada página:

1. **Revisar cada pantalla de la plataforma** — extraer conceptos, flujos, términos que el usuario necesita entender
2. **Separar inteligentemente** — cada página cubre un dominio conceptual completo
3. **Explicar conceptos en profundidad** — no solo "qué hace" sino "por qué", "cuándo", "cómo funciona internamente"
4. **Generar contenido bilingüe** — EN y ES simultáneamente

Páginas de la plataforma a analizar para extraer contenido:

| Pantalla             | Ruta                           | Información a documentar                |
| -------------------- | ------------------------------ | --------------------------------------- |
| Dashboard Overview   | `/dashboard`                   | Métricas, widgets, estado del agente    |
| Live Chart           | `/dashboard/chart`             | Indicadores, timeframes, interpretación |
| Positions            | `/dashboard/positions`         | Estados, acciones, PnL                  |
| Trade History        | `/dashboard/history`           | Filtros, exportación, métricas          |
| Agent Log            | `/dashboard/agent-log`         | Tipos de log, interpretación, debug     |
| Agent Config         | `/dashboard/config`            | Parámetros, presets, conceptos          |
| Market               | `/dashboard/market`            | Datos de mercado, pares, interpretación |
| News Feed            | `/dashboard/news`              | Fuentes, relevancia, filtros            |
| Chat                 | `/dashboard/chat`              | Interacción con agente, RAG             |
| Settings: Exchange   | `/dashboard/settings/exchange` | API keys Binance, modo, permisos        |
| Settings: LLMs       | `/dashboard/settings/llms`     | Providers, modelos, presets             |
| Settings: Agents     | `/dashboard/settings/agents`   | Configuración por agente                |
| Settings: News       | `/dashboard/settings/news`     | Fuentes de noticias, filtros            |
| Settings: Profile    | `/dashboard/settings/profile`  | Cuenta, preferencias                    |
| Notifications        | `/dashboard/notifications`     | Tipos, configuración                    |
| Admin: LLM Providers | `/admin/llm-providers`         | Toggle de providers (admin only)        |
| Admin: Agent Models  | `/admin/agent-models`          | Modelos recomendados, validación        |
| Onboarding           | `/onboarding`                  | Flujo de primer uso                     |

#### F.5 — Routing (app.tsx)

```tsx
// Antes:
<Route path="/docs" element={<DocsPage />} />

// Después:
<Route path="/docs" element={<DocsLayout />}>
  <Route index element={<Navigate to="quickstart" replace />} />
  <Route path="quickstart" element={<DocsQuickstartPage />} />
  <Route path="platform-behavior" element={<DocsPlatformBehaviorPage />} />
  <Route path="agents" element={<DocsAgentsPage />} />
  <Route path="agent-flow" element={<DocsAgentFlowPage />} />
  <Route path="agent-config" element={<DocsAgentConfigPage />} />
  <Route path="trade-execution" element={<DocsTradeExecutionPage />} />
  <Route path="binance" element={<DocsBinancePage />} />
  <Route path="operation-modes" element={<DocsOperationModesPage />} />
  <Route path="llm-providers" element={<DocsLLMProvidersPage />} />
  <Route path="api-keys" element={<DocsAPIKeysPage />} />
  <Route path="faq" element={<DocsFAQPage />} />
</Route>

// Hash redirects para backward compatibility
<Route path="/docs#faq" element={<Navigate to="/docs/faq" replace />} />
// etc.
```

#### F.6 — Estructura de archivos

```
apps/web/src/pages/docs/
├── layout.tsx                    ← DocsLayout (3 columnas + Outlet)
├── quickstart.tsx                ← FAQ + Guide fusionados
├── platform-behavior.tsx         ← Comportamiento, Stop All, warnings
├── agents.tsx                    ← 8 agentes, showcase, roles
├── agent-flow.tsx                ← Ciclo decisión, flujo, diagrama
├── agent-config.tsx              ← Presets, parámetros, conceptos
├── trade-execution.tsx           ← Buy/Sell flow, reglas, ejemplos
├── binance.tsx                   ← Integración, pares, comisiones, seguridad
├── operation-modes.tsx           ← Sandbox, Testnet, Live
├── llm-providers.tsx             ← 7 providers, tabla modelos, presets
├── api-keys.tsx                  ← OpenRouter, Binance, Claude, OpenAI, Groq
├── faq.tsx                       ← FAQ expandido
└── index.ts                      ← Re-exports + page metadata

libs/ui/src/lib/docs/
├── (componentes existentes A-E)
├── docs-layout.tsx               ← Layout 3 columnas
├── docs-toc.tsx                  ← Table of Contents scroll-spy
├── docs-search.tsx               ← Buscador fuzzy local
├── docs-pagination.tsx           ← Footer prev/next
├── docs-breadcrumb.tsx           ← Breadcrumb
├── docs-sidebar.tsx              ← Evolución de HelpSidebar para multi-page
└── index.ts                      ← Actualizar barrel

docs/content/
└── docs-content.md               ← Contenido fuente de verdad (MD)
```

---

## 6. Out of scope

- Server-side rendering (SSR) para SEO de la documentación
- Versionado de documentación
- Documentación de API REST (ya existe swagger en Spec 14)
- Traducción de contenido nuevo a idiomas más allá de EN/ES
- Generación automática de docs desde código

---

## 7. Decisiones de diseño

| #   | Decisión                                                     | Alternativa                                            | Razón                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Componentes de docs en `libs/ui`                             | Componentes locales en `apps/web/src/components/docs/` | Reutilizables, testables independientemente, siguen convención del proyecto                                                                                                                                                                                                            |
| 2   | ~~Single page scrollable~~ **Multi-page con nested routing** | Single page scrollable                                 | **ACTUALIZADO v1.1:** Análisis del diseño de OpenRouter Docs reveló que cada item del sidebar es una página independiente con su propio TOC scroll-spy. Multi-page permite: contenido modular, carga bajo demanda, URLs compartibles por sección, TOC por página, y mejor DX al editar |
| 3   | `/docs` en vez de `/help`                                    | Mantener `/help`                                       | `/docs` es el estándar de la industria (OpenRouter, Stripe, etc.)                                                                                                                                                                                                                      |
| 4   | Redirect 301 de `/help` a `/docs`                            | No redirect                                            | Preservar bookmarks y links externos existentes                                                                                                                                                                                                                                        |
| 5   | Diseño **idéntico** a OpenRouter Docs                        | Diseño custom                                          | OpenRouter Docs es la referencia explícita del usuario; layout 3-columnas probado y limpio                                                                                                                                                                                             |
| 6   | i18n strings en archivos existentes                          | Markdown files para docs                               | Mantener consistencia con el sistema i18n ya implementado                                                                                                                                                                                                                              |
| 7   | Reescritura completa de `help.tsx` → `docs.tsx`              | Refactor incremental                                   | La cantidad de cambios justifica reescritura; el archivo actual tiene 1075 líneas de componentes inline                                                                                                                                                                                |
| 8   | Buscador local (fuzzy search en títulos/contenido)           | Algolia/fulltext search                                | Scope acotado: buscamos entre ~15 páginas de docs, no necesitamos infraestructura de búsqueda externa                                                                                                                                                                                  |
| 9   | Paginado footer (Previous / Next) por página                 | Sin paginado                                           | OpenRouter usa este patrón; mejora navegación secuencial entre páginas                                                                                                                                                                                                                 |
| 10  | Contenido base en MD como fuente de verdad                   | Hardcoded en componentes                               | MD sirve de contexto para generar contenido, facilita revisión y auditoría                                                                                                                                                                                                             |
