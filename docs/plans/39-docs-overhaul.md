# Plan 39 — Documentación: Rediseño visual + verificación de contenido

**Spec:** docs/specs/branches/39-docs-overhaul.md
**Branch:** feature/docs-overhaul
**Depende de:** Spec 38 mergeada en main

---

## Estado inicial requerido

```bash
# Spec 38 mergeada
git log main --oneline -5 | grep -i "llm-provider-toggle\|spec-38"

# Branch actual
git checkout main && git pull origin main
git checkout -b feature/docs-overhaul
```

---

## Fase A — Componentes UI de documentación (`libs/ui`)

### A.1 Crear directorio y componentes

```bash
mkdir -p libs/ui/src/lib/docs
```

Crear los siguientes archivos:

| Archivo                   | Componente          | Props clave                                                         |
| ------------------------- | ------------------- | ------------------------------------------------------------------- |
| `docs-callout.tsx`        | `DocsCallout`       | `variant: 'info'\|'warning'\|'tip'\|'danger'`, `title?`, `children` |
| `docs-code-block.tsx`     | `DocsCodeBlock`     | `code`, `language?`, `title?`, `showLineNumbers?`, `copyable?`      |
| `docs-card.tsx`           | `DocsCard`          | `icon?`, `title`, `description`, `href?`, `badge?`                  |
| `docs-section-header.tsx` | `DocsSectionHeader` | `id`, `icon?`, `children`, `level?`                                 |
| `docs-steps.tsx`          | `DocsSteps`         | `steps: {title, description}[]`                                     |
| `docs-table.tsx`          | `DocsTable`         | `headers`, `rows`, `variant?`                                       |
| `docs-badge.tsx`          | `DocsBadge`         | `variant`, `children`                                               |
| `docs-page-feedback.tsx`  | `DocsPageFeedback`  | (sin props, autónomo)                                               |
| `index.ts`                | barrel export       | —                                                                   |

### A.2 Re-export desde libs/ui

Agregar en `libs/ui/src/index.ts`:

```ts
export * from './lib/docs';
```

### A.3 Verificación

```bash
pnpm nx lint ui
pnpm nx build ui   # si existe target build
```

### Criterios de salida Fase A

- [x] 8 componentes creados y exportados
- [x] `DocsCallout` renderiza 4 variantes con ícono y color correcto
- [x] `DocsCodeBlock` muestra código con line numbers opcionales y botón copy
- [x] `DocsCard` es clickable cuando tiene `href`
- [x] `DocsSectionHeader` renderiza ancla copiable al hover
- [x] `DocsSteps` renderiza línea vertical conectando pasos numerados (description ahora opcional)
- [x] `DocsTable` renderiza con variante `overview` (primera col bold)
- [x] `DocsBadge` renderiza 5 variantes de color
- [x] Lint pasa sin errores nuevos

---

## Fase B — Rediseño visual de `/docs`

### B.1 Routing

En `apps/web/src/app/app.tsx`:

1. Cambiar `path="/help"` → `path="/docs"`
2. Agregar redirect: `<Route path="/help" element={<Navigate to="/docs" replace />} />`
3. Renombrar import: `HelpPage` → `DocsPage`

### B.2 Renombrar archivo

```bash
mv apps/web/src/pages/help.tsx apps/web/src/pages/docs.tsx
```

Actualizar el nombre de la función exportada: `HelpPage` → `DocsPage`

### B.3 Actualizar HelpSidebar

En `libs/ui/src/lib/domain/help/help-sidebar.tsx`:

- Agregar nuevos grupos al sidebar:
  - **OpenRouter & Models** (nueva sección)
  - **Operation Modes** (nueva sección)
- Mejorar visual: ajustar spacing, tipografía del indicador activo
- Agregar sección IDs para las nuevas secciones

### B.4 Reescribir `docs.tsx`

Reescribir usando los nuevos componentes de `libs/ui/docs`:

