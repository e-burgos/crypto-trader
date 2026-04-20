import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TickerData {
  symbol: string;
  price: string;
  change: string;
  up: boolean;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

const FALLBACK_TICKERS: TickerData[] = [
  { symbol: 'BTC/USDT', price: '—', change: '—', up: true },
  { symbol: 'ETH/USDT', price: '—', change: '—', up: true },
  { symbol: 'SOL/USDT', price: '—', change: '—', up: true },
  { symbol: 'BNB/USDT', price: '—', change: '—', up: true },
  { symbol: 'XRP/USDT', price: '—', change: '—', up: true },
];

const formatSymbol = (s: string) =>
  s.replace(/USDT$/, '/USDT').replace(/USDC$/, '/USDC');

function parseTicker(raw: {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
}): TickerData {
  const price = parseFloat(raw.lastPrice);
  const pct = parseFloat(raw.priceChangePercent);
  return {
    symbol: formatSymbol(raw.symbol),
    price: price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
    up: pct >= 0,
  };
}

export function PriceTicker() {
  const [tickers, setTickers] = useState<TickerData[]>(FALLBACK_TICKERS);

  useEffect(() => {
    let cancelled = false;

    async function fetchTickers() {
      try {
        const symbolsParam = encodeURIComponent(JSON.stringify(SYMBOLS));
        const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setTickers(data.map(parseTicker));
        }
      } catch {
        /* keep fallback */
      }
    }

    fetchTickers();
    const id = setInterval(fetchTickers, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const items = [...tickers, ...tickers, ...tickers];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/40 bg-background/80 backdrop-blur-md overflow-hidden py-2">
      <div className="flex animate-ticker whitespace-nowrap">
        {items.map((ticker, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-6 text-sm"
          >
            <span className="font-mono font-semibold text-foreground">
              {ticker.symbol}
            </span>
            <span className="font-mono text-muted-foreground">
              ${ticker.price}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${ticker.up ? 'text-emerald-500' : 'text-red-500'}`}
            >
              {ticker.up ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {ticker.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
