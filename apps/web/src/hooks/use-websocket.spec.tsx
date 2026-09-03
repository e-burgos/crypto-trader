import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ENTRY_ORDER_WS_EVENTS, type EntryOrderWsEvent } from '@crypto-trader/shared';
import { useWebSocket } from './use-websocket';

type Handler = (...args: unknown[]) => void;

class FakeSocket {
  handlers = new Map<string, Handler[]>();

  on(event: string, handler: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
    return this;
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  removeAllListeners() {
    this.handlers.clear();
  }

  disconnect() {
    this.handlers.clear();
  }
}

let fakeSocket: FakeSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    fakeSocket = new FakeSocket();
    return fakeSocket;
  }),
}));

vi.mock('../store/auth.store', () => ({
  useAuthStore: () => ({ accessToken: 'token', isAuthenticated: true }),
}));

vi.mock('../store/market.store', () => ({
  useMarketStore: () => ({ setPrice: vi.fn() }),
}));

function createWrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useWebSocket entry-order:* handlers', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    reloadSpy = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: reloadSpy });
    renderHook(() => useWebSocket(), { wrapper: createWrapper(queryClient) });
  });

  it.each(ENTRY_ORDER_WS_EVENTS)('invalidates the entry-orders query on %s', (event: EntryOrderWsEvent) => {
    fakeSocket.emit(event);

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['trading', 'entry-orders'],
    });
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('invalidates positions as well on entry-order:filled', () => {
    fakeSocket.emit('entry-order:filled');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['trading', 'entry-orders'],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['trading', 'positions'],
    });
  });

  it('does not invalidate positions on events other than filled', () => {
    fakeSocket.emit('entry-order:placed');

    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: ['trading', 'positions'],
    });
  });

  it('invalidates without throwing on entry-order:skipped, which carries no entryOrderId', () => {
    expect(() => fakeSocket.emit('entry-order:skipped')).not.toThrow();

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['trading', 'entry-orders'],
    });
  });

  it('never reloads the page for any of the six events', () => {
    for (const event of ENTRY_ORDER_WS_EVENTS) fakeSocket.emit(event);

    expect(reloadSpy).not.toHaveBeenCalled();
  });
});