- Reemplazar `HelpSectionTitle` → `DocsSectionHeader`
- Reemplazar inline code blocks → `DocsCodeBlock`
- Reemplazar inline warnings → `DocsCallout`
- Reemplazar inline steps → `DocsSteps`
- Reemplazar inline tables → `DocsTable`
- Reemplazar inline badges → `DocsBadge`
- Agregar `DocsPageFeedback` al final
- Mantener `FaqItem` existente (ya está bien)
- Mantener IntersectionObserver y scroll behavior
- Mantener animaciones GSAP

### B.5 Agregar claves i18n

En `apps/web/src/locales/en.ts` y `es.ts`:

- Nuevas claves para secciones agregadas
- Mantener todas las claves existentes que sigan siendo relevantes

### B.6 Verificación

```bash
pnpm nx lint web
pnpm nx build web
```

### Criterios de salida Fase B

- [x] `/docs` renderiza correctamente con nuevo diseño
- [x] `/help` redirige a `/docs`
- [x] Sidebar muestra todas las secciones (antiguas + nuevas: Operation Modes, LLM Providers, OpenRouter)
- [x] IntersectionObserver funciona con las nuevas secciones
- [x] Scroll a hash funciona (`/docs#agent-flow`, etc.)
- [x] Diseño visual usa componentes Docs (DocsSectionHeader, DocsCallout, DocsCodeBlock, DocsSteps, DocsTable, DocsBadge, DocsPageFeedback)
- [x] Build y lint pasan

---

## Fase C — Verificación y actualización de contenido `/docs`

### C.1 Auditar contenido existente

Para cada sección, comparar con código fuente real:

```bash
# Agentes — verificar nombres, roles, codenames
grep -r "KRYPTO\|NEXUS\|FORGE\|SIGMA\|CIPHER\|AEGIS" apps/api/src/ libs/
grep -r "agentType\|AgentType" apps/api/src/

# Pares de trading
grep -r "BTCUSDT\|ETHUSDT\|BTCUSDC\|ETHUSDC" apps/api/src/ libs/

# Parámetros de configuración
cat apps/api/prisma/schema.prisma | grep -A 30 "model AgentConfig"

# Providers LLM
grep -r "OPENROUTER\|CLAUDE\|OPENAI\|GROQ\|GEMINI\|MISTRAL\|TOGETHER" apps/api/src/

# Modos de operación
grep -r "SANDBOX\|TESTNET\|LIVE\|OperationMode" apps/api/src/ libs/

# Presets
grep -r "free\|balanced\|optimized" apps/api/src/ --include="*.ts" | grep -i preset
```

### C.2 Corregir contenido

- Actualizar claves i18n con información correcta
- Eliminar información obsoleta
- Agregar información faltante

### C.3 Agregar secciones nuevas

1. **OpenRouter Integration** — cómo funciona, catálogo, cache 15min, provider recomendado
2. **Presets Inteligentes** — tabla de modelos recomendados por agente y tier, fallback behavior
3. **Agent Models Configuration** — cómo cambiar modelo por agente, validación live, click-to-apply
4. **LLM Providers** — tabla completa, toggle admin, providers activos/inactivos
5. **Operation Modes** — Sandbox/Testnet/Live con diferencias detalladas

### C.4 Documentar cambios Spec 38

- Admin toggle de providers
- Presets inteligentes con validación
- Modelos recomendados por agente
- Modelo fallback por tier

### Criterios de salida Fase C

- [x] Todos los nombres de agentes verificados contra código (8 agentes: routing, orchestrator, synthesis, platform, operations, market, blockchain, risk)
- [x] Providers LLM listados coinciden con implementación (7: OPENROUTER, CLAUDE, OPENAI, GROQ, GEMINI, MISTRAL, TOGETHER)
- [x] Pares de trading verificados (4: BTCUSDT, BTCUSDC, ETHUSDT, ETHUSDC)
- [x] Parámetros de configuración documentados coinciden con schema Prisma
- [x] Secciones nuevas (Operation Modes, LLM Providers con tabla de modelos recomendados, OpenRouter API key) agregadas
- [x] Features de Spec 38 documentadas (presets, recommended models table)
- [x] i18n EN/ES: nuevas claves usan t() con defaultValue fallback

