import { useEffect } from 'react';
import { useMarketStore } from '../store/market.store';

/**
 * Polls Binance public REST API every `intervalMs` ms for each symbol
 * and updates the market store. No auth required.
 *
 * Uses the /api/v3/ticker/bookTicker endpoint (returns bestBidPrice/bestAskPrice)
 * but we use /api/v3/ticker/price which only returns the last price.
 * For a multi-symbol batch we use /api/v3/ticker/price?symbols=[...].
 */
export function useLivePrices(symbols: string[], intervalMs = 5_000) {
  const setPrice = useMarketStore((s) => s.setPrice);

  useEffect(() => {
    if (!symbols.length) return;

    const unique = [...new Set(symbols)];

    const fetchPrices = async () => {
      try {
        const encoded = encodeURIComponent(JSON.stringify(unique));
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbols=${encoded}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { symbol: string; price: string }[];
        for (const item of data) {
          setPrice(item.symbol, {
            symbol: item.symbol,
            price: parseFloat(item.price),
            change24h: 0, // Not needed for P&L calculation
          });
        }
      } catch {
        // Binance unreachable — keep showing last known prices
      }
    };

    fetchPrices();
    const id = setInterval(fetchPrices, intervalMs);
    return () => clearInterval(id);
    // symbols is compared as a joined string above, intentionally stable
  }, [symbols.join(','), intervalMs, setPrice]);
}

/** Compute unrealized P&L for an open position */
export function calcUnrealizedPnl(
  entryPrice: number,
  quantity: number,
  fees: number,
  currentPrice: number | undefined,
): number | null {
  if (currentPrice == null) return null;
  return (currentPrice - entryPrice) * quantity - fees;
}
