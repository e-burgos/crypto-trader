import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from './use-websocket';

export interface DataSourceEvent {
  name: string;
  type: 'degraded' | 'recovered' | 'toggled';
  timestamp: number;
}

/**
 * Listens for real-time data-source WebSocket events
 * and provides a map of current source states.
 */
export function useDataSourceEvents() {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<Map<string, DataSourceEvent>>(new Map());

  const addEvent = useCallback((event: DataSourceEvent) => {
    setEvents((prev) => {
      const next = new Map(prev);
      next.set(event.name, event);
      return next;
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onDegraded = (data: { name: string; consecutiveErrors: number }) => {
      addEvent({ name: data.name, type: 'degraded', timestamp: Date.now() });
      toast.warning(`Data source degraded: ${data.name}`, {
        description: `${data.consecutiveErrors} consecutive errors`,
        duration: 6000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
    };

    const onRecovered = (data: { name: string; downDurationMs: number }) => {
      addEvent({ name: data.name, type: 'recovered', timestamp: Date.now() });
      const secs = Math.round(data.downDurationMs / 1000);
      toast.success(`Data source recovered: ${data.name}`, {
        description: `Was down for ${secs}s`,
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
    };

    const onToggled = (data: {
      name: string;
      isActive: boolean;
      toggledBy: string;
    }) => {
      addEvent({
        name: data.name,
        type: 'toggled',
        timestamp: Date.now(),
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'data-sources'] });
    };

    socket.on('data-source:degraded', onDegraded);
    socket.on('data-source:recovered', onRecovered);
    socket.on('data-source:toggled', onToggled);

    return () => {
      socket.off('data-source:degraded', onDegraded);
      socket.off('data-source:recovered', onRecovered);
      socket.off('data-source:toggled', onToggled);
    };
  }, [addEvent, queryClient]);

  return { events };
}