---

## Fase D — Verificación de Landing Page (Home)

### D.1 Auditar contenido landing

```bash
# Verificar agentes en landing
grep -A5 "AgentProfileCard" apps/web/src/pages/landing.tsx

# Verificar providers en landing
grep -A5 "ProviderCard" apps/web/src/pages/landing.tsx

# Verificar modos en landing
grep -A5 "ModeCard" apps/web/src/pages/landing.tsx

# Verificar features
grep -A5 "FeatureCard" apps/web/src/pages/landing.tsx
```

### D.2 Corregir landing

Cambios esperados:

- **Agentes:** landing muestra 5 (NEXUS, FORGE, SIGMA, CIPHER, AEGIS). Faltan los 3 KRYPTO (routing, orchestrator, synthesis). Agregar o reorganizar para reflejar los 8 agentes reales.
- **Providers:** verificar que todos los listados estén activos.
- **Features:** agregar features nuevas (OpenRouter integration, presets inteligentes) si aplica.
- **Stats:** verificar que no sean placeholder engañosos.
- **Footer link:** `/help` → `/docs`.

### D.3 Actualizar i18n

Corregir claves de landing en `en.ts` y `es.ts`.

### Criterios de salida Fase D

- [x] Landing muestra agentes correctos (5 codenames: NEXUS, FORGE, SIGMA, CIPHER, AEGIS — KRYPTO es orchestrator interno)
- [x] Providers LLM en landing coinciden con implementación (7 providers, OpenRouter featured)
- [x] Features reflejan funcionalidad real (6 feature cards)
- [x] Stats no son engañosos (5 agents, 7 providers, 4 pairs, 24/7, 3 modes)
- [x] Footer apunta a `/docs`

---

## Fase E — Links, E2E y cleanup

### E.1 Actualizar links internos

```bash
# Buscar todas las referencias a /help
grep -rn '"/help"' apps/web/src/ libs/
grep -rn "'/help'" apps/web/src/ libs/
grep -rn '/help' e2e/
```

Actualizar cada referencia:

- `apps/web/src/pages/landing.tsx` → footer link
- `apps/web/src/app/app.tsx` → routing (ya hecho en B.1)
- `apps/web/src/pages/admin/help.tsx` → evaluar renombrar o mantener
- `e2e/*.spec.ts` → actualizar paths en tests

### E.2 Actualizar E2E tests

- `landing.unauth.spec.ts` → actualizar si testea link a /help
- `navigation.spec.ts` → actualizar path assertions

### E.3 Cleanup

- Eliminar imports/exports innecesarios de `HelpPage` si fueron renombrados
- Verificar que no queden archivos huérfanos

### E.4 Verificación final

```bash
pnpm nx lint web
pnpm nx lint ui
pnpm nx build web
pnpm nx test web
pnpm nx e2e web-e2e  # si es posible en local
```

### Criterios de salida Fase E

- [x] Cero referencias a `/help` en el código (excepto el redirect)
- [x] E2E tests actualizados (`auth.unauth.spec.ts` migrado a `/docs`)
- [x] Build limpio (lint 0 errors)
- [x] Lint sin errores nuevos

---

## Fase F — Multi-page layout + OpenRouter-like design (v1.1)

> **Contexto:** Fases A-E construyeron los componentes base y contenido en single-page. Fase F transforma todo en un sistema multi-page idéntico al diseño de OpenRouter Docs.

### F.1 — Generar documento de contenido (MD fuente de verdad)

**Objetivo:** Antes de tocar código, generar `docs/content/docs-content.md` con todo el contenido organizado por página.

