---
name: frontend-component-rules
description: 'Reglas obligatorias de uso y creación de componentes UI para cualquier tarea frontend. INVOCAR SIEMPRE antes de crear, modificar o desarrollar cualquier componente, página o feature de UI en este proyecto. Aplica a agentes frontend, orquestadores y cualquier agente que toque código en apps/web o libs/ui.'
---

# Frontend Component Rules — Crypto Trader

Reglas obligatorias para todo agente que trabaje en frontend (UI, páginas, componentes, features visuales).

---

## Regla 1 — Revisar el catálogo existente ANTES de escribir código

Antes de crear cualquier componente nuevo, **SIEMPRE** revisar qué existe en `libs/ui`:

```bash
# Ver el barrel de exports (catálogo completo)
cat libs/ui/src/index.ts

# Explorar por categoría
ls libs/ui/src/lib/primitives/    # Button, Input, Badge, Typography, Spinner, etc.
ls libs/ui/src/lib/composites/    # Select, Dialog, Card, DataTable, Tabs, Pagination, etc.
ls libs/ui/src/lib/feedback/      # EmptyState, LoadingSkeleton, Callout
ls libs/ui/src/lib/layout/        # PageLayout, Navbar, DashboardHeader
ls libs/ui/src/lib/domain/        # Componentes de dominio (market, agent, chat, help)
ls libs/ui/src/lib/charts/        # ChartCard, ChartTooltip, chart-theme
ls libs/ui/src/lib/theme/         # ThemeProvider
```

Si no revisas el catálogo primero, **estás violando esta regla**.

---

## Regla 2 — Siempre usar componentes de `libs/ui`

Todo componente que exista en `libs/ui` **DEBE** importarse desde `@crypto-trader/ui` (o el alias de la lib). **NUNCA** re-implementar algo que ya existe.

```tsx
// ✅ CORRECTO
import { Button, Card, DataTable, Typography } from '@crypto-trader/ui';

// ❌ INCORRECTO — re-implementar un botón custom
const MyButton = ({ children, ...props }) => (
  <button {...props}>{children}</button>
);
```

Esto incluye: primitivos (Button, Input, Badge, etc.), composites (Select, Dialog, Tabs, etc.), feedback (EmptyState, Spinner, etc.), layout (PageLayout, DashboardHeader, etc.) y todo lo exportado en `libs/ui/src/index.ts`.

---

## Regla 3 — Componente nuevo reutilizable → `libs/ui`

Si necesitas un componente que **no existe** en `libs/ui` y cumple estas condiciones:

- Es **reutilizable** en más de un contexto/página
- Es **parametrizable por props** (sin lógica de negocio acoplada)
- Es **presentacional** (no depende de estado global, API calls, ni stores)

Entonces **DEBE** crearse en `libs/ui/src/lib/` en la subcarpeta que corresponda:

| Tipo                                                 | Ruta                                | Ejemplos                  |
| ---------------------------------------------------- | ----------------------------------- | ------------------------- |
| Primitivo (atómico, sin dependencias UI)             | `libs/ui/src/lib/primitives/`       | Button, Input, Badge      |
| Compuesto (combina primitivos)                       | `libs/ui/src/lib/composites/`       | Select, Dialog, DataTable |
| Feedback (estados de carga/error/vacío)              | `libs/ui/src/lib/feedback/`         | EmptyState, Spinner       |
| Layout (estructura de página)                        | `libs/ui/src/lib/layout/`           | PageLayout, Navbar        |
| Dominio (UI específica de dominio, aún reutilizable) | `libs/ui/src/lib/domain/<dominio>/` | StatCard, AgentSelector   |
| Charts (visualizaciones)                             | `libs/ui/src/lib/charts/`           | ChartCard, ChartTooltip   |

**Checklist al crear componente en libs/ui:**

1. Crear el archivo del componente en la subcarpeta correcta
2. Exportar el componente y sus tipos desde `libs/ui/src/index.ts`
3. El componente DEBE aceptar props tipadas y exportar su interfaz de Props
4. NO incluir lógica de negocio, API calls, ni dependencias de stores

---

## Regla 4 — Componente con lógica de negocio → `apps/web/src/components/`

Si el componente **no es reutilizable como library** porque:

- Tiene **lógica de negocio** pesada (API calls, stores, estado complejo)
- Es **específico de una feature** y no tiene sentido en otro contexto
- Depende de **contexto de la app** (auth, routing, estado global)

Entonces **DEBE** crearse en `apps/web/src/components/` bajo la subcarpeta correspondiente al dominio/feature:

```
apps/web/src/components/
├── admin/          # Componentes de admin
├── agent-log/      # Logs de agentes
├── agents-showcase/ # Showcase de agentes
├── analytics/      # Analíticas
├── bot-analysis/   # Análisis de bots
├── config/         # Configuración
├── help/           # Ayuda
├── landing/        # Landing page
├── live-chart/     # Gráficos en vivo
├── market/         # Mercado
├── news-feed/      # Noticias
├── notifications/  # Notificaciones
├── onboarding/     # Onboarding
├── overview/       # Dashboard overview
├── positions/      # Posiciones
└── trade-history/  # Historial de trades
```

Si estás trabajando en una feature nueva que no tiene subcarpeta, créala siguiendo el patrón kebab-case.

---

## Regla 5 — Las páginas NO contienen subcomponentes internos

Los archivos de página (`apps/web/src/pages/**/*.tsx`) **SOLO** deben:

- Componer componentes importados desde `@crypto-trader/ui` o `apps/web/src/components/`
- Manejar routing/params de la página
- Orquestar data fetching de alto nivel (si aplica)

```tsx
// ✅ CORRECTO — página compone componentes importados
import { PageLayout, DataTable, Typography } from '@crypto-trader/ui';
import { UserFilters } from '../../components/admin/user-filters';
import { UserStats } from '../../components/admin/user-stats';

export function UsersPage() {
  return (
    <PageLayout title="Users">
      <UserStats />
      <UserFilters />
      <DataTable columns={columns} data={data} />
    </PageLayout>
  );
}

// ❌ INCORRECTO — subcomponente definido inline en la página
export function UsersPage() {
  const UserRow = (
    { user }, // ← NUNCA hacer esto
  ) => <div>{user.name}</div>;
  return (
    <div>
      {users.map((u) => (
        <UserRow user={u} />
      ))}
    </div>
  );
}
```

**NUNCA** definir componentes auxiliares, helpers visuales, ni subcomponentes dentro de un archivo de página. Extraerlos a `libs/ui` o `apps/web/src/components/`.

---

## Árbol de decisión rápido

```
¿Necesito un componente de UI?
│
├─ ¿Ya existe en libs/ui/src/index.ts?
│  └─ SÍ → Importar desde @crypto-trader/ui. FIN.
│
├─ ¿Es reutilizable, parametrizable por props, sin lógica de negocio?
│  └─ SÍ → Crear en libs/ui/src/lib/<categoría>/. Exportar en index.ts. FIN.
│
├─ ¿Tiene lógica de negocio, es específico de una feature?
│  └─ SÍ → Crear en apps/web/src/components/<feature>/. FIN.
│
└─ ¿Es un helper inline dentro de una página?
   └─ NUNCA → Extraer a libs/ui o apps/web/src/components/. FIN.
```

---

## Resumen de imports esperados en una página

```tsx
// Componentes UI reutilizables (lib)
import { Button, Card, Typography, PageLayout } from '@crypto-trader/ui';

// Componentes de feature con lógica (app)
import { TradePanel } from '../../components/positions/trade-panel';
import { OrderBook } from '../../components/market/order-book';
```
