import { useEffect, useRef, useState } from 'react';

export interface KlineUpdate {
  /** Start time in seconds (UTCTimestamp for lightweight-charts) */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** true = candle is closed (new candle will start next) */
  isClosed: boolean;
}

const WS_BASE = 'wss://stream.binance.com:9443/ws';

/**
 * Subscribes to the Binance public kline/candlestick WebSocket stream.
 * Delivers each update (open candle) and closed candles in real-time.
 * Reconnects automatically.
 *
 * symbol: e.g. 'BTCUSDT'
 * interval: e.g. '1m', '5m', '1h', '1d'
 */
export function useBinanceKlineStream(
  symbol: string,
  interval: string,
): { kline: KlineUpdate | null; connected: boolean } {
  const [kline, setKline] = useState<KlineUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest symbol/interval in refs so the reconnect closure always
  // uses current values without needing them in the dep array.
  const symRef = useRef(symbol);
  const ivRef = useRef(interval);
  symRef.current = symbol;
  ivRef.current = interval;

  useEffect(() => {
    let dead = false;

    function connect() {
      if (dead) return;
      const stream = `${symRef.current.toLowerCase()}@kline_${ivRef.current}`;
      const ws = new WebSocket(`${WS_BASE}/${stream}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!dead) setConnected(true);
      };

      ws.onmessage = (evt: MessageEvent<string>) => {
        if (dead) return;
        try {
          const msg = JSON.parse(evt.data) as {
            k: Record<string, string | number | boolean>;
          };
          const k = msg.k;
          setKline({
            time: Math.floor(Number(k['t']) / 1000),
            open: parseFloat(String(k['o'])),
            high: parseFloat(String(k['h'])),
            low: parseFloat(String(k['l'])),
            close: parseFloat(String(k['c'])),
            volume: parseFloat(String(k['v'])),
            isClosed: Boolean(k['x']),
          });
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => ws.close();

      ws.onclose = () => {
        setConnected(false);
        if (!dead) {
          retryRef.current = setTimeout(connect, 3_000);
        }
      };
    }

    connect();

    return () => {
      dead = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setKline(null);
    };
  }, [symbol, interval]); // reconnect when symbol or interval changes

  return { kline, connected };
}
