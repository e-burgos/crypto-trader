import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useQueryClient } from '@tanstack/react-query';
import { useMarketStore } from '../store/market.store';

const WS_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useWebSocket(opts?: { enabled?: boolean }) {
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const { setPrice } = useMarketStore();
  const connected = useRef(false);
  const enabled = opts?.enabled ?? isAuthenticated;

  useEffect(() => {
    if (!enabled) return;
    if (!isAuthenticated || !accessToken || connected.current) return;

    socket = io(`${WS_URL}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      connected.current = true;
    });

    socket.on('disconnect', () => {
      connected.current = false;
    });

    socket.on('notification:new', (data: { type: string; message: string }) => {
      toast.info(data.message, { description: data.type });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    socket.on('trade:executed', () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      toast.success('Trade executed');
    });

    socket.on('position:closed', () => {
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      queryClient.invalidateQueries({ queryKey: ['trading', 'positions'] });
    });

    socket.on('price:tick', (data: { symbol: string; price: number; change24h: number }) => {
      setPrice(data.symbol, { symbol: data.symbol, price: data.price, change24h: data.change24h });
    });

    socket.on('agent:decision', (data: { userId: string; asset: string; decision: string; confidence: number }) => {
      queryClient.invalidateQueries({ queryKey: ['trading', 'decisions'] });
      queryClient.invalidateQueries({ queryKey: ['analytics', 'decisions'] });
      toast.info(`Agent: ${data.decision} ${data.asset} (${data.confidence}% confidence)`, {
        duration: 5000,
      });
    });

    socket.on('position:updated', () => {
      queryClient.invalidateQueries({ queryKey: ['trading', 'positions'] });
    });

    socket.on('agent:killed', () => {
      queryClient.invalidateQueries({ queryKey: ['trading'] });
      toast.warning('All agents have been stopped by admin', { duration: 8000 });
    });

    return () => {
      socket?.disconnect();
      socket = null;
      connected.current = false;
    };
  }, [isAuthenticated, accessToken, queryClient, setPrice]);
}