**Proceso:**

1. Revisar CADA página de la plataforma (dashboard, settings, admin, etc.)
2. Extraer conceptos, flujos y terminología útil para el usuario
3. Organizar en secciones por página de docs
4. Incluir subsecciones H2 que serán las entradas del TOC scroll-spy
5. Generar contenido bilingüe (EN/ES)

```bash
# Páginas a revisar para extraer contenido
grep -rn "path=" apps/web/src/app/app.tsx  # Todas las rutas
ls apps/web/src/pages/dashboard/            # Páginas del dashboard
ls apps/web/src/pages/admin/                # Páginas admin
cat apps/web/src/pages/dashboard/config.tsx # Ejemplo: config del agente
```

**Entregable:** `docs/content/docs-content.md` (~500-800 líneas) con:

- Contenido para cada una de las 11 páginas de docs
- Subsecciones H2 marcadas (se convierten en TOC entries)
- Contenido EN y ES

### F.2 — Nuevos componentes UI en `libs/ui/docs/`

Crear los siguientes componentes nuevos:

| Componente       | Archivo               | Descripción                                                                    |
| ---------------- | --------------------- | ------------------------------------------------------------------------------ |
| `DocsLayout`     | `docs-layout.tsx`     | Layout 3 columnas: sidebar + content + TOC. Usa `<Outlet />` de react-router   |
| `DocsTOC`        | `docs-toc.tsx`        | "On this page" — detecta H2 del contenido, scroll-spy con IntersectionObserver |
| `DocsSearch`     | `docs-search.tsx`     | Input con shortcut `/`, fuzzy match sobre array de páginas, dropdown           |
| `DocsPagination` | `docs-pagination.tsx` | Footer "← Previous" / "Next →" con título                                      |
| `DocsBreadcrumb` | `docs-breadcrumb.tsx` | Breadcrumb: grupo > página actual                                              |
| `DocsSidebar`    | `docs-sidebar.tsx`    | Evolución de HelpSidebar: usa NavLink, highlight por ruta activa               |

**Diseño de referencia (extraído de OpenRouter Docs):**

```
DocsTOC:
- Sticky, right column, ~200px
- "On this page" header en text-xs uppercase tracking-wide muted
- Lista de H2 en text-sm
- Item activo: text-primary border-l-2 border-primary
- Items inactivos: text-muted-foreground hover:text-foreground

DocsSearch:
- Input con bg-muted/50, border, rounded-lg
- Placeholder: "Search documentation..."
- Shortcut hint: "/" badge a la derecha
- Dropdown: fondo card, sombra, max-h-80 overflow-y-auto
- Resultado: título bold + descripción truncada + grupo badge
- Keyboard navigation: ↑↓ + Enter

DocsPagination:
- Border-top separator
- 2 columnas: prev (align-left) y next (align-right)
- Cada uno: label muted ("Previous"/"Next") + título de la página en font-medium
- Hover: bg-muted/50 rounded
```

```bash
# Verificación
pnpm nx lint ui
```

### F.3 — Crear estructura de páginas

Crear directorio y archivos para las 11 páginas:

```bash
mkdir -p apps/web/src/pages/docs
```

| Archivo                 | Ruta                      | Contenido actual (migrar desde docs.tsx)      |
| ----------------------- | ------------------------- | --------------------------------------------- |
| `layout.tsx`            | `/docs` wrapper           | DocsLayout + sidebar + TOC + Outlet           |
| `quickstart.tsx`        | `/docs/quickstart`        | FAQ + Guide (primeros pasos)                  |
| `platform-behavior.tsx` | `/docs/platform-behavior` | Behaviors + Stop All                          |
| `agents.tsx`            | `/docs/agents`            | AgentsShowcase + roles                        |
| `agent-flow.tsx`        | `/docs/agent-flow`        | Decisión, ciclo, diagrama                     |
| `agent-config.tsx`      | `/docs/agent-config`      | Presets + Params + ExplainPanel               |
| `trade-execution.tsx`   | `/docs/trade-execution`   | Buy/Sell flow + reglas                        |
| `binance.tsx`           | `/docs/binance`           | Integración + pares + comisiones              |
| `operation-modes.tsx`   | `/docs/operation-modes`   | Sandbox/Testnet/Live                          |
| `llm-providers.tsx`     | `/docs/llm-providers`     | 7 providers + tabla modelos                   |
| `api-keys.tsx`          | `/docs/api-keys`          | OpenRouter + Binance + Claude + OpenAI + Groq |
| `faq.tsx`               | `/docs/faq`               | FAQ expandido                                 |
| `index.ts`              | —                         | Page metadata + re-exports                    |

