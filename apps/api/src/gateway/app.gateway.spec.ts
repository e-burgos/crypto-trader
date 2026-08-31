import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'socket.io';
import type { JwtService } from '@nestjs/jwt';
import { AppGateway } from './app.gateway';

const WEB_WEBSOCKET_HOOK = join(
  __dirname,
  '../../../web/src/hooks/use-websocket.ts',
);

function buildGateway(): {
  gateway: AppGateway;
  emit: jest.Mock;
  to: jest.Mock;
} {
  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));
  const gateway = new AppGateway({} as JwtService);
  gateway.server = { to, emit } as unknown as Server;
  return { gateway, emit, to };
}

describe('AppGateway price stream contract (FIX-e-burgos-009)', () => {
  it('emits the live price to the room of the subscribed symbol', () => {
    const { gateway, emit, to } = buildGateway();

    gateway.emitPriceUpdate('BTCUSDT', {
      symbol: 'BTCUSDT',
      price: 30_100,
      change24h: 1.2,
    });

    expect(to).toHaveBeenCalledWith('price:BTCUSDT');
    expect(emit).toHaveBeenCalledWith('price:tick', {
      symbol: 'BTCUSDT',
      price: 30_100,
      change24h: 1.2,
    });
  });

  it('emits the same event name the web client subscribes to', () => {
    const { gateway, emit } = buildGateway();

    gateway.emitPriceUpdate('BTCUSDT', { symbol: 'BTCUSDT', price: 1 });
    const [emittedEvent] = emit.mock.calls[0] as [string];

    const webHookSource = readFileSync(WEB_WEBSOCKET_HOOK, 'utf8');
    expect(webHookSource).toContain(`'${emittedEvent}'`);
    expect(webHookSource).not.toContain("'price:update'");
  });
});
