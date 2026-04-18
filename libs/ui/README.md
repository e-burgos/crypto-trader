# @crypto-trader/ui

Design system y componentes React compartidos para Crypto Trader.

## Uso

```ts
import { Button, Card, Dialog, StatCard } from '@crypto-trader/ui';
```

## Categorías de componentes

### Primitives
`Button` · `Input` · `Badge` · `InfoTooltip` · `Typography` · `Spinner` · `ProgressBar` · `CopyButton` · `FormField` · `Separator` · `ToggleSwitch` · `Avatar`

### Composites
`Select` · `Dialog` · `Card` · `DataTable` · `Tabs` · `Pagination` · `FilterPills` · `SliderField` · `Stepper` · `Collapsible` · `KeyValueRow` · `SectionTitle` · `Dropdown` · `Sidebar`

### Feedback
`EmptyState` · `LoadingSkeleton` · `Callout`

### Layout
`PageLayout` · `Navbar` · `DashboardHeader`

### Theme
`ThemeProvider`

### Charts
`ChartCard` · `ChartTooltip` · `CHART_COLORS` · `CHART_PALETTE` · `RECHARTS_DEFAULTS` · `LIGHTWEIGHT_CHART_DEFAULTS` · `CANDLESTICK_COLORS`

### Domain — Market
`StatCard` · `PriceTicker` · `IndicatorInfoModal`

### Domain — Agent
`DecisionFlowDiagram` · `ExplainPanel` · `ParameterCards` · `StrategyPresets` · `PRESETS`

### Domain — Chat
`AgentHeader` · `AgentSelector` · `AGENTS` · `CapabilityButtons` · `ChatInput` · `OrchestratingIndicator` · `ToolCallCard`

Tipos: `AgentId` · `ChatCapability` · `ChatMessageItem` · `StreamError` · `AgentConfig` · `ChatSessionSummary` · `LLMOption`

### Domain — Help
`HelpSidebar`

## Convenciones

1. **Sin hooks de datos** — los componentes no importan `useQuery`, Zustand, React Router, ni `useTranslation`. Toda data llega por props.
2. **i18n via prop `t`** — componentes que renderizan texto reciben `t: (key: string, opts?: Record<string, unknown>) => string`.
3. **1 concepto = 1 archivo** — no duplicar componentes; usar variantes/props.
4. **Peer dependencies** — React 19, gsap ^3.12, @gsap/react ^2.0.

## Tailwind

La lib comparte la config de Tailwind del workspace. Los componentes usan `cn()` (clsx + tailwind-merge) para merging de clases.

## Build

```bash
pnpm nx build ui
```

## Tests

```bash
pnpm nx test ui
```
