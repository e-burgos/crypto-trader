import { config as loadDotenv } from 'dotenv';
import * as path from 'node:path';
import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import { LiveOrderExecutor, resolveEntryLevels } from '@crypto-trader/trading-engine';
import { TradingMode } from '@crypto-trader/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PositionActionService } from './position-action.service';
import { EntryOrderService } from './entry-order.service';
import { ActionGateService } from './action-gate.service';
import { ReconciliationService } from './reconciliation.service';
import { DisabledReactiveCoordination } from '../reactive/disabled-reactive-coordination.service';

const dotenvVars =
  loadDotenv({ path: path.resolve(__dirname, '../../../../.env'), processEnv: {} }).parsed ??
  {};
const apiKey = process.env['BINANCE_API_TESTNET_KEY'] ?? dotenvVars['BINANCE_API_TESTNET_KEY'];
const apiSecret =
  process.env['BINANCE_API_TESTNET_SECRET'] ?? dotenvVars['BINANCE_API_TESTNET_SECRET'];
process.env['DATABASE_URL'] ||= dotenvVars['DATABASE_URL'];

const describeTestnet = process.env['BINANCE_TESTNET_E2E'] === '1' ? describe : describe.skip;

const SYMBOL = 'BTCUSDT';
const QUANTITY = 0.0002;
const ENTRY_PREFIX = 'ent-';

