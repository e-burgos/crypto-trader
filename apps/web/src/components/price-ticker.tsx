import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMarketStore } from '../store/market.store';

const FALLBACK_TICKERS = [
  { symbol: 'BTC/USDT', price: '–', change: '–', up: true },
  { symbol: 'ETH/USDT', price: '–', change: '–', up: true },
];

export function PriceTicker() {
  const { prices } = useMarketStore();

  const tickers = Object.keys(prices).length > 0
    ? Object.values(prices).map((d) => ({
        symbol: d.symbol.includes('/') ? d.symbol : d.symbol.replace(/USDT$/, '/USDT').replace(/USDC$/, '/USDC'),
        price: d.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: `${d.change24h >= 0 ? '+' : ''}${d.change24h.toFixed(2)}%`,
        up: d.change24h >= 0,
      }))
    : FALLBACK_TICKERS;

  const items = [...tickers, ...tickers];

  return (
    <div className="border-b border-border/40 bg-muted/30 overflow-hidden py-2">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((ticker, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-6 text-sm">
            <span className="font-mono font-semibold text-foreground">{ticker.symbol}</span>
            <span className="font-mono text-muted-foreground">${ticker.price}</span>
            <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${ticker.up ? 'text-emerald-500' : 'text-red-500'}`}>
              {ticker.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {ticker.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

