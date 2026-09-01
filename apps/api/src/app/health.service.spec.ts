import { HealthService } from './health.service';
import type { PrismaService } from '../prisma';

type RedisDouble = {
  ping: jest.Mock;
  on: jest.Mock;
  connect: jest.Mock;
  quit: jest.Mock;
};

function buildRedisDouble(overrides: Partial<RedisDouble> = {}): RedisDouble {
  return {
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue('OK'),
    ...overrides,
  };
}

function buildService(opts: {
  queryRaw?: jest.Mock;
  redis?: RedisDouble | null;
}) {
  const prisma = {
    $queryRaw: opts.queryRaw ?? jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as PrismaService;
  const service = new HealthService(prisma);
  // onModuleInit builds a real ioredis client; the double is injected instead so
  // the suite never opens a socket.
  (service as unknown as { redis: unknown }).redis =
    opts.redis === null ? undefined : (opts.redis ?? buildRedisDouble());
  return { service, prisma };
}

describe('HealthService', () => {
  afterEach(() => jest.useRealTimers());

  it('reports ok only when both dependencies answer', async () => {
    const { service } = buildService({});
    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
      redis: 'up',
    });
  });

  it('actually queries the database instead of assuming it is up', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const { service } = buildService({ queryRaw });
    await service.check();
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('reports degraded when the database rejects', async () => {
    const { service } = buildService({
      queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
    });
    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
      redis: 'up',
    });
  });

  it('reports degraded when redis rejects', async () => {
    const { service } = buildService({
      redis: buildRedisDouble({
        ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      }),
    });
    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      database: 'up',
      redis: 'down',
    });
  });

  it('reports redis down when the client never initialised', async () => {
    const { service } = buildService({ redis: null });
    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      redis: 'down',
    });
  });

  it('does not hang when a dependency never answers', async () => {
    jest.useFakeTimers();
    const { service } = buildService({
      queryRaw: jest.fn().mockReturnValue(new Promise(() => undefined)),
    });
    const pending = service.check();
    await jest.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });

  it('reports both down when everything is gone', async () => {
    const { service } = buildService({
      queryRaw: jest.fn().mockRejectedValue(new Error('down')),
      redis: buildRedisDouble({
        ping: jest.fn().mockRejectedValue(new Error('down')),
      }),
    });
    await expect(service.check()).resolves.toMatchObject({
      status: 'degraded',
      database: 'down',
      redis: 'down',
    });
  });
});
