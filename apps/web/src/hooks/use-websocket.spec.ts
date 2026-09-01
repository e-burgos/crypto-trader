/**
 * Regression guard for the VITE_API_URL ambiguity (spec-e-burgos-008, hallazgo E).
 *
 * The REST base carries the `/api` prefix; the Socket.io gateway lives on the
 * origin under namespace `/ws`. Feeding the REST base straight into `io()` made
 * the client negotiate `/api/ws`, a namespace the gateway does not serve, so the
 * socket connected and then failed silently.
 */
function resolveWsUrl(env: {
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
}): string {
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000/api';
  return env.VITE_WS_URL ?? apiUrl.replace(/\/api\/?$/, '');
}

describe('websocket url resolution', () => {
  it('strips the /api prefix from an absolute REST base', () => {
    expect(
      resolveWsUrl({ VITE_API_URL: 'https://trader.estebanburgos.com.ar/api' }),
    ).toBe('https://trader.estebanburgos.com.ar');
  });

  it('strips a trailing slash after /api too', () => {
    expect(
      resolveWsUrl({ VITE_API_URL: 'https://trader.estebanburgos.com.ar/api/' }),
    ).toBe('https://trader.estebanburgos.com.ar');
  });

  it('resolves a same-origin relative base to the empty origin', () => {
    // `io('/ws')` then targets namespace /ws on the page origin, which is what a
    // same-origin deployment behind one nginx needs.
    expect(resolveWsUrl({ VITE_API_URL: '/api' })).toBe('');
  });

  it('keeps the dev default reachable without the /api suffix', () => {
    expect(resolveWsUrl({})).toBe('http://localhost:3000');
  });

  it('lets VITE_WS_URL win when the gateway is not on the REST origin', () => {
    expect(
      resolveWsUrl({
        VITE_API_URL: 'https://trader.estebanburgos.com.ar/api',
        VITE_WS_URL: 'https://ws.example.com',
      }),
    ).toBe('https://ws.example.com');
  });

  it('does not strip an /api that is not the final segment', () => {
    expect(resolveWsUrl({ VITE_API_URL: 'https://example.com/api/v2' })).toBe(
      'https://example.com/api/v2',
    );
  });
});
