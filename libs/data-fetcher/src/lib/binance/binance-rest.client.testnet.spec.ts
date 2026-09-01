import { config as loadDotenv } from 'dotenv';
import * as path from 'node:path';
import { BinanceRestClient, OrderValidationError } from './binance-rest.client';

const dotenvResult = loadDotenv({
  path: path.resolve(__dirname, '../../../../../.env'),
  processEnv: {},
});
const dotenvVars = dotenvResult.parsed ?? {};

const apiKey =
  process.env['BINANCE_API_TESTNET_KEY'] ?? dotenvVars['BINANCE_API_TESTNET_KEY'];
const apiSecret =
  process.env['BINANCE_API_TESTNET_SECRET'] ??
  dotenvVars['BINANCE_API_TESTNET_SECRET'];

const TESTNET_E2E_ENABLED = process.env['BINANCE_TESTNET_E2E'] === '1';
const describeTestnet = TESTNET_E2E_ENABLED ? describe : describe.skip;

const SYMBOL = 'BTCUSDT';
const QUANTITY = 0.0002;
const CLIENT_ORDER_PREFIX = 'ent-e2e-';

function entryClientOrderId(scenario: string): string {
  return `${CLIENT_ORDER_PREFIX}${scenario}-${Date.now()}`;
}

describeTestnet('BinanceRestClient TESTNET harness', () => {
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  let client: BinanceRestClient;
  let ref: number;

  beforeAll(async () => {
    if (!apiKey || !apiSecret) {
      throw new Error(
        'BINANCE_TESTNET_E2E=1 requires BINANCE_API_TESTNET_KEY and BINANCE_API_TESTNET_SECRET',
      );
    }

    client = new BinanceRestClient({ apiKey, apiSecret, testnet: true });

    expect(client.getBaseUrl()).toBe('https://testnet.binance.vision');

    ref = await client.getTickerPrice(SYMBOL);
  });

  afterAll(async () => {
    const remaining = await client.getOpenOrders(SYMBOL);
    const ownLeftovers = remaining.filter((order) =>
      order.clientOrderId.startsWith(CLIENT_ORDER_PREFIX),
    );

    await Promise.all(
      ownLeftovers.map((order) =>
        client.cancelEntryOrder(SYMBOL, {
          orderListId: order.orderListId,
          orderId: order.orderId,
        }),
      ),
    );

    const finalOpenOrders = await client.getOpenOrders(SYMBOL);
    expect(
      finalOpenOrders.filter((order) =>
        order.clientOrderId.startsWith(CLIENT_ORDER_PREFIX),
      ),
    ).toHaveLength(0);
  });

  it('places, queries and cancels a LIMIT_MAKER BUY resting order', async () => {
    const placed = await client.placeLimitMakerBuyOrder(SYMBOL, {
      quantity: QUANTITY,
      price: ref * 0.6,
      referencePrice: ref,
      clientOrderId: entryClientOrderId('s1'),
    });

    const status = await client.getEntryOrderStatus(SYMBOL, {
      orderId: placed.orderId,
    });
    expect(status.state).toBe('RESTING');

    await client.cancelEntryOrder(SYMBOL, { orderId: placed.orderId });
  });

  it('places, queries and cancels a STOP_LOSS_LIMIT BUY with stopPrice and trailingDelta', async () => {
    const stopPrice = ref * 1.4;
    const limitPrice = stopPrice * 1.001;

    const placed = await client.placeStopLossLimitOrder(
      SYMBOL,
      'BUY',
      QUANTITY,
      stopPrice,
      limitPrice,
      { clientOrderId: entryClientOrderId('s2'), trailingDeltaBips: 100 },
    );

    const status = await client.getEntryOrderStatus(SYMBOL, {
      orderId: placed.orderId,
    });
    expect(status.state).toBe('RESTING');

    await client.cancelEntryOrder(SYMBOL, { orderId: placed.orderId });
  });

  it('places, queries and cancels a STOP_LOSS_LIMIT BUY with trailingDelta and no stopPrice', async () => {
    const limitPrice = ref * 1.4 * 1.001;

    const placed = await client.placeStopLossLimitOrder(
      SYMBOL,
      'BUY',
      QUANTITY,
      null,
      limitPrice,
      { clientOrderId: entryClientOrderId('s3'), trailingDeltaBips: 100 },
    );

    const status = await client.getEntryOrderStatus(SYMBOL, {
      orderId: placed.orderId,
    });
    expect(status.state).toBe('RESTING');

    await client.cancelEntryOrder(SYMBOL, { orderId: placed.orderId });
  });

  it('places, queries both legs and cancels an OCO BUY without trailingDelta', async () => {
    const belowPrice = ref * 0.6;
    const aboveStopPrice = ref * 1.4;
    const abovePrice = aboveStopPrice * 1.001;

    const placed = await client.placeOcoBuyOrder(SYMBOL, {
      quantity: QUANTITY,
      belowPrice,
      aboveStopPrice,
      abovePrice,
      referencePrice: ref,
      listClientOrderId: entryClientOrderId('s4-list'),
      belowClientOrderId: entryClientOrderId('s4-below'),
      aboveClientOrderId: entryClientOrderId('s4-above'),
    });

    const overallStatus = await client.getEntryOrderStatus(SYMBOL, {
      orderListId: placed.orderListId,
    });
    expect(overallStatus.state).toBe('RESTING');

    const limitLegStatus = await client.getEntryOrderStatus(
      SYMBOL,
      {
        orderListId: placed.orderListId,
        limitLegOrderId: placed.limitOrderId,
        stopLegOrderId: placed.stopOrderId,
      },
      { leg: 'LIMIT' },
    );
    expect(limitLegStatus.state).toBe('RESTING');

    const stopLegStatus = await client.getEntryOrderStatus(
      SYMBOL,
      {
        orderListId: placed.orderListId,
        limitLegOrderId: placed.limitOrderId,
        stopLegOrderId: placed.stopOrderId,
      },
      { leg: 'STOP' },
    );
    expect(stopLegStatus.state).toBe('RESTING');

    await client.cancelEntryOrder(SYMBOL, { orderListId: placed.orderListId });
  });

  it('places, queries and cancels an OCO BUY with aboveTrailingDeltaBips', async () => {
    const belowPrice = ref * 0.6;
    const aboveStopPrice = ref * 1.4;
    const abovePrice = aboveStopPrice * 1.001;

    const placed = await client.placeOcoBuyOrder(SYMBOL, {
      quantity: QUANTITY,
      belowPrice,
      aboveStopPrice,
      abovePrice,
      aboveTrailingDeltaBips: 100,
      referencePrice: ref,
      listClientOrderId: entryClientOrderId('s5-list'),
      belowClientOrderId: entryClientOrderId('s5-below'),
      aboveClientOrderId: entryClientOrderId('s5-above'),
    });

    const overallStatus = await client.getEntryOrderStatus(SYMBOL, {
      orderListId: placed.orderListId,
    });
    expect(overallStatus.state).toBe('RESTING');

    await client.cancelEntryOrder(SYMBOL, { orderListId: placed.orderListId });
  });

  it('rejects a trailingDelta below the symbol filter minimum without calling the transport', async () => {
    const before = await client.getOpenOrders(SYMBOL);

    await expect(
      client.placeStopLossLimitOrder(
        SYMBOL,
        'BUY',
        QUANTITY,
        ref * 1.4,
        ref * 1.4 * 1.001,
        { clientOrderId: entryClientOrderId('s6'), trailingDeltaBips: 5 },
      ),
    ).rejects.toMatchObject({ code: 'TRAILING_DELTA' } as Partial<OrderValidationError>);

    const after = await client.getOpenOrders(SYMBOL);
    expect(after).toEqual(before);
  });

  it('rejects a LIMIT_MAKER BUY above market without calling the transport', async () => {
    const before = await client.getOpenOrders(SYMBOL);

    await expect(
      client.placeLimitMakerBuyOrder(SYMBOL, {
        quantity: QUANTITY,
        price: ref * 1.05,
        referencePrice: ref,
        clientOrderId: entryClientOrderId('s7'),
      }),
    ).rejects.toMatchObject({
      code: 'PRICE_CROSSES_MARKET',
    } as Partial<OrderValidationError>);

    const after = await client.getOpenOrders(SYMBOL);
    expect(after).toEqual(before);
  });
});
