# Spec 34 — UI Design System Consolidation

**Fecha:** 2026-04-18
**Versión:** 1.0
**Estado:** Propuesto
**Branch:** `feature/ui-design-system-consolidation`
**Dependencias:** Spec 33 (bugfix-batch-ux-data)

---

## 1. Resumen ejecutivo

Migrar **todos** los componentes UI de `apps/web/src/components/` a la librería compartida `libs/ui/`, creando un design system coherente y consolidado. Los componentes se refactorizan para ser **stateless** (sin hooks de datos internos — sin TanStack Query, sin Zustand, sin hooks custom de dominio). Todos los datos se pasan exclusivamente vía props. Se eliminan componentes duplicados (ej. múltiples implementaciones de modales, dropdowns, selects) unificándolos en un solo componente configurable por variantes/props. Tras la migración, `apps/web` consume la UI directamente desde `@crypto-trader/ui`.

### Objetivos concretos

1. **Desacoplamiento total**: ningún componente en `libs/ui` importa hooks de datos (`use-trading`, `use-chat`, `use-market`, etc.), stores (Zustand), ni TanStack Query.
2. **Consolidación**: un solo componente por concepto UI (1 Modal, 1 Button, 1 Select/Dropdown, 1 Badge, 1 Input, 1 Sidebar, etc.).
3. **Design system**: tokens de diseño (colores, spacing, radii, typography) compartidos via CSS variables + Tailwind config.
4. **Consumo desde web**: `apps/web` importa `@crypto-trader/ui` para todos los componentes, manteniendo hooks y lógica de datos en el app layer.

---

## 2. Arquitectura / Diseño

### 2.1 Estructura final de `libs/ui`

