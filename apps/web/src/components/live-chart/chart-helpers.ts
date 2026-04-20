export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type Interval = (typeof INTERVALS)[number];

export function chartColors(isDark: boolean) {
  return {
    bg: isDark ? '#0a0f1e' : '#ffffff',
    text: isDark ? 'rgba(255,255,255,0.75)' : '#1a1a2e',
    gridLine: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
  };
}

export function normalizeCandles(
  raw: {
    time?: number | string;
    openTime?: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[],
) {
  return raw
    .map((c) => {
      const rawTime = (c as { openTime?: number }).openTime ?? c.time;
      const t: number =
        typeof rawTime === 'string'
          ? Math.floor(new Date(rawTime).getTime() / 1000)
          : (rawTime as number) > 1e12
            ? Math.floor((rawTime as number) / 1000)
            : (rawTime as number);
      return {
        time: t as import('lightweight-charts').UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      };
    })
    .filter((c) => (c.time as number) > 0)
    .sort((a, b) => (a.time as number) - (b.time as number));
}
