/**
 * Shared chart theme configuration for Recharts and Lightweight-Charts.
 * Import these defaults when building charts to maintain visual consistency.
 */

export const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  green: '#10b981',
  red: '#ef4444',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  cyan: '#06b6d4',
  muted: 'hsl(var(--muted-foreground))',
  grid: 'hsl(var(--border))',
  background: 'hsl(var(--card))',
  text: 'hsl(var(--foreground))',
  textMuted: 'hsl(var(--muted-foreground))',
} as const;

/** Recharts palette — use for multi-series charts */
export const CHART_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.green,
  CHART_COLORS.amber,
  CHART_COLORS.blue,
  CHART_COLORS.purple,
  CHART_COLORS.pink,
  CHART_COLORS.cyan,
] as const;

/** Default Recharts axis/grid styling */
export const RECHARTS_DEFAULTS = {
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: CHART_COLORS.grid,
    opacity: 0.3,
  },
  xAxis: {
    stroke: CHART_COLORS.grid,
    tick: { fill: CHART_COLORS.textMuted, fontSize: 11 },
    tickLine: false,
    axisLine: false,
  },
  yAxis: {
    stroke: CHART_COLORS.grid,
    tick: { fill: CHART_COLORS.textMuted, fontSize: 11 },
    tickLine: false,
    axisLine: false,
    width: 50,
  },
} as const;

/** Default lightweight-charts theme options */
export const LIGHTWEIGHT_CHART_DEFAULTS = {
  layout: {
    background: { color: 'transparent' },
    textColor: CHART_COLORS.textMuted,
    fontSize: 11,
  },
  grid: {
    vertLines: { color: CHART_COLORS.grid, style: 3 },
    horzLines: { color: CHART_COLORS.grid, style: 3 },
  },
  crosshair: {
    vertLine: { color: CHART_COLORS.muted, width: 1 as const, style: 2 },
    horzLine: { color: CHART_COLORS.muted, width: 1 as const, style: 2 },
  },
  timeScale: {
    borderColor: CHART_COLORS.grid,
    timeVisible: true,
  },
  rightPriceScale: {
    borderColor: CHART_COLORS.grid,
  },
} as const;

/** Candlestick-specific colors */
export const CANDLESTICK_COLORS = {
  upColor: CHART_COLORS.green,
  downColor: CHART_COLORS.red,
  borderUpColor: CHART_COLORS.green,
  borderDownColor: CHART_COLORS.red,
  wickUpColor: CHART_COLORS.green,
  wickDownColor: CHART_COLORS.red,
} as const;

export type ChartColor = keyof typeof CHART_COLORS;
