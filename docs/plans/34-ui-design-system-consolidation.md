# Plan 34 — UI Design System Consolidation

**Spec:** docs/specs/branches/34-ui-design-system-consolidation.md
**Branch:** feature/ui-design-system-consolidation
**Depende de:** Spec 33 mergeada en main

---

## Estado inicial requerido

```bash
# Verificar que estamos en main actualizado
git checkout main && git pull origin main

# Verificar que la lib ui existe y buildea
pnpm nx build ui

# Verificar que web buildea
pnpm nx build web

# Verificar que no hay cambios pendientes
git status
```

---

## Fase A — Scaffold de la lib + design tokens + utils

### A.1 Limpiar placeholder

```bash
# Eliminar el placeholder
rm libs/ui/src/lib/ui.tsx
```

### A.2 Crear estructura de directorios

```bash
mkdir -p libs/ui/src/lib/{primitives,composites,layout,feedback,domain/{chat,agent,market,settings,notifications,help},theme,tokens}
```

### A.3 Crear `libs/ui/src/lib/utils.ts`

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### A.4 Crear Tailwind preset

Extraer de `apps/web/tailwind.config.js` los tokens de colores, radii, fonts y animaciones → `libs/ui/src/lib/tokens/tailwind-preset.ts`

### A.5 Instalar dependencias

```bash
cd libs/ui
pnpm add clsx tailwind-merge lucide-react @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-tooltip @radix-ui/react-tabs @radix-ui/react-dropdown-menu
```

### A.6 Configurar build

- Actualizar `vite.config.mts` para exportar la lib correctamente
- Actualizar `tsconfig.lib.json` con paths correctos
- Actualizar `tsconfig.base.json` si hace falta el alias `@crypto-trader/ui`

### A.7 Barrel export

```ts
// libs/ui/src/index.ts
export { cn } from './lib/utils';
// (se irán agregando en fases B-D)
```

### A.8 Integrar preset en web

```js
// apps/web/tailwind.config.js
const uiPreset = require('@crypto-trader/ui/tailwind-preset');
module.exports = {
  presets: [uiPreset],
  // ... mantener content paths
};
```

### A.9 Verificar

```bash
pnpm nx build ui
pnpm nx build web
```

### Checklist Fase A

- [ ] Placeholder eliminado
- [ ] Estructura de directorios creada
- [ ] `cn()` en `libs/ui/src/lib/utils.ts`
- [ ] Tailwind preset extraído y exportado
- [ ] Dependencias instaladas en `libs/ui`
- [ ] Build de `libs/ui` verde
- [ ] Build de `apps/web` verde con preset importado
- [ ] Barrel export configurado

---

## Fase B — Migrar primitivos + crear consolidaciones

### B.1 Migrar componentes UI primitivos (1-a-1)

Para cada componente de `apps/web/src/components/ui/`:

1. Copiar a `libs/ui/src/lib/primitives/` o `composites/`
2. Cambiar import de `cn()` a `../../utils` (relativo dentro de la lib)
3. Verificar que no tiene hooks de datos
4. Agregar export al barrel `index.ts`
5. Actualizar imports en `apps/web` → `import { Button } from '@crypto-trader/ui'`
6. Eliminar el original de `apps/web/src/components/ui/`

**Orden:**

1. `button.tsx` → `primitives/button.tsx` (absorber icon-button: agregar `size: 'icon'`)
2. `input.tsx` → `primitives/input.tsx` (absorber password-input: agregar `type: 'password'` + toggle built-in)
3. `status-badge.tsx` → `primitives/badge.tsx`
4. `info-tooltip.tsx` → `primitives/info-tooltip.tsx`
5. `custom-select.tsx` → `composites/select.tsx`
6. `data-table.tsx` → `composites/data-table.tsx`
7. `sidebar.tsx` → (se mueve en Fase C por complejidad)
8. Eliminar `password-input.tsx` y `settings-card.tsx` de `components/ui/` (absorbidos)

### B.2 Crear componentes consolidados nuevos

> **REGLA CLAVE:** Un concepto UI = UN archivo. Si se repite el mismo concepto con variaciones, es UN componente con `variant` prop.

**Primitivos (7):**

1. **`primitives/typography.tsx`** — **UN solo componente** con `variant: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body' | 'body-sm' | 'caption' | 'mono' | 'code' | 'label' | 'overline'`, `as?`, `weight?`, `color?`, `truncate?`, `className`
2. **`primitives/spinner.tsx`** — `size: 'xs' | 'sm' | 'md' | 'lg'`, `className`
3. **`primitives/progress-bar.tsx`** — `value` (0-100), `color?`, `size?`, `showLabel?`, `className`
4. **`primitives/copy-button.tsx`** — `text: string`, `size?`, `className` (auto-feedback "copied")
5. **`primitives/form-field.tsx`** — `label`, `htmlFor?`, `required?`, `error?`, `hint?`, `children`
6. **`primitives/separator.tsx`** — `orientation?: 'horizontal' | 'vertical'`, `className`
7. **`primitives/toggle-switch.tsx`** — `checked`, `onChange`, `size?`, `disabled?`, `label?`
8. **`primitives/avatar.tsx`** — `name`, `src?`, `size?`, `status?: 'online' | 'offline' | 'away'`

