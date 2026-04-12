import { useEffect, useRef, useState } from 'react';

export interface BinanceTicker {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePct: number;
  weightedAvgPrice: number;
  highPrice: number;
  lowPrice: number;
  openPrice: number;
  volume: number; // base asset volume (e.g. BTC)
  quoteVolume: number; // quote asset volume (e.g. USDT)
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  trades: number;
  updatedAt: number;
}

const WS_BASE = 'wss://stream.binance.com:9443/ws';

/**
 * Subscribes to Binance public WebSocket 24hr ticker stream for a symbol.
 * Reconnects automatically on disconnect.
 */
export function useBinanceTicker(symbol: string): {
  ticker: BinanceTicker | null;
  connected: boolean;
} {
  const [ticker, setTicker] = useState<BinanceTicker | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  useEffect(() => {
    let dead = false;

    function connect() {
      if (dead) return;
      const stream = `${symbolRef.current.toLowerCase()}@ticker`;
      const ws = new WebSocket(`${WS_BASE}/${stream}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!dead) setConnected(true);
      };

      ws.onmessage = (evt: MessageEvent<string>) => {
        if (dead) return;
        try {
          const d = JSON.parse(evt.data) as Record<string, string | number>;
          setTicker({
            symbol: String(d['s']),
            lastPrice: parseFloat(String(d['c'])),
            priceChange: parseFloat(String(d['p'])),
            priceChangePct: parseFloat(String(d['P'])),
            weightedAvgPrice: parseFloat(String(d['w'])),
            highPrice: parseFloat(String(d['h'])),
            lowPrice: parseFloat(String(d['l'])),
            openPrice: parseFloat(String(d['o'])),
            volume: parseFloat(String(d['v'])),
            quoteVolume: parseFloat(String(d['q'])),
            bidPrice: parseFloat(String(d['b'])),
            bidQty: parseFloat(String(d['B'])),
            askPrice: parseFloat(String(d['a'])),
            askQty: parseFloat(String(d['A'])),
            trades: Number(d['n']),
            updatedAt: Date.now(),
          });
        } catch {
          // malformed frame — ignore
        }
      };

      // Do NOT call ws.close() here — the browser closes the socket automatically
      // after an error and fires onclose, which handles reconnect.
      ws.onerror = () => {
        // intentionally empty; onclose will fire next and schedule reconnect
      };

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
      const ws = wsRef.current;
      if (ws) {
        // Null out handlers first so no state updates or retries fire after cleanup,
        // even if the socket is still in CONNECTING state when we close it.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (
          ws.readyState !== WebSocket.CLOSING &&
          ws.readyState !== WebSocket.CLOSED
        ) {
          ws.close();
        }
        wsRef.current = null;
      }
    };
  }, [symbol]);

  return { ticker, connected };
}
