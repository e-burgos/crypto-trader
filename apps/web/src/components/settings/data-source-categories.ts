import type { DataSourceCategoryType } from '@crypto-trader/shared';

export const CATEGORY_LABELS: Record<DataSourceCategoryType, string> = {
  MARKET_DATA: 'Market Data',
  TECHNICAL: 'Technical Analysis',
  DERIVATIVES: 'Derivatives',
  NEWS: 'News',
  SENTIMENT: 'Sentiment',
  DEFI_ONCHAIN: 'DeFi & On-Chain',
  PREDICTION: 'Prediction Markets',
  TOKEN_UNLOCKS: 'Token Unlocks',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS) as DataSourceCategoryType[];

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as DataSourceCategoryType] ?? category;
}

export function orderedCategories(present: string[]): string[] {
  const known = CATEGORY_ORDER.filter((category) => present.includes(category));
  const unknown = present.filter(
    (category) => !(CATEGORY_ORDER as string[]).includes(category),
  );
  return [...known, ...unknown.sort()];
}
