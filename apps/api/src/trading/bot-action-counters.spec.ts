import { getBotActionCounters } from './bot-action-counters';

describe('getBotActionCounters', () => {
  function makePrisma(aggregate: jest.Mock) {
    return { botAction: { aggregate } } as any;
  }

  it('returns zero executed actions and no last timestamp when the window is empty', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _max: { occurredAt: null },
    });

    const result = await getBotActionCounters(makePrisma(aggregate), {
      configId: 'config-1',
      now: 1_700_000_000_000,
    });

    expect(result).toEqual({
      executedActionsInLastHour: 0,
      lastExecutedActionAtMs: null,
    });
  });

  it('returns the executed count and the most recent timestamp within the window', async () => {
    const lastOccurredAt = new Date(1_700_000_000_000 - 5 * 60 * 1000);
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 3 },
      _max: { occurredAt: lastOccurredAt },
    });

    const result = await getBotActionCounters(makePrisma(aggregate), {
      configId: 'config-1',
      now: 1_700_000_000_000,
    });

    expect(result).toEqual({
      executedActionsInLastHour: 3,
      lastExecutedActionAtMs: lastOccurredAt.getTime(),
    });
  });

  it('queries only EXECUTED actions for the given config within a rolling hour ending at now', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _max: { occurredAt: null },
    });
    const now = 1_700_000_000_000;

    await getBotActionCounters(makePrisma(aggregate), {
      configId: 'config-42',
      now,
    });

    expect(aggregate).toHaveBeenCalledWith({
      where: {
        configId: 'config-42',
        outcome: 'EXECUTED',
        occurredAt: { gte: new Date(now - 60 * 60 * 1000) },
      },
      _count: { _all: true },
      _max: { occurredAt: true },
    });
  });

  it('uses a rolling window relative to the provided now, not a fixed clock bucket', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _max: { occurredAt: null },
    });

    await getBotActionCounters(makePrisma(aggregate), {
      configId: 'config-1',
      now: 1_700_003_723_000,
    });

    const [[callArgs]] = aggregate.mock.calls;
    expect(callArgs.where.occurredAt.gte).toEqual(
      new Date(1_700_003_723_000 - 60 * 60 * 1000),
    );
  });

  it('scopes the query strictly by the requested configId, isolating counters per bot', async () => {
    const aggregate = jest.fn().mockResolvedValue({
      _count: { _all: 0 },
      _max: { occurredAt: null },
    });

    await getBotActionCounters(makePrisma(aggregate), {
      configId: 'config-a',
      now: 1_700_000_000_000,
    });
    await getBotActionCounters(makePrisma(aggregate), {
      configId: 'config-b',
      now: 1_700_000_000_000,
    });

    expect(aggregate.mock.calls[0][0].where.configId).toBe('config-a');
    expect(aggregate.mock.calls[1][0].where.configId).toBe('config-b');
  });
});