```
libs/ui/src/
├── index.ts                        ← barrel export público
├── lib/
│   ├── utils.ts                    ← cn(), helpers de clase
│   ├── tokens/
│   │   └── tailwind-preset.ts      ← preset Tailwind con design tokens
│   ├── primitives/                 ← Componentes atómicos (stateless)
│   │   ├── typography.tsx          ← UN solo componente: variantes h1-h6, body, caption, mono, label, code, overline
│   │   ├── button.tsx              ← incluye size="icon" para icon-only (absorbe icon-button)
│   │   ├── input.tsx               ← incluye type="password" con toggle built-in (absorbe password-input)
│   │   ├── badge.tsx               ← unifica StatusBadge + otros badges
│   │   ├── info-tooltip.tsx
│   │   ├── spinner.tsx
│   │   ├── progress-bar.tsx        ← barra de progreso con color dinámico
│   │   ├── copy-button.tsx         ← copiar al clipboard con feedback
│   │   ├── form-field.tsx          ← label + children wrapper consistente
│   │   ├── separator.tsx           ← separador horizontal/vertical semántico
│   │   ├── toggle-switch.tsx       ← switch on/off estilizado
│   │   └── avatar.tsx              ← avatar circular con iniciales + status dot
│   ├── composites/                 ← Componentes compuestos (stateless)
│   │   ├── select.tsx              ← unifica custom-select + llm-selector + mode dropdowns
│   │   ├── dialog.tsx              ← UN solo componente: variant "default" | "confirm" | "danger" (absorbe modal + confirm-dialog)
│   │   ├── dropdown.tsx            ← unifica avatar-dropdown, login-dropdown, notifications-dropdown pattern
│   │   ├── data-table.tsx
│   │   ├── card.tsx                ← UN solo componente genérico con header/footer/actions slots (absorbe settings-card)
│   │   ├── sidebar.tsx             ← layout sidebar, sin datos de rutas hardcoded
│   │   ├── tabs.tsx                ← tabs genérico (hoy inline en 6+ páginas)
│   │   ├── pagination.tsx          ← paginación con window + ellipsis
│   │   ├── filter-pills.tsx        ← grupo de pills para filtrar datos
│   │   ├── slider-field.tsx        ← slider con label + value display
│   │   ├── stepper.tsx             ← wizard stepper con progress dots
│   │   ├── collapsible.tsx         ← sección expandible/colapsable
│   │   ├── key-value-row.tsx       ← fila label-value (DetailRow unificado)
│   │   └── section-title.tsx       ← título de sección con icono
│   ├── charts/                     ← Wrappers de charts con theme tokens
│   │   ├── chart-card.tsx          ← card contenedora para gráficos
│   │   ├── chart-tooltip.tsx       ← tooltip custom para Recharts
│   │   ├── line-chart.tsx          ← wrapper LineChart pre-configurado
│   │   ├── area-chart.tsx          ← wrapper AreaChart pre-configurado
│   │   ├── bar-chart.tsx           ← wrapper BarChart pre-configurado
│   │   ├── pie-chart.tsx           ← wrapper PieChart pre-configurado
│   │   └── candlestick-chart.tsx   ← wrapper lightweight-charts
│   ├── layout/                     ← Componentes de estructura
│   │   ├── navbar.tsx              ← shell del navbar, slots para contenido
│   │   ├── dashboard-header.tsx    ← header genérico con slots
│   │   ├── page-layout.tsx         ← wrapper de página dashboard
│   │   └── sidebar-layout.tsx      ← layout con sidebar + contenido
│   ├── feedback/                   ← Componentes de estado/feedback
│   │   ├── empty-state.tsx
│   │   ├── loading-skeleton.tsx
│   │   ├── error-boundary.tsx
│   │   ├── callout.tsx             ← banner informativo/warning/danger/tip
│   │   └── connection-status.tsx   ← indicador de estado de conexión (sin WS hook)
│   ├── domain/                     ← Componentes de dominio (stateless, tipados)
│   │   ├── chat/
│   │   │   ├── chat-input.tsx
│   │   │   ├── chat-messages.tsx
│   │   │   ├── chat-session-panel.tsx
│   │   │   ├── agent-header.tsx
│   │   │   ├── agent-selector.tsx
│   │   │   ├── capability-buttons.tsx
│   │   │   ├── tool-call-card.tsx
│   │   │   └── orchestrating-indicator.tsx
│   │   ├── agent/
│   │   │   ├── decision-flow-diagram.tsx
│   │   │   ├── explain-panel.tsx
│   │   │   ├── parameter-cards.tsx
│   │   │   └── strategy-presets.tsx
│   │   ├── market/
│   │   │   ├── price-ticker.tsx
│   │   │   ├── stat-card.tsx       ← unifica MetricCard + StatCard
│   │   │   └── indicator-info-modal.tsx
│   │   ├── settings/
│   │   │   ├── ai-usage-dashboard.tsx
│   │   │   ├── provider-status-grid.tsx
│   │   │   ├── news-config-panel.tsx
│   │   │   └── dynamic-model-select.tsx
│   │   ├── notifications/
│   │   │   └── notifications-dropdown.tsx
│   │   └── help/
│   │       └── help-sidebar.tsx
│   └── theme/
│       └── theme-provider.tsx      ← dark/light mode (puro CSS, sin Zustand)
```

### 2.2 Reglas de diseño

| Regla                  | Descripción                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Sin hooks de datos** | Ningún componente importa `use-trading`, `use-chat`, `use-market`, etc.                                                |
| **Sin stores**         | Ningún import de Zustand stores dentro de `libs/ui`                                                                    |
| **Sin TanStack Query** | Nada de `useQuery`, `useMutation` dentro de `libs/ui`                                                                  |
| **Sin i18n directo**   | Los componentes reciben texto ya traducido vía props (strings). No importan `useTranslation`.                          |
| **Sin router**         | Ningún `useNavigate`, `useLocation`, `Link`. Se usan callbacks (`onNavigate`, `renderLink`) o componentes slot.        |
| **Props-only**         | Toda data entra por props, toda acción sale por callbacks                                                              |
| **cn() local**         | `libs/ui` tiene su propia copia de `cn()` (clsx + twMerge)                                                             |
| **Lucide icons**       | Los iconos se pasan como props `icon?: React.ReactNode` o se importan directamente de lucide-react (dependencia de ui) |

### 2.3 Dependencias de `libs/ui`

```json
{
  "dependencies": {
    "react": "^19.x",
    "clsx": "^2.x",
    "tailwind-merge": "^3.x",
    "lucide-react": "^1.x",
    "@radix-ui/react-slot": "^1.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-tooltip": "^1.x",
    "@radix-ui/react-tabs": "^1.x",
    "@radix-ui/react-dropdown-menu": "^1.x",
    "@radix-ui/react-collapsible": "^1.x",
    "recharts": "^3.x",
    "lightweight-charts": "^5.x"
  },
  "peerDependencies": {
    "react": "^19.x",
    "react-dom": "^19.x"
  }
}
```