**`index.ts` — Metadata para sidebar, search, paginado:**

```tsx
export interface DocsPageMeta {
  slug: string;
  title: string;
  description: string;
  group: string;
  icon: React.ComponentType;
  keywords: string[];
}

export const DOCS_PAGES: DocsPageMeta[] = [
  { slug: 'quickstart', title: 'Quickstart', group: 'Getting Started', ... },
  // ...
];
```

### F.4 — Actualizar routing (app.tsx)

```tsx
// Reemplazar:
<Route path="/docs" element={<DocsPage />} />

// Por:
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

// Backward compatibility
<Route path="/help" element={<Navigate to="/docs/quickstart" replace />} />
```

### F.5 — Migrar contenido de docs.tsx → páginas individuales

Para cada página:

1. Extraer la sección correspondiente de `docs.tsx` (1150 líneas)
2. Usar los componentes Docs (DocsSectionHeader, DocsCallout, DocsSteps, DocsTable, etc.)
3. Agregar metadata para TOC (H2 con ids)
4. Agregar prev/next para paginado
5. Mantener i18n existente + agregar nuevas claves
6. Enriquecer contenido basado en `docs/content/docs-content.md`

**Orden de migración (por dependencia):**

1. `layout.tsx` — primero el wrapper
2. `index.ts` — metadata de todas las páginas
3. `quickstart.tsx` — primera página visible
4. Resto de páginas en orden del sidebar

### F.6 — Eliminar docs.tsx antiguo

Una vez todas las páginas estén migradas:

1. Eliminar `apps/web/src/pages/docs.tsx` (el archivo single-page de 1150 líneas)
2. Eliminar `HelpSidebar` de `libs/ui` (reemplazado por `DocsSidebar`)
3. Cleanup de imports huérfanos

### F.7 — Actualizar i18n

Agregar claves para los nuevos componentes:

```
docs.search.placeholder: "Search documentation..."
docs.search.noResults: "No results found"
docs.toc.title: "On this page"
docs.pagination.previous: "Previous"
docs.pagination.next: "Next"
docs.breadcrumb.docs: "Documentation"
docs.feedback.title: "Was this page helpful?"
```

### F.8 — Actualizar E2E tests

- Actualizar paths en tests existentes (`/docs` → `/docs/quickstart`, etc.)
- Tests de navegación sidebar → verifica cambio de ruta
- Test de backward compatibility redirects

### F.9 — Verificación final

```bash
pnpm nx lint ui web --skip-nx-cache
pnpm nx build web --skip-nx-cache
pnpm nx test web --skip-nx-cache
```

### Criterios de salida Fase F

- [ ] `DocsLayout` renderiza 3 columnas (sidebar | content | TOC) en desktop
- [ ] `DocsTOC` muestra H2 de la página activa con scroll-spy funcionando
- [ ] `DocsSearch` busca fuzzy entre todas las páginas de docs, shortcut `/` funciona
- [ ] `DocsPagination` muestra prev/next correcto en cada página
- [ ] `DocsSidebar` navega entre páginas (NavLink), highlight en ruta activa
- [ ] 11 páginas de docs renderizando contenido migrado + enriquecido
- [ ] `/docs` redirige a `/docs/quickstart`
- [ ] `/help` redirige a `/docs/quickstart`
- [ ] `/docs#section` hash redirects funcionan
- [ ] Responsive: mobile muestra sidebar como drawer, TOC oculto
- [ ] `docs/content/docs-content.md` generado como fuente de verdad
- [ ] i18n EN/ES para todas las nuevas claves
- [ ] Lint 0 errors, build limpio
- [ ] E2E tests actualizados

