import { useEffect, useRef } from 'react';
import { createChart, CandlestickSeries, ColorType } from 'lightweight-charts';
import { useThemeStore } from '../../store/theme.store';

// Mock OHLCV data for demo (will be replaced by real Binance data in Spec 11)
function generateMockCandles(n = 100) {
  const candles = [];
  let time = Math.floor(Date.now() / 1000) - n * 3600;
  let close = 65000;

  for (let i = 0; i < n; i++) {
    const change = (Math.random() - 0.48) * 1000;
    const open = close;
    close = Math.max(1000, open + change);
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    candles.push({
      time: (time + i * 3600) as unknown as import('lightweight-charts').UTCTimestamp,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
    });
  }
  return candles;
}

export function LiveChartPage() {
  const chartRef = useRef<HTMLDivElement>(null);
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: isDark ? 'hsl(222.2, 84%, 4.9%)' : '#ffffff' },
        textColor: isDark ? 'hsl(210, 40%, 80%)' : 'hsl(222.2, 84%, 4.9%)',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
        horzLines: { color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' },
      },
      width: chartRef.current.clientWidth,
      height: 400,
      crosshair: { mode: 1 },
      timeScale: { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    candleSeries.setData(generateMockCandles());
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDark]);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Chart</h1>
          <p className="text-sm text-muted-foreground">BTC/USDT — 1H (demo data)</p>
        </div>
        <div className="flex gap-2">
          {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => (
            <button
              key={tf}
              className="rounded-md border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div ref={chartRef} className="w-full" />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Demo data shown. Real-time Binance data available after connecting your API keys.
      </p>
    </div>
  );
}