> **Nota:** Recharts y lightweight-charts se mueven a la lib UI como dependencias directas. `apps/web` deja de depender directamente de ellas — las consume a través de los wrappers de `@crypto-trader/ui/charts`.

### 2.4 Tailwind Preset

`libs/ui` expone un **Tailwind preset** que `apps/web` (y futuros consumidores) importan. Contiene:

- Design tokens (colores semánticos via CSS variables)
- Escalas de spacing, border-radius, typography
- Animaciones compartidas (fade-up, scale-in, shimmer, etc.)
- Font families (Inter + JetBrains Mono)

```js
// apps/web/tailwind.config.js
const uiPreset = require('@crypto-trader/ui/tailwind-preset');
module.exports = {
  presets: [uiPreset],
  content: [
    /* ... */
  ],
};
```

---

## 3. Inventario de componentes a migrar

### 3.1 Componentes UI primitivos (`components/ui/`)

| Componente actual    | Acción                                                                      | Destino en `libs/ui`          |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------- |
| `button.tsx`         | Migrar + absorber `icon-button` (variante `size: 'icon'`)                   | `primitives/button.tsx`       |
| `input.tsx`          | Migrar + absorber `password-input` (`type: 'password'` con toggle built-in) | `primitives/input.tsx`        |
| `password-input.tsx` | **ABSORBIDO** por `input.tsx` — se elimina                                  | N/A                           |
| `status-badge.tsx`   | Migrar + consolidar                                                         | `primitives/badge.tsx`        |
| `info-tooltip.tsx`   | Migrar                                                                      | `primitives/info-tooltip.tsx` |
| `custom-select.tsx`  | Migrar + consolidar con otros selects                                       | `composites/select.tsx`       |
| `data-table.tsx`     | Migrar                                                                      | `composites/data-table.tsx`   |
| `settings-card.tsx`  | **ABSORBIDO** por `card.tsx` — layout via slots/composición                 | N/A                           |
| `sidebar.tsx`        | Refactor + migrar (quitar rutas hardcoded, router, i18n)                    | `composites/sidebar.tsx`      |

### 3.2 Componentes layout/shared (`components/`)

| Componente actual                | Acción                                         | Destino en `libs/ui`                              |
| -------------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `navbar.tsx`                     | Refactor (quitar hooks) + migrar               | `layout/navbar.tsx`                               |
| `dashboard-header.tsx`           | Refactor + migrar                              | `layout/dashboard-header.tsx`                     |
| `theme-provider.tsx`             | Migrar (mantener puro CSS)                     | `theme/theme-provider.tsx`                        |
| `price-ticker.tsx`               | Refactor (quitar `useLivePrices`) + migrar     | `domain/market/price-ticker.tsx`                  |
| `avatar-dropdown.tsx`            | Refactor + consolidar en Dropdown genérico     | `composites/dropdown.tsx` + uso en web            |
| `login-dropdown.tsx`             | Refactor + consolidar en Dropdown genérico     | `composites/dropdown.tsx` + uso en web            |
| `connection-status-dropdown.tsx` | Refactor                                       | `feedback/connection-status.tsx`                  |
| `notifications-dropdown.tsx`     | Refactor (quitar `useNotifications`)           | `domain/notifications/notifications-dropdown.tsx` |
| `mode-selector.tsx`              | Refactor (quitar hooks)                        | `domain/settings/mode-selector.tsx`               |
| `protected-route.tsx`            | **NO migrar** — es lógica de routing de la app | Se queda en `apps/web`                            |

### 3.3 Componentes de dominio (`components/chat/`, `agent/`, etc.)