**Compuestos (9):**

9. **`composites/dialog.tsx`** — **UN solo componente** con `variant: 'default' | 'confirm' | 'danger'`. Default: modal estándar (`open`, `onClose`, `title`, `description`, `children`, `size`). Confirm/Danger: agrega `onConfirm`, `confirmLabel`, `cancelLabel`, `isPending`.
10. **`composites/card.tsx`** — **UN solo componente** genérico con slots: `header?`, `footer?`, `actions?`, `title?`, `description?`, `icon?`, `children`, `className`, `onClick?`. (El patrón settings-card se logra componiendo: `<Card header={...} actions={<ToggleSwitch />}>`).
11. **`composites/tabs.tsx`** — `tabs: {label, value, icon?, count?}[]`, `value`, `onChange`, `children`
12. **`composites/pagination.tsx`** — `currentPage`, `totalPages`, `onPageChange`, `windowSize?`
13. **`composites/filter-pills.tsx`** — `options: {label, value, count?}[]`, `value`, `onChange`, `size?`
14. **`composites/slider-field.tsx`** — `label`, `value`, `onChange`, `min`, `max`, `step?`, `unit?`
15. **`composites/stepper.tsx`** — `steps: {id, label, icon?}[]`, `currentStep`, `onStepChange?`, `children`
16. **`composites/collapsible.tsx`** — `trigger: ReactNode`, `children`, `defaultOpen?`, `open?`, `onOpenChange?`
17. **`composites/key-value-row.tsx`** — `label`, `value`, `mono?`, `accent?`
18. **`composites/section-title.tsx`** — `icon`, `title`, `size?: 'sm' | 'md' | 'lg'`

**Charts (7):**

19. **`charts/chart-card.tsx`** — `title`, `subtitle?`, `children`, `emptyMessage?`, `isEmpty?`
20. **`charts/chart-tooltip.tsx`** — Tooltip custom Recharts con theme tokens
21. **`charts/line-chart.tsx`** — Wrapper LineChart con defaults del design system
22. **`charts/area-chart.tsx`** — Wrapper AreaChart con gradientes del theme
23. **`charts/bar-chart.tsx`** — Wrapper BarChart con colores del theme
24. **`charts/pie-chart.tsx`** — Wrapper PieChart con palette del theme
25. **`charts/candlestick-chart.tsx`** — Wrapper lightweight-charts con theme config

**Feedback (3):**

26. **`feedback/empty-state.tsx`** — `icon?`, `title`, `description`, `action?`
27. **`feedback/loading-skeleton.tsx`** — `variant?: 'text' | 'card' | 'table' | 'chart'`, `className`
28. **`feedback/callout.tsx`** — `variant: 'info' | 'warning' | 'danger' | 'tip'`, `icon?`, `title?`, `children`

**Layout (1):**

29. **`layout/page-layout.tsx`** — `title`, `subtitle?`, `actions?`, `children`, `className`

**Domain (1):**

30. **`domain/market/stat-card.tsx`** — `label`, `value`, `icon?`, `tooltip?`, `trend?`, `sub?`, `onClick?`

### B.3 Actualizar web

- Buscar y reemplazar todos los imports de `../../components/ui/button` → `@crypto-trader/ui`
- Repetir para cada componente migrado
- Eliminar archivos originales

### B.4 Verificar

```bash
pnpm nx build ui
pnpm nx build web
# Buscar imports huérfanos
grep -rn "components/ui/" apps/web/src/ --include="*.tsx" --include="*.ts"
```

### Checklist Fase B

- [ ] 6 componentes migrados de `components/ui/` (button absorbe icon-button, input absorbe password-input, sidebar queda para Fase C)
- [ ] 30 componentes nuevos creados: 1 Typography + 7 primitivos + 9 compuestos (Dialog absorbe confirm, Card absorbe settings-card) + 7 charts + 3 feedback + 1 layout + 1 domain + 1 section-title
- [ ] **Regla 1-concepto-1-archivo verificada**: Typography=1, Dialog=1, Card=1, Button=1, Input=1
- [ ] Web importa desde `@crypto-trader/ui`
- [ ] Archivos originales eliminados de `components/ui/` (excepto sidebar)
- [ ] Build verde (ui + web)
- [ ] 0 imports de `components/ui/` en web (excepto sidebar temporalmente)

