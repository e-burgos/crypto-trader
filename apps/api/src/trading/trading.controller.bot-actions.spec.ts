import { TradingController } from './trading.controller';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

type BotActionRow = {
  id: string;
  configId: string;
  kind: string;
  source: string;
  outcome: string;
  blockedBy: string | null;
  positionId: string | null;
  decisionId: string | null;
  detail: string | null;
  occurredAt: Date;
};

function makeUser(userId: string): RequestUser {
  return { userId, email: `${userId}@example.com`, role: 'TRADER' };
}

function makeRow(overrides: Partial<BotActionRow> = {}): BotActionRow {
  return {
    id: 'action-1',
    configId: 'config-1',
    kind: 'BUY',
    source: 'FAST_PATH',
    outcome: 'EXECUTED',
    blockedBy: null,
    positionId: null,
    decisionId: null,
    detail: 'OK',
    occurredAt: new Date('2026-08-20T10:00:00.000Z'),
    ...overrides,
  };
}

describe('TradingController.getBotActions', () => {
  function makeController(findManyResult: BotActionRow[]) {
    const findMany = jest.fn().mockResolvedValue(findManyResult);
    const prisma = { botAction: { findMany } };

    const tradingService = {};

    const controller = new TradingController(
      tradingService as never,
      prisma as never,
    );

    return { controller, findMany };
  }

  it('scopes the query to the requesting user only', async () => {
    const { controller, findMany } = makeController([makeRow()]);

    await controller.getBotActions(makeUser('user-a'), {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-a' }),
      }),
    );
  });

  it('never lets one user read another user id via filters', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getBotActions(makeUser('user-a'), { configId: 'config-owned-by-user-b' });

    const call = findMany.mock.calls[0][0];
    expect(call.where.userId).toBe('user-a');
    expect(call.where.configId).toBe('config-owned-by-user-b');
  });

  it('applies configId, outcome and since filters', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getBotActions(makeUser('user-a'), {
      configId: 'config-1',
      outcome: 'BLOCKED' as never,
      since: '2026-08-01T00:00:00.000Z',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-a',
          configId: 'config-1',
          outcome: 'BLOCKED',
          occurredAt: { gte: new Date('2026-08-01T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('maps rows to the EP-016 item shape and returns blockedBy distinct from a plain HOLD', async () => {
    const row = makeRow({
      id: 'action-2',
      outcome: 'BLOCKED',
      blockedBy: 'ACTIONS_PER_HOUR',
      detail: 'CAP_ACTIONS_PER_HOUR',
    });
    const { controller } = makeController([row]);

    const result = await controller.getBotActions(makeUser('user-a'), {});

    expect(result.items).toEqual([
      {
        id: 'action-2',
        configId: 'config-1',
        kind: 'BUY',
        source: 'FAST_PATH',
        outcome: 'BLOCKED',
        blockedBy: 'ACTIONS_PER_HOUR',
        positionId: null,
        decisionId: null,
        detail: 'CAP_ACTIONS_PER_HOUR',
        occurredAt: row.occurredAt,
      },
    ]);
  });

  it('defaults limit to 50 and returns nextCursor null when there is no more data', async () => {
    const { controller, findMany } = makeController([makeRow()]);

    const result = await controller.getBotActions(makeUser('user-a'), {});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor pointing at the last item of the page when there is more data', async () => {
    const rows = [
      makeRow({ id: 'a1' }),
      makeRow({ id: 'a2' }),
      makeRow({ id: 'a3' }),
    ];
    const { controller } = makeController(rows);

    const result = await controller.getBotActions(makeUser('user-a'), { limit: 2 });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(result.nextCursor).toBe('a2');
  });

  it('passes cursor and limit through to the prisma query for keyset pagination', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getBotActions(makeUser('user-a'), { cursor: 'a2', limit: 10 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        cursor: { id: 'a2' },
        skip: 1,
      }),
    );
  });
});
