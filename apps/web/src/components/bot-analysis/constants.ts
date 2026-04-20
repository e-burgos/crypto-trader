import type { OverallSignal } from '../../hooks/use-market';

export const SIGNAL_COLOR: Record<OverallSignal, string> = {
  BUY: 'text-emerald-500',
  SELL: 'text-red-500',
  HOLD: 'text-sky-400',
  NEUTRAL: 'text-amber-500',
};

export const SIGNAL_BG: Record<OverallSignal, string> = {
  BUY: 'bg-emerald-500/10 border-emerald-500/25',
  SELL: 'bg-red-500/10 border-red-500/25',
  HOLD: 'bg-sky-500/10 border-sky-500/25',
  NEUTRAL: 'bg-amber-500/10 border-amber-500/25',
};

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

export const SENTIMENT_COLOR: Record<string, string> = {
  POSITIVE: 'text-emerald-400',
  NEGATIVE: 'text-red-400',
  NEUTRAL: 'text-muted-foreground',
};

export const AI_VALID_MS = 12 * 60 * 60 * 1000;

export type StateModalTab = 'estado' | 'indicadores' | 'noticias' | 'config';

export const STATE_MODAL_TABS: {
  id: StateModalTab;
  labelKey: string;
  icon: React.ElementType;
}[] = [
  { id: 'estado', labelKey: 'botAnalysis.tabs.status', icon: () => null },
  {
    id: 'indicadores',
    labelKey: 'botAnalysis.tabs.indicators',
    icon: () => null,
  },
  { id: 'noticias', labelKey: 'botAnalysis.tabs.news', icon: () => null },
  { id: 'config', labelKey: 'botAnalysis.tabs.config', icon: () => null },
];

// helper type to pass computed news values
export interface NewsAnalysisData {
  positive: number;
  negative: number;
  neutral: number;
  score: number | string;
  overall: string;
}
