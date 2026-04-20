import {
  TrendingDown,
  Minus,
  ShoppingCart,
  Target,
  TrendingUp,
  BarChart3,
  Settings2,
  Cpu,
} from 'lucide-react';

// ── Color maps ────────────────────────────────────────────────────────────────

export const DECISION_COLOR: Record<string, string> = {
  BUY: 'text-emerald-500',
  SELL: 'text-red-500',
  HOLD: 'text-amber-500',
  CLOSE: 'text-blue-500',
};

export const DECISION_BG: Record<string, string> = {
  BUY: 'bg-emerald-500/10',
  SELL: 'bg-red-500/10',
  HOLD: 'bg-amber-500/10',
  CLOSE: 'bg-blue-500/10',
};

export const DECISION_BORDER: Record<string, string> = {
  BUY: 'border-emerald-500/20',
  SELL: 'border-red-500/20',
  HOLD: 'border-amber-500/20',
  CLOSE: 'border-blue-500/20',
};

export const DECISION_ICON: Record<string, typeof TrendingDown> = {
  BUY: ShoppingCart,
  SELL: TrendingDown,
  CLOSE: Target,
  HOLD: Minus,
};

export type DecisionFilter = 'ALL' | 'BUY' | 'SELL' | 'HOLD' | 'CLOSE';
export type AssetFilter = 'ALL' | string;
export type AgentFilter = 'ALL' | string;
export const DECISION_FILTERS: DecisionFilter[] = [
  'ALL',
  'BUY',
  'SELL',
  'HOLD',
  'CLOSE',
];

export const SENTIMENT_COLOR: Record<string, string> = {
  POSITIVE: 'text-emerald-400',
  NEGATIVE: 'text-red-400',
  NEUTRAL: 'text-muted-foreground',
};

export type ModalTab = 'input' | 'output' | 'config' | 'provider';

export const MODAL_TABS: { id: ModalTab; label: string; icon: typeof Cpu }[] = [
  { id: 'input', label: 'Entrada', icon: BarChart3 },
  { id: 'output', label: 'Salida', icon: TrendingUp },
  { id: 'config', label: 'Config Bot', icon: Settings2 },
  { id: 'provider', label: 'Proveedor', icon: Cpu },
];
