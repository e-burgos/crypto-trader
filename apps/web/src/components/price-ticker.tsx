import { TrendingUp, TrendingDown } from 'lucide-react';

const TICKERS = [
  { symbol: 'BTC/USDT', price: '67,234.50', change: '+2.34%', up: true },
  { symbol: 'ETH/USDT', price: '3,521.20', change: '+1.87%', up: true },
  { symbol: 'BNB/USDT', price: '612.40', change: '-0.45%', up: false },
  { symbol: 'SOL/USDT', price: '178.90', change: '+4.12%', up: true },
  { symbol: 'ADA/USDT', price: '0.4521', change: '-1.23%', up: false },
  { symbol: 'DOT/USDT', price: '8.34', change: '+0.89%', up: true },
  { symbol: 'AVAX/USDT', price: '38.72', change: '+3.21%', up: true },
  { symbol: 'MATIC/USDT', price: '0.8921', change: '-0.67%', up: false },
];

export function PriceTicker() {
  const items = [...TICKERS, ...TICKERS]; // duplicate for seamless loop

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
