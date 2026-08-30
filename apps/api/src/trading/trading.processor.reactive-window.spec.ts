import { TradingProcessor } from './trading.processor';

describe('TradingProcessor — reactive window write on re-queue', () => {
  function buildProcessor(
    prisma: any,
    coordination: any,
    queueAddMock: jest.Mock,
  ) {
    const processor = new TradingProcessor(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      coordination,
    );
    const job = {
      data: { userId: 'user-1', configId: 'config-A' },
      queue: { add: queueAddMock },
    };
    return { processor, job };
  }

  function buildCoordination(overrides: Partial<Record<string, any>> = {}) {
    return {
      isHealthy: jest.fn().mockReturnValue(true),
      setJson: jest.fn().mockResolvedValue(undefined),
      getJson: jest.fn().mockResolvedValue(null),
      tryConsumeToken: jest.fn().mockResolvedValue(true),
      tryAcquire: jest.fn().mockResolvedValue(true),
      renew: jest.fn().mockResolvedValue(true),
      release: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('writes rx:v1:window:{configId} with windowEndMs and TTL equal to the re-queue delay, after the re-queue resolves', async () => {
    const prisma = {
      tradingConfig: {
        findUnique: jest.fn().mockResolvedValue({ isRunning: true }),
      },
    };
    const queueAddMock = jest.fn().mockResolvedValue(undefined);
    const coordination = buildCoordination();
    const { processor, job } = buildProcessor(prisma, coordination, queueAddMock);

    const callOrder: string[] = [];
    queueAddMock.mockImplementation(async () => {
      callOrder.push('queue.add');
    });
    coordination.setJson.mockImplementation(async () => {
      callOrder.push('setJson');
    });

    const before = Date.now();
    await (processor as any).scheduleNextCycle(job, 'user-1', 'config-A', 5);
    const after = Date.now();

    expect(queueAddMock).toHaveBeenCalledWith(
      'run-cycle',
      { userId: 'user-1', configId: 'config-A' },
      { delay: 5 * 60 * 1000, removeOnComplete: true },
    );
    expect(coordination.setJson).toHaveBeenCalledTimes(1);
    const [key, value, ttlMs] = coordination.setJson.mock.calls[0];
    expect(key).toBe('rx:v1:window:config-A');
    expect(ttlMs).toBe(5 * 60 * 1000);
    expect(value.windowEndMs).toBeGreaterThanOrEqual(before + 5 * 60 * 1000);
    expect(value.windowEndMs).toBeLessThanOrEqual(after + 5 * 60 * 1000);
    expect(callOrder).toEqual(['queue.add', 'setJson']);
  });

  it('does not write the window when coordination is unhealthy (fail-closed), and the re-queue still happens unchanged', async () => {
    const prisma = {
      tradingConfig: {
        findUnique: jest.fn().mockResolvedValue({ isRunning: true }),
      },
    };
    const queueAddMock = jest.fn().mockResolvedValue(undefined);
    const coordination = buildCoordination({
      isHealthy: jest.fn().mockReturnValue(false),
    });
    const { processor, job } = buildProcessor(prisma, coordination, queueAddMock);

    await (processor as any).scheduleNextCycle(job, 'user-1', 'config-A', 5);

    expect(queueAddMock).toHaveBeenCalledWith(
      'run-cycle',
      { userId: 'user-1', configId: 'config-A' },
      { delay: 5 * 60 * 1000, removeOnComplete: true },
    );
    expect(coordination.setJson).not.toHaveBeenCalled();
  });

  it('does not write the window when the config is no longer running (no re-queue at all)', async () => {
    const prisma = {
      tradingConfig: {
        findUnique: jest.fn().mockResolvedValue({ isRunning: false }),
      },
    };
    const queueAddMock = jest.fn().mockResolvedValue(undefined);
    const coordination = buildCoordination();
    const { processor, job } = buildProcessor(prisma, coordination, queueAddMock);

    await (processor as any).scheduleNextCycle(job, 'user-1', 'config-A', 5);

    expect(queueAddMock).not.toHaveBeenCalled();
    expect(coordination.setJson).not.toHaveBeenCalled();
  });

  it('falls back to a disabled (unhealthy) coordination port when none is injected, so the cycle behaves exactly as before this task', async () => {
    const prisma = {
      tradingConfig: {
        findUnique: jest.fn().mockResolvedValue({ isRunning: true }),
      },
    };
    const queueAddMock = jest.fn().mockResolvedValue(undefined);
    const processor = new TradingProcessor(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const job = {
      data: { userId: 'user-1', configId: 'config-A' },
      queue: { add: queueAddMock },
    };

    await (processor as any).scheduleNextCycle(job, 'user-1', 'config-A', 5);

    expect(queueAddMock).toHaveBeenCalledWith(
      'run-cycle',
      { userId: 'user-1', configId: 'config-A' },
      { delay: 5 * 60 * 1000, removeOnComplete: true },
    );
    expect((processor as any).coordination.isHealthy()).toBe(false);
  });
});