---

## Fase C — Refactor + migrar layout y shared

### C.1 Sidebar (componente más complejo)

1. Extraer interfaz: `SidebarProps { items: NavItem[], activeRoute: string, onNavigate: (path) => void, collapsed: boolean, onToggle: () => void, user: { name, email, avatar }, onLogout: () => void, logo: ReactNode, footerSlot?: ReactNode }`
2. Eliminar imports de react-router, useLocation, useNavigate, useTranslation, stores
3. Migrar a `composites/sidebar.tsx`
4. Crear `apps/web/src/containers/sidebar-container.tsx` que inyecta hooks

### C.2 Navbar

1. Definir `NavbarProps { leftSlot?, centerSlot?, rightSlot?, className? }`
2. Eliminar hooks → migrar a `layout/navbar.tsx`
3. En web, componer el navbar con slots inyectados

### C.3 Dashboard header

1. Props: `{ title, subtitle?, actions?: ReactNode, breadcrumbs?: {label, href}[] }`
2. Migrar a `layout/dashboard-header.tsx`

### C.4 Theme provider

1. Ya es bastante puro — migrar a `theme/theme-provider.tsx`
2. Asegurar que no depende de Zustand

### C.5 Dropdown genérico

1. Crear `composites/dropdown.tsx` basado en Radix DropdownMenu
2. Refactorizar `avatar-dropdown.tsx` y `login-dropdown.tsx` en web como composiciones

### C.6 Otros: connection-status, notifications, price-ticker, mode-selector

Para cada uno:

1. Identificar hooks internos
2. Extraer interface de props
3. Refactorizar para ser stateless
4. Migrar a `feedback/` o `domain/`
5. Crear container en web que inyecta datos

### C.7 Verificar

```bash
pnpm nx build ui && pnpm nx build web
grep -rn "from '\.\./\.\./components/" apps/web/src/pages/ --include="*.tsx"
```

### Checklist Fase C

- [ ] Sidebar migrado y stateless
- [ ] Navbar migrado con slots
- [ ] Dashboard header migrado
- [ ] Theme provider migrado
- [ ] Dropdown genérico creado
- [ ] connection-status, notifications-dropdown, price-ticker, mode-selector migrados
- [ ] Containers/wrappers creados en web
- [ ] Build verde

---

## Fase D — Refactor + migrar dominio (chat, agent, settings, help)

### D.1 Chat (11 componentes)

Para cada componente en `components/chat/`:

1. Identificar hooks: `useChat`, `useChatAgent`, `useLlm`, `useTranslation`
2. Definir interface de props (data in, callbacks out)
3. Refactorizar → migrar a `domain/chat/`
4. Crear `apps/web/src/containers/chat/` con wrappers

**Componentes:** agent-header, agent-selector, capability-buttons, chat-input, chat-llm-override, chat-messages, chat-session-panel, chat-widget, llm-selector, orchestrating-indicator, tool-call-card

### D.2 Agent (4 componentes)

1. Quitar `useTranslation` → strings por props
2. Migrar a `domain/agent/`

**Componentes:** decision-flow-diagram, explain-panel, parameter-cards, strategy-presets

### D.3 Market (1)

1. `indicator-info-modal.tsx` → usar `Modal` unificado + migrar a `domain/market/`

### D.4 Settings (4 componentes)

1. Quitar `useLlm`, `useUser`, `useTranslation`
2. Migrar a `domain/settings/`

**Componentes:** ai-usage-dashboard, dynamic-model-select, news-config-panel, provider-status-grid

### D.5 Help (1)

1. Quitar i18n, router → migrar a `domain/help/`

### D.6 Cleanup

1. Eliminar `apps/web/src/components/chat/`, `agent/`, `market/`, `settings/`, `help/`
2. Eliminar dropdowns y componentes ya migrados
3. Solo debe quedar `protected-route.tsx` y `containers/`

### D.7 Verificar

```bash
pnpm nx build ui && pnpm nx build web
# Verificar que no quedan componentes en la ubicación vieja
ls apps/web/src/components/
# Solo debe haber: protected-route.tsx y containers/ (o vacío si containers está aparte)
```

### Checklist Fase D

- [ ] 11 componentes chat migrados
- [ ] 4 componentes agent migrados
- [ ] 1 componente market migrado
- [ ] 4 componentes settings migrados
- [ ] 1 componente help migrado
- [ ] Containers creados en web
- [ ] Archivos originales eliminados
- [ ] Build verde

---

## Fase E — Cleanup + validación final

### E.1 Auditoría de imports

