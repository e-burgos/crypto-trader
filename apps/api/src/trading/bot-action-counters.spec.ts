import { getBotActionCounters } from './bot-action-counters';

interface FakeBotActionRow {
  configId: string;
  outcome: string;
  source: string;
  kind: string;
  occurredAt: Date;
}

describe('getBotActionCounters', () => {
  function makePrisma(aggregate: jest.Mock) {
    return { botAction: { aggregate } } as any;
  }

  function makeFilteringAggregate(rows: FakeBotActionRow[]) {
    return jest.fn((args: {
      where: {
        configId: string;
        outcome: string;
        occurredAt: { gte: Date };
        source: { not: string };
        kind: { not: string };
      };
    }) => {
      const { where } = args;
      const matching = rows.filter(
        (row) =>
          row.configId === where.configId &&
          row.outcome === where.outcome &&
          row.occurredAt.getTime() >= where.occurredAt.gte.getTime() &&
          row.source !== where.source.not &&
          row.kind !== where.kind.not,
      );
      const lastOccurredAt = matching.reduce<Date | null>(
        (latest, row) =>
          !latest || row.occurredAt.getTime() > latest.getTime() ? row.occurredAt : latest,
        null,
      );
      return Promise.resolve({
        _count: { _all: matching.length },
        _max: { occurredAt: lastOccurredAt },
      });
    });
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
        source: { not: 'EXCHANGE_TRIGGER' },
        kind: { not: 'ENTRY_CANCEL' },
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

  it('excludes an EXCHANGE_TRIGGER row from the count and from the last-executed timestamp', async () => {
    const now = 1_700_000_000_000;
    const llmCycleOccurredAt = new Date(now - 5 * 60 * 1000);
    const exchangeTriggerOccurredAt = new Date(now - 1 * 60 * 1000);
    const rows: FakeBotActionRow[] = [
      {
        configId: 'config-1',
        outcome: 'EXECUTED',
        source: 'LLM_CYCLE',
        kind: 'BUY',
        occurredAt: llmCycleOccurredAt,
      },
      {
        configId: 'config-1',
        outcome: 'EXECUTED',
        source: 'EXCHANGE_TRIGGER',
        kind: 'BUY',
        occurredAt: exchangeTriggerOccurredAt,
      },
    ];

    const result = await getBotActionCounters(makePrisma(makeFilteringAggregate(rows)), {
      configId: 'config-1',
      now,
    });

    expect(result).toEqual({
      executedActionsInLastHour: 1,
      lastExecutedActionAtMs: llmCycleOccurredAt.getTime(),
    });
  });

  it('excludes an ENTRY_CANCEL row from the count and from the last-executed timestamp', async () => {
    const now = 1_700_000_000_000;
    const buyOccurredAt = new Date(now - 5 * 60 * 1000);
    const entryCancelOccurredAt = new Date(now - 1 * 60 * 1000);
    const rows: FakeBotActionRow[] = [
      {
        configId: 'config-1',
        outcome: 'EXECUTED',
        source: 'LLM_CYCLE',
        kind: 'BUY',
        occurredAt: buyOccurredAt,
      },
      {
        configId: 'config-1',
        outcome: 'EXECUTED',
        source: 'LLM_CYCLE',
        kind: 'ENTRY_CANCEL',
        occurredAt: entryCancelOccurredAt,
      },
    ];

    const result = await getBotActionCounters(makePrisma(makeFilteringAggregate(rows)), {
      configId: 'config-1',
      now,
    });

    expect(result).toEqual({
      executedActionsInLastHour: 1,
      lastExecutedActionAtMs: buyOccurredAt.getTime(),
    });
  });

  it('counts pre-existing LLM_CYCLE and FAST_PATH EXECUTED rows exactly as before (CA-001)', async () => {
    const now = 1_700_000_000_000;
    const firstOccurredAt = new Date(now - 10 * 60 * 1000);
    const secondOccurredAt = new Date(now - 2 * 60 * 1000);
    const rows: FakeBotActionRow[] = [
      {
        configId: 'config-1',
        outcome: 'EXECUTED',
        source: 'LLM_CYCLE',
        kind: 'BUY',
        occurredAt: firstOccurredAt,
      },
      {
        configId: 'config-1',
        outcome: 'EXECUTED',
        source: 'FAST_PATH',
        kind: 'SELL_FULL',
        occurredAt: secondOccurredAt,
      },
    ];

    const result = await getBotActionCounters(makePrisma(makeFilteringAggregate(rows)), {
      configId: 'config-1',
      now,
    });

    expect(result).toEqual({
      executedActionsInLastHour: 2,
      lastExecutedActionAtMs: secondOccurredAt.getTime(),
    });
  });
});
