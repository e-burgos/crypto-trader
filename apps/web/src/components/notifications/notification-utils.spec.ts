import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import es from '../../locales/es';
import { getNotificationRoute, routeLabel } from './notification-utils';

const t = ((key: string) => key) as unknown as TFunction;

describe('getNotificationRoute — entradas descansando', () => {
  it('entryOrderPlaced sin ids apunta a la pestaña Entradas filtrada por RESTING', () => {
    const route = getNotificationRoute(
      'TRADE_EXECUTED',
      JSON.stringify({ key: 'entryOrderPlaced', entryMode: 'LIMIT_MAKER' }),
    );
    expect(route).toBe('/dashboard/positions?tab=entries&status=RESTING');
  });

  it('entryOrderFilled con ids agrega configId y entryOrderId', () => {
    const route = getNotificationRoute(
      'TRADE_EXECUTED',
      JSON.stringify({
        key: 'entryOrderFilled',
        configId: 'cfg-1',
        entryOrderId: 'eo-1',
      }),
    );
    const url = new URL(route, 'http://localhost');
    expect(url.pathname).toBe('/dashboard/positions');
    expect(url.searchParams.get('tab')).toBe('entries');
    expect(url.searchParams.get('status')).toBe('FILLED');
    expect(url.searchParams.get('configId')).toBe('cfg-1');
    expect(url.searchParams.get('entryOrderId')).toBe('eo-1');
  });

  it('entryOrderMissing apunta a MISSING con el entryOrderId', () => {
    const route = getNotificationRoute(
      'AGENT_ERROR',
      JSON.stringify({ key: 'entryOrderMissing', entryOrderId: 'eo-9' }),
    );
    expect(route).toBe(
      '/dashboard/positions?tab=entries&status=MISSING&entryOrderId=eo-9',
    );
  });

  it('las claves previas conservan su ruta', () => {
    expect(
      getNotificationRoute(
        'TRADE_EXECUTED',
        JSON.stringify({ key: 'tradeBuy' }),
      ),
    ).toBe('/dashboard/history');
    expect(getNotificationRoute('AGENT_ERROR', 'texto plano')).toBe(
      '/dashboard/config',
    );
  });
});

describe('routeLabel', () => {
  it('deriva la etiqueta del pathname y nunca muestra la query string', () => {
    expect(
      routeLabel('/dashboard/positions?tab=entries&status=RESTING', t),
    ).toBe('sidebar.positions');
    expect(routeLabel('/dashboard/history', t)).toBe('sidebar.tradeHistory');
  });
});

describe('paridad de getNotificationRoute sobre todas las claves de notificación', () => {
  const keys = Object.keys(es.notificationMessages);

  it('cada clave del locale resuelve a una ruta del dashboard', () => {
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const route = getNotificationRoute('INFO', JSON.stringify({ key }));
      expect(route, key).toMatch(/^\/dashboard(\/|\?|$)/);
    }
  });

  it('ninguna etiqueta de ruta contiene una query string', () => {
    for (const key of keys) {
      const route = getNotificationRoute('INFO', JSON.stringify({ key }));
      expect(routeLabel(route, t), key).not.toContain('?');
    }
  });
});
