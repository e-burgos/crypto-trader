import { create } from 'zustand';

export interface TickerPrice {
  price: number;
  change24h: number;
  symbol: string;
}

interface MarketState {
  prices: Record<string, TickerPrice>;
  setPrice: (symbol: string, data: TickerPrice) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  prices: {},
  setPrice: (symbol, data) =>
    set((state) => ({
      prices: { ...state.prices, [symbol]: data },
    })),
}));
