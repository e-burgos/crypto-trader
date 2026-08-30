import { ActionGateService, type ActionRequest } from './action-gate.service';
import { TradingMode } from '@crypto-trader/shared';

describe('ActionGateService.authorizeAndRun', () => {
  function makeConfig(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'config-1',
      reactiveLoopEnabled: true,
      maxActionsPerHour: 6,
      minActionIntervalSec: 60,
      ...overrides,
    };
  }

  function makeDeps(overrides: {
    config?: Record<string, unknown>;
    counters?: { _count: { _all: number }; _max: { occurredAt: Date | null } };
    dailyLossReached?: boolean;
    position?: Record<string, unknown> | null;
    isHealthy?: boolean;
    tryAcquire?: boolean;
  } = {}) {
    const findUniqueOrThrow = jest.fn().mockResolvedValue(overrides.config ?? makeConfig());
    const aggregate = jest.fn().mockResolvedValue(
      overrides.counters ?? { _count: { _all: 0 }, _max: { occurredAt: null } },
    );
    const create = jest.fn().mockResolvedValue(undefined);
    const findUnique = jest.fn().mockResolvedValue(
      overrides.position === undefined ? null : overrides.position,
    );

    const prisma = {
      tradingConfig: { findUniqueOrThrow },
      botAction: { aggregate, create },
      position: { findUnique },
    };

    const emitToUser = jest.fn();
    const gateway = { emitToUser };

    const evaluateDailyLoss = jest.fn().mockResolvedValue({
      reached: overrides.dailyLossReached ?? false,
      realizedPnlTodayUsd: 0,
      maxDailyLossUsd: null,
    });
    const aggregateRisk = { evaluateDailyLoss };

    const tryAcquire = jest.fn().mockResolvedValue(overrides.tryAcquire ?? true);
    const release = jest.fn().mockResolvedValue(undefined);
    const isHealthy = jest.fn().mockReturnValue(overrides.isHealthy ?? true);
    const coordination = {
      tryAcquire,
      release,
      renew: jest.fn(),
      tryConsumeToken: jest.fn(),
      setJson: jest.fn(),
      getJson: jest.fn(),
      isHealthy,
    };

    const service = new ActionGateService(
      prisma as any,
      gateway as any,
      aggregateRisk as any,
      coordination as any,
    );

    return {
      service,
      prisma,
      gateway,
      aggregateRisk,
      coordination,
      findUniqueOrThrow,
      aggregate,
      create,
      findUnique,
      emitToUser,
      tryAcquire,
      release,
      isHealthy,
      evaluateDailyLoss,
    };
  }

  function makeRequest(overrides: Partial<ActionRequest> = {}): ActionRequest {
    return {
      userId: 'user-1',
      configId: 'config-1',
      symbol: 'BTCUSDT',
      mode: TradingMode.SANDBOX,
      kind: 'BUY',
      source: 'LLM_CYCLE',
      positionId: null,
      decisionId: null,
      expected: null,
      detail: 'test action',
      ...overrides,
    };
  }

  it('is a pure passthrough when reactiveLoopEnabled is false: no coordination, no lease, no ledger row', async () => {
    const deps = makeDeps({ config: makeConfig({ reactiveLoopEnabled: false }) });
    const execute = jest.fn().mockResolvedValue('executed-value');

    const result = await deps.service.authorizeAndRun(makeRequest(), execute);

    expect(result).toEqual({
      outcome: 'EXECUTED',
      blockedBy: null,
      detail: 'REACTIVE_LOOP_DISABLED',
      value: 'executed-value',
    });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(deps.isHealthy).not.toHaveBeenCalled();
    expect(deps.tryAcquire).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('fails closed when the coordination layer is unhealthy, without acquiring a lease', async () => {
    const deps = makeDeps({ isHealthy: false });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(makeRequest(), execute);

    expect(result).toEqual({
      outcome: 'BLOCKED',
      blockedBy: null,
      detail: 'COORDINATION_UNAVAILABLE',
      value: null,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(deps.tryAcquire).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('defers when the bot lease is already held, without writing to the ledger', async () => {
    const deps = makeDeps({ tryAcquire: false });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(makeRequest(), execute);

    expect(result).toEqual({
      outcome: 'DEFERRED',
      blockedBy: null,
      detail: 'BOT_BUSY',
      value: null,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.release).not.toHaveBeenCalled();
  });

  it('returns SUPERSEDED and records it when the expected position no longer exists', async () => {
    const deps = makeDeps({ position: null });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(
      makeRequest({
        positionId: 'position-1',
        expected: { positionStatus: 'OPEN', quantity: 1, partialExitCount: 0 },
      }),
      execute,
    );

    expect(result).toEqual({
      outcome: 'SUPERSEDED',
      blockedBy: null,
      detail: 'POSITION_CHANGED',
      value: null,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(deps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: 'SUPERSEDED', detail: 'POSITION_CHANGED' }),
    });
    expect(deps.release).toHaveBeenCalledTimes(1);
  });

  it('returns SUPERSEDED when the position quantity changed under lease', async () => {
    const deps = makeDeps({
      position: { status: 'OPEN', quantity: 0.4, partialExitCount: 1 },
    });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(
      makeRequest({
        kind: 'SELL_PARTIAL',
        positionId: 'position-1',
        expected: { positionStatus: 'OPEN', quantity: 0.5, partialExitCount: 1 },
      }),
      execute,
    );

    expect(result.outcome).toBe('SUPERSEDED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('proceeds without revalidation when expected is null', async () => {
    const deps = makeDeps();
    const execute = jest.fn().mockResolvedValue('ok');

    await deps.service.authorizeAndRun(makeRequest({ expected: null }), execute);

    expect(deps.findUnique).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('blocks a BUY as DISCARDED->BLOCKED when the daily loss cap is reached and never invokes execute', async () => {
    const deps = makeDeps({ dailyLossReached: true });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(makeRequest({ kind: 'BUY' }), execute);

    expect(result).toEqual({
      outcome: 'BLOCKED',
      blockedBy: 'DAILY_LOSS',
      detail: 'DAILY_LOSS_LIMIT_REACHED',
      value: null,
    });
    expect(execute).not.toHaveBeenCalled();
    expect(deps.emitToUser).toHaveBeenCalledWith(
      'user-1',
      'agent:action-blocked',
      expect.objectContaining({ blockedBy: 'DAILY_LOSS' }),
    );
    expect(deps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: 'BLOCKED', blockedBy: 'DAILY_LOSS' }),
    });
  });

  it('defers a BUY when the hourly action cap is exhausted', async () => {
    const deps = makeDeps({
      config: makeConfig({ maxActionsPerHour: 2 }),
      counters: { _count: { _all: 2 }, _max: { occurredAt: null } },
    });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(makeRequest({ kind: 'BUY' }), execute);

    expect(result).toEqual({
      outcome: 'DEFERRED',
      blockedBy: 'ACTIONS_PER_HOUR',
      detail: 'MAX_ACTIONS_PER_HOUR_REACHED',
      value: null,
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('defers a PROTECTION_REARM when the min interval has not elapsed, but never on daily loss', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const deps = makeDeps({
      dailyLossReached: true,
      counters: {
        _count: { _all: 0 },
        _max: { occurredAt: new Date(now - 1_000) },
      },
    });
    const execute = jest.fn();

    const result = await deps.service.authorizeAndRun(
      makeRequest({ kind: 'PROTECTION_REARM' }),
      execute,
    );

    expect(result.outcome).toBe('DEFERRED');
    expect(result.blockedBy).toBe('MIN_INTERVAL');
    expect(execute).not.toHaveBeenCalled();
    (Date.now as jest.Mock).mockRestore();
  });

  describe('the hard stop can never be blocked by a cap', () => {
    it.each(['SELL_FULL', 'SELL_PARTIAL'] as const)(
      '%s always executes even with every cap exhausted simultaneously',
      async (kind) => {
        const deps = makeDeps({
          config: makeConfig({ maxActionsPerHour: 0, minActionIntervalSec: 3600 }),
          counters: {
            _count: { _all: 999 },
            _max: { occurredAt: new Date() },
          },
          dailyLossReached: true,
        });
        const execute = jest.fn().mockResolvedValue('closed');

        const result = await deps.service.authorizeAndRun(makeRequest({ kind }), execute);

        expect(result).toEqual({
          outcome: 'EXECUTED',
          blockedBy: null,
          detail: 'test action',
          value: 'closed',
        });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(deps.create).toHaveBeenCalledWith({
          data: expect.objectContaining({ outcome: 'EXECUTED', kind }),
        });
      },
    );
  });

  it('executes and records EXECUTED when caps allow the action, releasing the lease afterwards', async () => {
    const deps = makeDeps();
    const execute = jest.fn().mockResolvedValue({ tradeId: 't-1' });

    const result = await deps.service.authorizeAndRun(makeRequest(), execute);

    expect(result).toEqual({
      outcome: 'EXECUTED',
      blockedBy: null,
      detail: 'test action',
      value: { tradeId: 't-1' },
    });
    expect(deps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ outcome: 'EXECUTED', blockedBy: null }),
    });
    expect(deps.tryAcquire).toHaveBeenCalledWith(
      'rx:v1:bot:config-1',
      expect.any(String),
      expect.any(Number),
    );
    expect(deps.release).toHaveBeenCalledWith('rx:v1:bot:config-1', expect.any(String));
  });

  it('records BLOCKED with EXECUTION_ERROR and rethrows when execute() throws, still releasing the lease', async () => {
    const deps = makeDeps();
    const boom = new Error('exchange unreachable');
    const execute = jest.fn().mockRejectedValue(boom);

    await expect(deps.service.authorizeAndRun(makeRequest(), execute)).rejects.toThrow(
      'exchange unreachable',
    );

    expect(deps.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        outcome: 'BLOCKED',
        detail: expect.stringContaining('EXECUTION_ERROR: exchange unreachable'),
      }),
    });
    expect(deps.release).toHaveBeenCalledTimes(1);
  });

  it('releases the lease even when a cap blocks the action', async () => {
    const deps = makeDeps({ dailyLossReached: true });
    const execute = jest.fn();

    await deps.service.authorizeAndRun(makeRequest({ kind: 'BUY' }), execute);

    expect(deps.release).toHaveBeenCalledTimes(1);
  });
});