| Grupo            | Componentes                                                                                                                                                                            | Acción                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Chat** (11)    | agent-header, agent-selector, capability-buttons, chat-input, chat-llm-override, chat-messages, chat-session-panel, chat-widget, llm-selector, orchestrating-indicator, tool-call-card | Refactor (quitar `useChat`, `useLlm`, `useChatAgent`) → props-only → migrar a `domain/chat/` |
| **Agent** (4)    | decision-flow-diagram, explain-panel, parameter-cards, strategy-presets                                                                                                                | Refactor (quitar i18n) → props-only → migrar a `domain/agent/`                               |
| **Market** (1)   | indicator-info-modal                                                                                                                                                                   | Refactor → migrar usando `Modal` unificado                                                   |
| **Settings** (4) | ai-usage-dashboard, dynamic-model-select, news-config-panel, provider-status-grid                                                                                                      | Refactor (quitar `useLlm`, `useUser`) → props-only → migrar a `domain/settings/`             |
| **Help** (1)     | help-sidebar                                                                                                                                                                           | Refactor (quitar i18n, router) → migrar                                                      |

### 3.4 Componentes nuevos a crear (consolidación de patrones inline)

#### Primitivos (`primitives/`)

| Componente          | Razón                                             | Instancias actuales                                                     |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `spinner.tsx`       | Spinner/loader genérico (Loader2 estilizado)      | ~15 usos de `animate-spin` inline                                       |
| `progress-bar.tsx`  | Barra de progreso con color dinámico              | agent-log (confidence), bot-analysis (sentiment, countdown) — 3+ impl.  |
| `copy-button.tsx`   | Copiar al clipboard con feedback "copied"         | chat-messages (1 impl., reutilizable)                                   |
| `form-field.tsx`    | Wrapper `<label>` + children consistente          | config (~18), settings (~10), onboarding (~5) = ~33 instancias          |
| `separator.tsx`     | Separador horizontal/vertical semántico           | ~80 instancias de `border-t border-border` / `divide-y` en 15+ archivos |
| `toggle-switch.tsx` | Switch on/off (role="switch") estilizado          | news-config-panel (2 usos), patrón reutilizable                         |
| `avatar.tsx`        | Avatar circular con iniciales/imagen + status dot | avatar-dropdown, sidebar, onboarding, chat — 4+ implementaciones        |

> **Componentes absorbidos (NO son archivos separados):**
>
> - `icon-button` → absorbido por `button.tsx` con `size: 'icon'` (~30 instancias)
> - `password-input` → absorbido por `input.tsx` con `type: 'password'` + toggle de visibilidad built-in

#### Compuestos (`composites/`)

