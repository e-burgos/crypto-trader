import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000');

let socket: Socket | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function useWebSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const connected = useRef(false);

  useEffect(() => {
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
    });

    return () => {
      socket?.disconnect();
      socket = null;
      connected.current = false;
    };
  }, [isAuthenticated, accessToken, queryClient]);
}