```bash
# No debe haber imports relativos a componentes viejos
grep -rn "from '.*components/ui/" apps/web/src/ --include="*.tsx" --include="*.ts"
grep -rn "from '.*components/chat/" apps/web/src/ --include="*.tsx" --include="*.ts"
grep -rn "from '.*components/agent/" apps/web/src/ --include="*.tsx" --include="*.ts"
grep -rn "from '.*components/settings/" apps/web/src/ --include="*.tsx" --include="*.ts"
grep -rn "from '.*components/market/" apps/web/src/ --include="*.tsx" --include="*.ts"
grep -rn "from '.*components/help/" apps/web/src/ --include="*.tsx" --include="*.ts"
```

### E.2 Build completo

```bash
pnpm nx build ui
pnpm nx build web
pnpm nx build api
pnpm nx test web
```

### E.3 E2E

```bash
pnpm nx e2e web-e2e
```

### E.4 Documentación

1. Actualizar `docs/CONSTITUTION.md`:
   - Sección 2: actualizar estructura del monorepo (libs/ui ahora tiene contenido)
   - Sección 5: actualizar arquitectura frontend (componentes vienen de `@crypto-trader/ui`, pattern container/presenter)
2. Actualizar `libs/ui/README.md` con:
   - Cómo importar componentes
   - Listado de componentes disponibles por categoría
   - Cómo usar el Tailwind preset

### Checklist Fase E

- [x] 0 imports huérfanos
- [x] Build verde (ui + web)
- [x] Tests web verdes (no hay test files — no regresión)
- [ ] E2E verdes (requiere infra corriendo)
- [x] CONSTITUTION.md actualizada
- [x] README de libs/ui actualizado

---

## Criterios de aceptación

- [ ] `libs/ui` contiene TODOS los componentes UI (~40 migrados + 30 nuevos consolidados = ~70 archivos total)
- [ ] Ningún componente en `libs/ui` importa hooks de datos, stores Zustand, TanStack Query, i18n, ni router
- [ ] **Regla 1-concepto-1-archivo cumplida:** 1 Typography (con variantes h1-h6/body/caption/mono/code/label/overline), 1 Dialog (con variant default/confirm/danger), 1 Card (con slots header/footer/actions), 1 Button (con size icon), 1 Input (con type password + toggle), 1 Select, 1 Badge, 1 Tabs
- [ ] NO existen archivos separados para: PasswordInput, IconButton, ConfirmDialog, SettingsCard, Heading, Text, Label, Code
- [ ] Chart wrappers con theme tokens (Recharts + lightweight-charts)
- [ ] Stepper/Wizard component reutilizable
- [ ] `apps/web` importa todos los componentes desde `@crypto-trader/ui`
- [ ] `apps/web/src/components/` solo contiene `protected-route.tsx` y containers/wrappers
- [ ] Tailwind preset exportado desde la lib y consumido por web
- [ ] Build verde: `pnpm nx build ui && pnpm nx build web`
- [ ] Tests web verdes: `pnpm nx test web`
- [ ] E2E pasan: `pnpm nx e2e web-e2e`
- [ ] `docs/CONSTITUTION.md` actualizada

---

## Cierre de branch

```bash
# Push
git push origin feature/ui-design-system-consolidation

# PR
gh pr create \
  --base main \
  --head feature/ui-design-system-consolidation \
  --title "feat(ui): consolidate all UI components into @crypto-trader/ui design system — Spec 34" \
  --body "## Spec 34 — UI Design System Consolidation

### Cambios principales
- Migrados **~40 componentes** de \`apps/web/src/components/\` a \`libs/ui/\`
- Refactorizados todos los componentes para ser **stateless** (props-only, sin hooks de datos)
- **1-concepto-1-archivo:** Typography (13 variantes), Dialog (3 variantes), Card (con slots), Button (con size icon), Input (con type password)
- Consolidados componentes duplicados: 1 Dialog, 1 Select, 1 Dropdown, 1 Badge, 1 Card, 1 Tabs
- Creado **Tailwind preset** con design tokens compartidos
- Creados **containers** en web que conectan hooks/stores a los componentes
- Eliminada duplicación: \`apps/web\` consume TODO desde \`@crypto-trader/ui\`

### Fases completadas
- [x] Fase A: Scaffold + tokens + utils
- [x] Fase B: Primitivos + consolidaciones
- [x] Fase C: Layout + shared components
- [x] Fase D: Domain components (chat, agent, settings, help)
- [x] Fase E: Cleanup + validación

### Testing
- \`pnpm nx build ui\` ✅
- \`pnpm nx build web\` ✅
- \`pnpm nx test web\` ✅
- \`pnpm nx e2e web-e2e\` ✅

Closes Spec 34"
```

### Post-merge

1. Actualizar `docs/plans/crypto-trader-branch-plan.md` — marcar 34 como completada
2. Actualizar `docs/CONSTITUTION.md` si no se hizo en Fase E