| Componente   | Razón                                                                                                                                                                                                                                       | Instancias actuales                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dialog.tsx` | **UN solo componente** Dialog con `variant: 'default' \| 'confirm' \| 'danger'`. Default = modal estándar. Confirm = con botones confirmar/cancelar. Danger = confirmación destructiva roja. Radix Dialog. (absorbe modal + confirm-dialog) | agent-log, bot-analysis, config (×4+deleteModal), news-feed, positions, trade-history, chat-session-panel, llm-selector, connection-status, help-sidebar, indicator-info-modal, mode-selector (×3), notifications, sidebar |
| `tabs.tsx`   | Tabs genérico con icon + count + badge                                                                                                                                                                                                      | agent-log, bot-analysis, market, notifications, positions, settings — 6 implementaciones                                                                                                                                   |
| `card.tsx`   | **UN solo componente** Card genérico con slots: `header`, `footer`, `actions` (absorbe settings-card — el layout settings se logra componiendo slots)                                                                                       | ~200 instancias del patrón + settings-card                                                                                                                                                                                 |

> **Componentes absorbidos (NO son archivos separados):**
>
> - `confirm-dialog` → absorbido por `dialog.tsx` con `variant: 'confirm' | 'danger'` + props `onConfirm`, `confirmLabel`, `isPending`
> - `settings-card` → absorbido por `card.tsx` — el layout de settings se logra componiendo `<Card header={...} actions={...}>` con slots
>   | `pagination.tsx` | Paginación con window + ellipsis (~50 líneas repetidas) | agent-log, notifications, positions — 3 impl. idénticas |
>   | `filter-pills.tsx` | Grupo de pills/chips para filtrar datos | agent-log (PillGroup), notifications, positions — 3+ impl. |
>   | `slider-field.tsx` | Slider con label + value display + range input | config (SliderField + StepperSlider — 2 variantes, ~10 usos) |
>   | `stepper.tsx` | Wizard stepper con progress dots, step navigation, header | onboarding (3 steps), config (7 steps) — 2 implementaciones |
>   | `collapsible.tsx` | Sección expandible/colapsable con chevron | agent-log (expand details), help-sidebar (tree nav) — 2+ impl. |
>   | `key-value-row.tsx` | Fila label-value alineada (DetailRow / StateDetailRow) | agent-log, bot-analysis — código 100% idéntico duplicado |
>   | `section-title.tsx` | Título de sección con icono (SectionTitle / StateSectionTitle) | agent-log, bot-analysis, help — 3 impl. idénticas |

#### Layout (`layout/`)

| Componente        | Razón                                                         | Instancias actuales                                 |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `page-layout.tsx` | Wrapper de página dashboard con padding/max-width consistente | ~18 páginas usan padding similar pero inconsistente |

#### Feedback (`feedback/`)

| Componente             | Razón                                 | Instancias actuales                                                   |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `empty-state.tsx`      | "No hay datos" con icono + mensaje    | config, chat, news-feed, positions, notifications, trade-history — 6+ |
| `loading-skeleton.tsx` | Skeleton loading (`animate-pulse`)    | overview, settings, positions, config, bot-analysis, market — 6+      |
| `callout.tsx`          | Banner informativo/warning/danger/tip | config (3 callouts), bot-analysis (status, score banner) — 5+         |

#### Charts (`charts/`)

| Componente              | Razón                                                          | Instancias actuales                                                                                                                |
| ----------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `chart-card.tsx`        | Card contenedora para gráficos (título + chart + empty state)  | overview (2 charts), analytics (2 charts), ai-usage-dashboard (3 charts) — 7+ instancias del patrón card+title+ResponsiveContainer |
| `chart-tooltip.tsx`     | Tooltip custom para Recharts (fondo oscuro, bordes, formato)   | overview (PnlTooltip, AssetTooltip) — patrón reutilizable para todos los charts                                                    |
| `line-chart.tsx`        | Wrapper pre-configurado de Recharts LineChart con theme tokens | analytics (1 uso)                                                                                                                  |
| `area-chart.tsx`        | Wrapper pre-configurado de Recharts AreaChart con theme tokens | overview (PnL chart)                                                                                                               |
| `bar-chart.tsx`         | Wrapper pre-configurado de Recharts BarChart con theme tokens  | overview, analytics, ai-usage-dashboard — 3+ usos                                                                                  |
| `pie-chart.tsx`         | Wrapper pre-configurado de Recharts PieChart con theme tokens  | ai-usage-dashboard (2 usos)                                                                                                        |
| `candlestick-chart.tsx` | Wrapper de lightweight-charts con config del theme             | live-chart, market — 2 instancias con ~100 líneas de setup repetidas                                                               |

> **Nota:** Los wrappers de charts NO reimplementan Recharts/lightweight-charts. Son thin wrappers que aplican theme tokens (colores, fonts, grid) y props por defecto del design system, eliminando la repetición de configuración.

#### Typography — UN solo componente (`primitives/typography.tsx`)

**Regla clave:** Typography es **UN solo componente** `<Typography>` con variantes que cubren TODOS los casos tipográficos. NO se crean archivos separados para heading, text, label, code.

| Datos del audit | Detalle                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| Tamaños         | 10: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl                        |
| Pesos           | 6: normal, medium, semibold, bold, extrabold, mono                       |
| Headings        | 109: 18 h1, 39 h2, 48 h3, 4 h4 — estilos inconsistentes                  |
| Labels          | ~33 instancias de `<label className="mb-1.5 block text-sm font-medium">` |
| Code/mono       | ~119 usos de `font-mono` para precios, IDs, hashes                       |

**API del componente:**

```tsx
interface TypographyProps {
  variant:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6' // headings
    | 'body'
    | 'body-sm' // texto general
    | 'caption' // metadata/secondary
    | 'mono' // font-mono tabular-nums
    | 'code' // inline code blocks
    | 'label' // form labels
    | 'overline'; // uppercase tiny
  as?: React.ElementType; // override del elemento HTML (default según variant)
  weight?: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';
  color?: 'default' | 'muted' | 'accent' | 'danger' | 'success';
  truncate?: boolean;
  className?: string;
  children: React.ReactNode;
}
```

**Mapeo variant → clases Tailwind:**

| Variante   | Elemento default | Clases base                                                                                  |
| ---------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `h1`       | `h1`             | `text-2xl font-bold` — títulos de página (18 instancias)                                     |
| `h2`       | `h2`             | `text-xl font-bold` — secciones dentro de página                                             |
| `h3`       | `h3`             | `text-lg font-semibold` — subtítulos                                                         |
| `h4`       | `h4`             | `text-base font-semibold` — títulos de cards                                                 |
| `h5`       | `h5`             | `text-sm font-semibold` — títulos menores                                                    |
| `h6`       | `h6`             | `text-xs font-semibold` — micro-títulos                                                      |
| `body`     | `p`              | `text-sm` — texto general                                                                    |
| `body-sm`  | `p`              | `text-xs` — texto pequeño                                                                    |
| `caption`  | `span`           | `text-xs text-muted-foreground` — metadata                                                   |
| `mono`     | `span`           | `text-xs font-mono tabular-nums` — valores numéricos, IDs                                    |
| `code`     | `code`           | `font-mono text-xs bg-muted px-1.5 py-0.5 rounded` — inline code                             |
| `label`    | `label`          | `text-sm font-medium` — form labels (~33 instancias)                                         |
| `overline` | `span`           | `text-[11px] font-bold uppercase tracking-widest text-muted-foreground` — secciones pequeñas |

#### Domain - Market (`domain/market/`)

| Componente      | Razón                                                          | Instancias actuales                                                        |
| --------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `stat-card.tsx` | Card de KPI/métrica con icon + label + value + trend + tooltip | overview (StatCard), analytics (MetricCard) — 2 variantes del mismo patrón |

---

## 4. Modelos de datos

No aplica — esta spec no modifica el schema de Prisma.

---

## 5. API endpoints

No aplica — esta spec no modifica endpoints.

---

## 6. Fases de implementación

### Fase A — Scaffold de la lib + design tokens + utils

**Alcance:** Preparar la estructura de `libs/ui`, configurar Tailwind preset, mover `cn()`, configurar el build y los exports.

**Tareas:**

1. Limpiar el placeholder actual de `libs/ui/src/lib/ui.tsx`
2. Crear estructura de directorios: `primitives/`, `composites/`, `layout/`, `feedback/`, `domain/`, `theme/`, `tokens/`
3. Crear `libs/ui/src/lib/utils.ts` con `cn()` (clsx + twMerge)
4. Crear `libs/ui/src/lib/tokens/tailwind-preset.ts` extrayendo tokens del `tailwind.config.js` de web
5. Configurar `libs/ui/package.json` con las dependencias necesarias (Radix, clsx, tailwind-merge, lucide-react)
6. Configurar `tsconfig.lib.json` y `vite.config.mts` para el build de la lib
7. Configurar el barrel export `libs/ui/src/index.ts`
8. Actualizar `apps/web/tailwind.config.js` para usar el preset de `@crypto-trader/ui`
9. Verificar que `pnpm nx build ui` funciona

**Criterio de éxito:** `libs/ui` buildea, `apps/web` sigue funcionando con el Tailwind preset importado.

---

### Fase B — Migrar componentes primitivos + crear consolidaciones

**Alcance:** Migrar los 9 componentes de `components/ui/` (consolidando duplicados) + crear los 30 componentes nuevos organizados en: primitivos (6 nuevos + Typography), compuestos (9), charts (7), feedback (3), layout (1), domain (1).

**Tareas:**

1. Migrar `button.tsx` → `primitives/button.tsx` (absorber `icon-button` con `size: 'icon'`)
2. Migrar `input.tsx` → `primitives/input.tsx` (absorber `password-input` con `type: 'password'` + toggle)
3. Migrar + unificar `status-badge.tsx` → `primitives/badge.tsx`
4. Migrar `info-tooltip.tsx` → `primitives/info-tooltip.tsx`
5. Migrar + consolidar `custom-select.tsx` → `composites/select.tsx`
6. Migrar `data-table.tsx` → `composites/data-table.tsx`
7. Crear `primitives/typography.tsx` — UN solo componente con todas las variantes (h1-h6, body, caption, mono, code, label, overline)
8. Crear 6 primitivos nuevos: spinner, progress-bar, copy-button, form-field, separator, toggle-switch, avatar
9. Crear `composites/dialog.tsx` — UN solo componente con `variant: 'default' | 'confirm' | 'danger'` (absorbe modal + confirm-dialog)
10. Crear `composites/card.tsx` — UN solo componente genérico con slots header/footer/actions (absorbe settings-card)
11. Crear 7 compuestos nuevos: tabs, pagination, filter-pills, slider-field, stepper, collapsible, key-value-row, section-title
12. Crear 7 wrappers de charts: chart-card, chart-tooltip, line-chart, area-chart, bar-chart, pie-chart, candlestick-chart
13. Crear 3 componentes de feedback: empty-state, loading-skeleton, callout
14. Crear 1 layout: page-layout
15. Crear 1 domain: stat-card
16. Actualizar barrel exports
17. Actualizar `apps/web` para importar estos componentes desde `@crypto-trader/ui` en lugar de rutas relativas
18. Refactorizar páginas para usar los nuevos componentes consolidados (reemplazar inline modals, tabs, pagination, etc.)
19. Verificar que web sigue funcionando

**Criterio de éxito:** 0 imports de `components/ui/` en web — todos vienen de `@crypto-trader/ui`. Los componentes originales en `components/ui/` se eliminan. Las páginas usan los nuevos componentes consolidados.

---

### Fase C — Refactor + migrar componentes de layout y shared

**Alcance:** Refactorizar navbar, sidebar, dashboard-header, theme-provider y dropdowns para eliminar dependencias internas, luego migrar a `libs/ui`.

**Tareas:**

1. Refactorizar `sidebar.tsx`: eliminar imports de router/i18n/stores, recibir `navItems`, `activeRoute`, `onNavigate` como props → migrar a `composites/sidebar.tsx`
2. Refactorizar `navbar.tsx`: eliminar hooks internos, recibir slots (left, center, right) → migrar a `layout/navbar.tsx`
3. Refactorizar `dashboard-header.tsx`: eliminar hooks → migrar a `layout/dashboard-header.tsx`
4. Migrar `theme-provider.tsx` → `theme/theme-provider.tsx`
5. Crear `composites/dropdown.tsx` genérico, refactorizar `avatar-dropdown`, `login-dropdown` como composiciones en web usando el Dropdown genérico
6. Refactorizar `connection-status-dropdown.tsx` (quitar WS hook) → migrar a `feedback/connection-status.tsx`
7. Refactorizar `notifications-dropdown.tsx` (quitar `useNotifications`) → migrar a `domain/notifications/`
8. Refactorizar `price-ticker.tsx` (quitar `useLivePrices`) → migrar a `domain/market/`
9. Refactorizar `mode-selector.tsx` (quitar hooks) → migrar a `domain/settings/`
10. Crear wrappers en `apps/web` que inyectan hooks/stores en los componentes migrados
11. Verificar build + funcionalidad

**Criterio de éxito:** Componentes de layout migrados. `apps/web` conecta datos via wrappers que inyectan props.

---

### Fase D — Refactor + migrar componentes de dominio

**Alcance:** Refactorizar los 21 componentes de dominio (chat, agent, market, settings, help) para ser stateless y migrarlos a `libs/ui/domain/`.

**Tareas:**

1. **Chat (11 componentes):** Refactorizar para quitar `useChat`, `useLlm`, `useChatAgent`, `useTranslation`, router → pasar data por props → migrar a `domain/chat/`
2. **Agent (4 componentes):** Refactorizar para quitar `useTranslation` → migrar a `domain/agent/`
3. **Market — indicator-info-modal:** Refactorizar para usar `Dialog` unificado → migrar a `domain/market/`
4. **Settings (4 componentes):** Refactorizar para quitar `useLlm`, `useUser`, `useTranslation` → migrar a `domain/settings/`
5. **Help — help-sidebar:** Refactorizar para quitar i18n/router → migrar a `domain/help/`
6. Crear wrappers/containers en `apps/web` que conectan hooks y stores
7. Eliminar `apps/web/src/components/` original (todo migrado)
8. Actualizar barrel exports de `@crypto-trader/ui`
9. Verificar build + funcionalidad

**Criterio de éxito:** 0 componentes en `apps/web/src/components/` (excepto `protected-route.tsx` y los wrappers/containers). Todo viene de `@crypto-trader/ui`.

---

### Fase E — Cleanup + documentación + validación final

**Alcance:** Limpieza final, asegurar que no queden imports rotos, que el design system esté documentado, y que E2E tests pasen.

**Tareas:**

1. Eliminar archivos huérfanos en `apps/web/src/components/`
2. Verificar 0 imports relativos a componentes viejos en todo `apps/web/`
3. Verificar `pnpm nx build ui && pnpm nx build web && pnpm nx build api`
4. Verificar `pnpm nx test web`
5. Ejecutar E2E tests: `pnpm nx e2e web-e2e`
6. Actualizar `docs/CONSTITUTION.md` sección 2 (estructura) y sección 5 (frontend)
7. Actualizar `libs/ui/README.md` con guía de uso del design system

**Criterio de éxito:** Build verde, tests verdes, 0 componentes duplicados, Constitución actualizada.

---

## 7. Out of scope

- **Rediseño visual** — no se cambian estilos, colores ni layout. Solo se refactoriza estructura y se consolidan patrones existentes.
- **Nuevas páginas** — no se crean páginas nuevas.
- **Cambios en el backend** — esta spec es 100% frontend/libs.
- **Storybook** — no se configura Storybook en esta iteración (puede ser una spec futura para documentar el design system visualmente).
- **Tests unitarios de libs/ui** — se priorizan E2E existentes como validación. Tests unitarios de componentes pueden ser spec futura.
- **Migración de páginas** — las páginas (`pages/`) se quedan en `apps/web`. Solo se migran componentes.
- **Nuevas features visuales** — no se agregan features nuevas (dark mode variants, animaciones nuevas, etc.). Solo se consolida lo existente.
- **GSAP** — las animaciones GSAP se quedan en el app layer (pages/containers). La lib UI no incluye GSAP.

---

## 8. Decisiones de diseño

| #   | Decisión                                             | Alternativa                                  | Razón                                                                                                                    |
| --- | ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | i18n NO entra en los componentes de la lib           | Usar i18n en la lib con dependency injection | Mantener componentes 100% puros. El app layer traduce y pasa strings. Más reutilizable si hay otra app.                  |
| 2   | Router NO entra en los componentes de la lib         | Usar un router adapter genérico              | `onNavigate` callback es más simple y desacoplado. Web inyecta `navigate()` en el wrapper.                               |
| 3   | Consolidar modales en 1 componente con Radix Dialog  | Dejar los modales inline como están          | Reduce duplicación (~18 implementaciones) y da UX consistente (esc, click-outside, focus trap, animación).               |
| 4   | Tailwind preset en la lib, consumido por apps        | Duplicar tokens en cada app                  | Single source of truth para design tokens. Si la paleta cambia, cambia en un lugar.                                      |
| 5   | Componentes de dominio en `domain/` dentro de la lib | Dejarlos en la app                           | Permite que futuras apps reusen visualización de chat, agentes, etc. sin reimplementar.                                  |
| 6   | `protected-route.tsx` se queda en `apps/web`         | Migrar todo                                  | Es pura lógica de auth+routing, no es UI reutilizable.                                                                   |
| 7   | Wrappers/containers en web conectan datos            | HOC pattern                                  | Composición explícita > magia de HOCs. Más fácil de debuggear y testear.                                                 |
| 8   | Typography como componentes (`Heading`, `Text`)      | Solo clases Tailwind                         | Componentes garantizan consistencia. Evitan los 10 tamaños × 6 pesos × 2 familias combinados ad-hoc.                     |
| 9   | Chart wrappers thin (no reimplementan Recharts)      | Importar Recharts directo en cada página     | Wrappers centralizan theme tokens (colores, grid, fonts) y reducen ~30 líneas de config repetidas por chart.             |
| 10  | Recharts/lightweight-charts como deps de `libs/ui`   | Mantenerlas en `apps/web`                    | La UI lib es dueña de la capa visual. Las apps no deben saber qué librería de charts se usa internamente.                |
| 11  | Stepper genérico en la lib                           | Dejarlo inline en cada wizard                | 2 implementaciones (onboarding 3 steps, config 7 steps) con patrón idéntico de dots + navigation.                        |
| 12  | Separator como componente                            | Solo usar `border-t`                         | Componente da semántica (`<Separator />` vs `<div className="border-t">`) y maneja orientación vertical. ~80 instancias. |
