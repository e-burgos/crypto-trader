import { config as loadDotenv } from 'dotenv';
import * as path from 'node:path';
import axios from 'axios';
import { BinanceRestClient } from './binance-rest.client';
import {
  BinanceUserDataStreamClient,
  ExecutionReportEvent,
} from './binance-user-data-stream.client';

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

const TESTNET_REST_BASE_URL = 'https://testnet.binance.vision';
const TESTNET_WS_BASE_URL = 'wss://stream.testnet.binance.vision';
const SYMBOL = 'BTCUSDT';
const QUANTITY = 0.0002;
const CLIENT_ORDER_PREFIX = 'ent-e2e-';
const CONNECTED_EVENT_TIMEOUT_MS = 15_000;
const EXECUTION_REPORT_TIMEOUT_MS = 20_000;

function entryClientOrderId(scenario: string): string {
  return `${CLIENT_ORDER_PREFIX}${scenario}-${Date.now()}`;
}

function waitForEvent<T>(
  emitter: BinanceUserDataStreamClient,
  eventName: string,
  timeoutMs: number,
  predicate?: (payload: T) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.removeListener(eventName, onEvent);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${eventName}"`));
    }, timeoutMs);

    function onEvent(payload: T): void {
      if (predicate && !predicate(payload)) return;
      clearTimeout(timer);
      emitter.removeListener(eventName, onEvent);
      resolve(payload);
    }

    emitter.on(eventName, onEvent);
  });
}

function readUsedWeightHeader(headers: Record<string, unknown>): number {
  const raw = headers['x-mbx-used-weight-1m'] ?? headers['X-MBX-USED-WEIGHT-1M'];
  return typeof raw === 'string' ? Number(raw) : NaN;
}

async function measureUserDataStreamKeepAliveWeightDelta(
  listenKey: string,
): Promise<{ before: number; after: number; delta: number }> {
  const probe = axios.create({ baseURL: TESTNET_REST_BASE_URL, timeout: 10_000 });

  const beforeResponse = await probe.get('/api/v3/time');
  const before = readUsedWeightHeader(
    beforeResponse.headers as Record<string, unknown>,
  );

  const afterResponse = await probe.put('/api/v3/userDataStream', null, {
    headers: { 'X-MBX-APIKEY': apiKey },
    params: { listenKey },
  });
  const after = readUsedWeightHeader(afterResponse.headers as Record<string, unknown>);

  return { before, after, delta: after - before };
}

describeTestnet('BinanceUserDataStreamClient TESTNET harness', () => {
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  let restClient: BinanceRestClient;
  let wsClient: BinanceUserDataStreamClient;
  let listenKey: string;
  let ref: number;
  let pendingOrderId: string | null = null;

  beforeAll(async () => {
    if (!apiKey || !apiSecret) {
      throw new Error(
        'BINANCE_TESTNET_E2E=1 requires BINANCE_API_TESTNET_KEY and BINANCE_API_TESTNET_SECRET',
      );
    }

    restClient = new BinanceRestClient({ apiKey, apiSecret, testnet: true });
    wsClient = new BinanceUserDataStreamClient({ testnet: true });

    expect(restClient.getBaseUrl()).toBe(TESTNET_REST_BASE_URL);
    expect(wsClient.getBaseUrl()).toBe(TESTNET_WS_BASE_URL);

    ref = await restClient.getTickerPrice(SYMBOL);
    listenKey = await restClient.createListenKey();
    expect(typeof listenKey).toBe('string');
    expect(listenKey.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (pendingOrderId) {
      await restClient
        .cancelEntryOrder(SYMBOL, { orderId: pendingOrderId })
        .catch(() => undefined);
    }

    const remaining = await restClient.getOpenOrders(SYMBOL);
    const ownLeftovers = remaining.filter((order) =>
      order.clientOrderId.startsWith(CLIENT_ORDER_PREFIX),
    );

    await Promise.all(
      ownLeftovers.map((order) =>
        restClient.cancelEntryOrder(SYMBOL, {
          orderListId: order.orderListId,
          orderId: order.orderId,
        }),
      ),
    );

    const finalOpenOrders = await restClient.getOpenOrders(SYMBOL);
    expect(
      finalOpenOrders.filter((order) =>
        order.clientOrderId.startsWith(CLIENT_ORDER_PREFIX),
      ),
    ).toHaveLength(0);

    if (listenKey) {
      await restClient.closeListenKey(listenKey);
    }
    wsClient.disconnect();
  });

  it('creates, renews, streams and closes a real TESTNET user data stream', async () => {
    await restClient.keepAliveListenKey(listenKey);

    const weightEvidence = await measureUserDataStreamKeepAliveWeightDelta(listenKey);
    console.log(
      `[TESTNET evidence] userDataStream PUT x-mbx-used-weight-1m before=${weightEvidence.before} after=${weightEvidence.after} delta=${weightEvidence.delta}`,
    );
    expect(Number.isFinite(weightEvidence.delta)).toBe(true);

    const connected = waitForEvent(wsClient, 'connected', CONNECTED_EVENT_TIMEOUT_MS);
    wsClient.connect(listenKey);
    await connected;
    expect(wsClient.isConnected()).toBe(true);

    const clientOrderId = entryClientOrderId('uds');
    const executionReport = waitForEvent<ExecutionReportEvent>(
      wsClient,
      'execution-report',
      EXECUTION_REPORT_TIMEOUT_MS,
      (report) => report.clientOrderId === clientOrderId,
    );

    const placed = await restClient.placeLimitMakerBuyOrder(SYMBOL, {
      quantity: QUANTITY,
      price: ref * 0.6,
      referencePrice: ref,
      clientOrderId,
    });
    pendingOrderId = placed.orderId;

    const report = await executionReport;
    expect(report.clientOrderId).toBe(clientOrderId);
    expect(report.symbol).toBe(SYMBOL);
    expect(report.side).toBe('BUY');

    await restClient.cancelEntryOrder(SYMBOL, { orderId: placed.orderId });
    pendingOrderId = null;
  });
});