describeTestnet('EntryOrderService + ReconciliationService against Binance TESTNET', () => {
  jest.setTimeout(120_000);

  let prisma: PrismaService;
  let client: BinanceRestClient;
  let executor: LiveOrderExecutor;
  let entryOrders: EntryOrderService;
  let actionGate: ActionGateService;
  let reconciliation: ReconciliationService;
  let userId: string;
  let config: any;
  let ref: number;
  const emitted: Array<{ event: string; payload: any }> = [];

  const gateway = {
    emitToUser: (_userId: string, event: string, payload: any) => {
      emitted.push({ event, payload });
    },
  } as any;

  const aggregateRisk = {
    evaluateDailyLoss: async () => ({ reached: false }),
  } as any;

  function reconciliationConfig() {
    return {
      id: config.id,
      asset: config.asset,
      pair: config.pair,
      mode: config.mode,
      stopLossPct: config.stopLossPct,
      takeProfitPct: config.takeProfitPct,
      stopLimitOffsetPct: config.stopLimitOffsetPct,
      nativeProtectionEnabled: false,
      closeOnProtectionFailure: false,
    };
  }

  async function ownOpenClientOrderIds(): Promise<string[]> {
    const open = await client.getOpenOrders(SYMBOL);
    return open.map((o) => o.clientOrderId).filter((c) => c.startsWith(ENTRY_PREFIX));
  }

  async function cancelThroughTheGate(reason: 'BOT_STOPPED' | 'LATER_DECISION') {
    const resting = await entryOrders.findResting(config.id, SYMBOL);
    return actionGate.authorizeAndRun(
      {
        userId,
        configId: config.id,
        symbol: SYMBOL,
        mode: TradingMode.TESTNET,
        kind: 'ENTRY_CANCEL',
        source: 'LLM_CYCLE',
        positionId: null,
        decisionId: null,
        expected: null,
        detail: reason,
      },
      () =>
        entryOrders.cancelResting({
          userId,
          configId: config.id,
          symbol: SYMBOL,
          executor,
          reason,
          rows: resting,
          recordAction: false,
        }),
    );
  }

  beforeAll(async () => {
    if (!apiKey || !apiSecret) throw new Error('testnet credentials missing');
    client = new BinanceRestClient({ apiKey, apiSecret, testnet: true });
    if (client.getBaseUrl() !== 'https://testnet.binance.vision') {
      throw new Error(`refusing to run against ${client.getBaseUrl()}`);
    }
    executor = new LiveOrderExecutor(client);
    ref = await client.getTickerPrice(SYMBOL);

    prisma = new PrismaService();
    const notifications = new NotificationsService(prisma, gateway);
    const positionAction = new PositionActionService(prisma, gateway, notifications);
    entryOrders = new EntryOrderService(prisma, notifications, gateway, positionAction);
    actionGate = new ActionGateService(prisma, gateway, aggregateRisk, new DisabledReactiveCoordination());
    reconciliation = new ReconciliationService(
      prisma,
      notifications,
      gateway,
      entryOrders,
      aggregateRisk,
      actionGate,
    );

    const user = await prisma.user.create({
      data: {
        email: `spec005-cycle02-${Date.now()}@testnet.local`,
        passwordHash: 'not-a-real-hash',
        role: 'TRADER',
        platformOperationMode: 'TESTNET',
      } as any,
    });
    userId = user.id;
    config = await prisma.tradingConfig.create({
      data: {
        userId,
        name: 'spec-005 cycle-02 testnet integration',
        asset: 'BTC',
        pair: 'USDT',
        mode: 'TESTNET',
        entryOrderMode: 'LIMIT_MAKER',
        entryOrderTtlMinutes: 120,
        entryTrailingDeltaBips: 100,
        reactiveLoopEnabled: false,
        nativeProtectionEnabled: false,
        isRunning: false,
      } as any,
    });
  });

  afterAll(async () => {
    const leftovers = await client.getOpenOrders(SYMBOL).catch(() => []);
    for (const order of leftovers) {
      if (!order.clientOrderId.startsWith(ENTRY_PREFIX)) continue;
      await client
        .cancelEntryOrder(SYMBOL, { orderListId: order.orderListId, orderId: order.orderId })
        .catch(() => null);
    }
    expect(await ownOpenClientOrderIds()).toHaveLength(0);
    if (userId) await prisma.user.delete({ where: { id: userId } });
    await prisma.onModuleDestroy();
  });

  it('S1 — LIMIT_MAKER resting entry: placed on testnet, persisted RESTING, seen by reconciliation, cancelled through the gate on bot stop', async () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: ref,
      support: [ref * 0.6],
      resistance: [],
      orderPriceOffsetPct: 0,
    });
    expect(plan).not.toBeNull();

    const row = await entryOrders.placeResting({
      userId,
      config,
      symbol: SYMBOL,
      mode: TradingMode.TESTNET,
      executor,
      plan: plan!,
      stopLimitPrice: null,
      quantity: QUANTITY,
      referencePrice: ref,
      plannedNotionalUsd: plan!.limitPrice * QUANTITY,
      decisionId: null,
    });
    expect(row.clientOrderId.startsWith(ENTRY_PREFIX)).toBe(true);
    expect(row.orderId).toBeTruthy();
    expect(await ownOpenClientOrderIds()).toContain(row.clientOrderId);
    expect(emitted.at(-1)?.event).toBe('entry-order:placed');

    const outcome = await reconciliation.reconcile({
      userId,
      config: reconciliationConfig(),
      symbol: SYMBOL,
      executor,
    });
    expect(outcome.entryOrdersSettled).toBe(0);
    expect(outcome.entryOrdersExpired).toBe(0);
    expect(outcome.entryOrphansCancelled).toBe(0);
    const afterReconcile = await prisma.entryOrder.findUniqueOrThrow({ where: { id: row.id } });
    expect(afterReconcile.status).toBe('RESTING');
    expect(await entryOrders.countResting({ userId, configId: config.id, mode: 'TESTNET' } as any)).toBe(1);

    const gateResult = await cancelThroughTheGate('BOT_STOPPED');
    expect(gateResult.outcome).toBe('EXECUTED');
    const cancelled = await prisma.entryOrder.findUniqueOrThrow({ where: { id: row.id } });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancelReason).toBe('BOT_STOPPED');
    expect(cancelled.settledAt).not.toBeNull();
    expect(await ownOpenClientOrderIds()).not.toContain(row.clientOrderId);
    expect(emitted.at(-1)?.event).toBe('entry-order:cancelled');
  });

  it('S2 — OCO resting entry with aboveTrailingDelta: both legs on testnet, RESTING after reconciliation, EXPIRED by TTL with the exchange cancelled before the row', async () => {
    const plan = resolveEntryLevels({
      mode: 'OCO',
      referencePrice: ref,
      support: [ref * 0.6],
      resistance: [ref * 1.4],
      orderPriceOffsetPct: 0,
    });
    expect(plan?.mode).toBe('OCO');
    const stopLimitPrice = plan!.stopPrice! * (1 + config.stopLimitOffsetPct);

    const row = await entryOrders.placeResting({
      userId,
      config: { ...config, entryOrderMode: 'OCO' },
      symbol: SYMBOL,
      mode: TradingMode.TESTNET,
      executor,
      plan: plan!,
      stopLimitPrice,
      quantity: QUANTITY,
      referencePrice: ref,
      plannedNotionalUsd: stopLimitPrice * QUANTITY,
      decisionId: null,
    });
    expect(row.orderListId).toBeTruthy();
    expect(row.limitLegOrderId).toBeTruthy();
    expect(row.stopLegOrderId).toBeTruthy();
    expect(row.trailingDeltaBips).toBe(100);
    const openAfterPlace = await ownOpenClientOrderIds();
    expect(openAfterPlace).toContain(`${row.clientOrderId}-l`);
    expect(openAfterPlace).toContain(`${row.clientOrderId}-s`);

    const status = await executor.getEntryOrderStatus(SYMBOL, {
      orderListId: row.orderListId,
      orderId: null,
      limitLegOrderId: row.limitLegOrderId,
      stopLegOrderId: row.stopLegOrderId,
    });
    expect(status.state).toBe('RESTING');

    const first = await reconciliation.reconcile({
      userId,
      config: reconciliationConfig(),
      symbol: SYMBOL,
      executor,
    });
    expect(first.entryOrdersExpired).toBe(0);
    expect((await prisma.entryOrder.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('RESTING');

    await prisma.entryOrder.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const second = await reconciliation.reconcile({
      userId,
      config: reconciliationConfig(),
      symbol: SYMBOL,
      executor,
    });
    expect(second.entryOrdersExpired).toBe(1);
    const expired = await prisma.entryOrder.findUniqueOrThrow({ where: { id: row.id } });
    expect(expired.status).toBe('EXPIRED');
    expect(expired.cancelReason).toBe('TTL_EXPIRED');
    const openAfterExpiry = await ownOpenClientOrderIds();
    expect(openAfterExpiry).not.toContain(`${row.clientOrderId}-l`);
    expect(openAfterExpiry).not.toContain(`${row.clientOrderId}-s`);
    expect(emitted.at(-1)?.event).toBe('entry-order:expired');
  });

  it('S3 — an entry cancelled from outside (the trader, on the exchange) is reconciled as CANCELLED / VANISHED_ON_EXCHANGE and the row is never deleted', async () => {
    const plan = resolveEntryLevels({
      mode: 'LIMIT_MAKER',
      referencePrice: ref,
      support: [ref * 0.6],
      resistance: [],
      orderPriceOffsetPct: 0,
    });
    const row = await entryOrders.placeResting({
      userId,
      config,
      symbol: SYMBOL,
      mode: TradingMode.TESTNET,
      executor,
      plan: plan!,
      stopLimitPrice: null,
      quantity: QUANTITY,
      referencePrice: ref,
      plannedNotionalUsd: plan!.limitPrice * QUANTITY,
      decisionId: null,
    });
    await client.cancelEntryOrder(SYMBOL, { orderListId: null, orderId: row.orderId });

    const outcome = await reconciliation.reconcile({
      userId,
      config: reconciliationConfig(),
      symbol: SYMBOL,
      executor,
    });
    expect(outcome.entryOrdersSettled).toBe(0);
    const vanished = await prisma.entryOrder.findUniqueOrThrow({ where: { id: row.id } });
    expect(vanished.status).toBe('CANCELLED');
    expect(vanished.cancelReason).toBe('VANISHED_ON_EXCHANGE');
    expect(await entryOrders.countResting({ userId, configId: config.id, mode: 'TESTNET' } as any)).toBe(0);
  });

  it('S4 — an orphan ent- order on the exchange without a RESTING row is swept by the reconciliation', async () => {
    const orphanCid = `ent-${Date.now().toString(16)}orphanprobe000`;
    const placed = await client.placeLimitMakerBuyOrder(SYMBOL, {
      quantity: QUANTITY,
      price: ref * 0.6,
      referencePrice: ref,
      clientOrderId: orphanCid,
    });
    expect(placed.orderId).toBeTruthy();
    expect(await ownOpenClientOrderIds()).toContain(orphanCid);

    const outcome = await reconciliation.reconcile({
      userId,
      config: reconciliationConfig(),
      symbol: SYMBOL,
      executor,
    });
    expect(outcome.entryOrphansCancelled).toBe(1);
    expect(await ownOpenClientOrderIds()).not.toContain(orphanCid);
  });
});
