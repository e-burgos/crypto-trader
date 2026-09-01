import { TradingController } from './trading.controller';
import { TradingService } from './trading.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

type EntryOrderRow = {
  id: string;
  configId: string;
  symbol: string;
  mode: string;
  entryMode: string;
  status: string;
  quantity: number;
  limitPrice: number;
  stopPrice: number | null;
  stopLimitPrice: number | null;
  trailingDeltaBips: number | null;
  referencePrice: number;
  plannedNotionalUsd: number;
  clientOrderId: string;
  orderListId: string | null;
  orderId: string | null;
  placedAt: Date;
  expiresAt: Date;
  filledLeg: string | null;
  executedPrice: number | null;
  executedQuantity: number | null;
  positionId: string | null;
  cancelReason: string | null;
  settledAt: Date | null;
};

function makeUser(userId: string): RequestUser {
  return { userId, email: `${userId}@example.com`, role: 'TRADER' };
}

function makeRow(overrides: Partial<EntryOrderRow> = {}): EntryOrderRow {
  return {
    id: 'entry-1',
    configId: 'config-1',
    symbol: 'BTCUSDT',
    mode: 'LIVE',
    entryMode: 'LIMIT_MAKER',
    status: 'RESTING',
    quantity: 0.01,
    limitPrice: 60000,
    stopPrice: null,
    stopLimitPrice: null,
    trailingDeltaBips: null,
    referencePrice: 60050,
    plannedNotionalUsd: 600,
    clientOrderId: 'ent-abc123',
    orderListId: null,
    orderId: 'order-1',
    placedAt: new Date('2026-08-20T10:00:00.000Z'),
    expiresAt: new Date('2026-08-20T12:00:00.000Z'),
    filledLeg: null,
    executedPrice: null,
    executedQuantity: null,
    positionId: null,
    cancelReason: null,
    settledAt: null,
    ...overrides,
  };
}

describe('TradingController.getEntryOrders', () => {
  function makeController(findManyResult: EntryOrderRow[]) {
    const findMany = jest.fn().mockResolvedValue(findManyResult);
    const prisma = { entryOrder: { findMany } };

    const tradingService = new TradingService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as any,
      {} as any,
    );

    const controller = new TradingController(tradingService);

    return { controller, findMany };
  }

  it('scopes the query to the requesting user only', async () => {
    const { controller, findMany } = makeController([makeRow()]);

    await controller.getEntryOrders(makeUser('user-a'), {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-a' }),
      }),
    );
  });

  it('never lets one user read another user id via filters', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getEntryOrders(makeUser('user-a'), {
      configId: 'config-owned-by-user-b',
    });

    const call = findMany.mock.calls[0][0];
    expect(call.where.userId).toBe('user-a');
    expect(call.where.configId).toBe('config-owned-by-user-b');
  });

  it('applies configId, status and since filters', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getEntryOrders(makeUser('user-a'), {
      configId: 'config-1',
      status: 'FILLED' as never,
      since: '2026-08-01T00:00:00.000Z',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-a',
          configId: 'config-1',
          status: 'FILLED',
          placedAt: { gte: new Date('2026-08-01T00:00:00.000Z') },
        }),
      }),
    );
  });

  it('maps rows to the EP-017 item shape', async () => {
    const row = makeRow({
      id: 'entry-2',
      status: 'FILLED',
      filledLeg: 'LIMIT',
      executedPrice: 59980,
      executedQuantity: 0.01,
      positionId: 'position-1',
      settledAt: new Date('2026-08-20T10:30:00.000Z'),
    });
    const { controller } = makeController([row]);

    const result = await controller.getEntryOrders(makeUser('user-a'), {});

    expect(result.items).toEqual([row]);
  });

  it('defaults limit to 50 and returns nextCursor null when there is no more data', async () => {
    const { controller, findMany } = makeController([makeRow()]);

    const result = await controller.getEntryOrders(makeUser('user-a'), {});

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 51 }));
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor pointing at the last item of the page when there is more data', async () => {
    const rows = [
      makeRow({ id: 'e1' }),
      makeRow({ id: 'e2' }),
      makeRow({ id: 'e3' }),
    ];
    const { controller } = makeController(rows);

    const result = await controller.getEntryOrders(makeUser('user-a'), {
      limit: 2,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['e1', 'e2']);
    expect(result.nextCursor).toBe('e2');
  });

  it('passes cursor and limit through to the prisma query for keyset pagination', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getEntryOrders(makeUser('user-a'), {
      cursor: 'e2',
      limit: 10,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 11,
        cursor: { id: 'e2' },
        skip: 1,
      }),
    );
  });

  it('is guarded by JwtAuthGuard and RolesGuard(TRADER), so a request without a valid JWT is rejected with 401 before reaching this handler', () => {
    const guards = Reflect.getMetadata('__guards__', TradingController);
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(Reflect.getMetadata(ROLES_KEY, TradingController)).toEqual(['TRADER']);
  });

  it('orders by placedAt desc', async () => {
    const { controller, findMany } = makeController([]);

    await controller.getEntryOrders(makeUser('user-a'), {});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
});