---

## Criterios de aceptación globales (v1.1 actualizado)

**Fases A-E (completadas):**

- [x] `/docs` renderiza con diseño visual mejorado usando componentes Docs
- [x] `/help` redirige correctamente a `/docs`
- [x] 8 componentes de documentación reutilizables en `libs/ui`
- [x] Todo el contenido de `/docs` verificado contra implementación real
- [x] Landing page con información correcta y actualizada
- [x] Features de Spec 38 documentadas (presets, tabla de modelos recomendados)
- [x] Secciones nuevas: LLM Providers (con tabla), Operation Modes, OpenRouter API key
- [x] i18n: nuevas claves con EN/ES completas
- [x] Lint pasa (0 errors, warnings preexistentes)
- [x] Cero referencias a `/help` (excepto redirect)

**Fase F (nueva):**

- [ ] Multi-page con 11 páginas de docs + layout 3 columnas
- [ ] TOC scroll-spy "On this page" en columna derecha
- [ ] Buscador fuzzy local con shortcut `/`
- [ ] Paginado Previous/Next en footer de cada página
- [ ] Sidebar con NavLink y highlight por ruta activa
- [ ] Contenido enriquecido basado en análisis de cada pantalla de la plataforma
- [ ] `docs/content/docs-content.md` generado como fuente de verdad
- [ ] Backward compatibility: redirects de hash URLs y /help
- [ ] Responsive mobile: drawer sidebar, TOC oculto
- [ ] Diseño visualmente idéntico a OpenRouter Docs

---

## Cierre de branch

```bash
git add -A
git commit -m "feat(docs): multi-page documentation system — OpenRouter-like layout, 11 pages, search, TOC — Spec 39 v1.1"
git push origin feature/docs-overhaul

gh pr create \
  --base main \
  --head feature/docs-overhaul \
  --title "feat(docs): Spec 39 — Multi-page docs: OpenRouter-like layout + content overhaul" \
  --body "## Spec 39 v1.1 — Documentación: Multi-page + OpenRouter-like design

### Cambios principales

**Multi-page documentation system:**
- 11 páginas de docs con nested routing (/docs/quickstart, /docs/agents, etc.)
- Layout 3 columnas: DocsSidebar | Content | DocsTOC
- TOC scroll-spy 'On this page' con highlight de sección activa
- Buscador fuzzy local con shortcut /
- Paginado Previous/Next en cada página
- Breadcrumb de navegación

**Componentes UI (libs/ui/docs):**
- Fases A-E: DocsCallout, DocsCodeBlock, DocsCard, DocsSectionHeader, DocsSteps, DocsTable, DocsBadge, DocsPageFeedback
- Fase F: DocsLayout, DocsTOC, DocsSearch, DocsPagination, DocsBreadcrumb, DocsSidebar

**Contenido verificado y enriquecido:**
- Análisis de cada pantalla de la plataforma
- Contenido bilingüe EN/ES completo
- Fuente de verdad en docs/content/docs-content.md
- Features de Spec 38 documentadas

**Backward compatibility:**
- /help → /docs/quickstart redirect
- Hash URLs → page redirects
- E2E tests actualizados

Spec: docs/specs/branches/39-docs-overhaul.md
Plan: docs/plans/39-docs-overhaul.md"
```

Actualizar `docs/plans/crypto-trader-branch-plan.md`:

```markdown
| 39 | feature/docs-overhaul | 39-docs-overhaul.md | 38 |
```
