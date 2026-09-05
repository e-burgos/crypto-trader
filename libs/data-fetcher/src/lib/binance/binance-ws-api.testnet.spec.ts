import { config as loadDotenv } from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { BinanceRestClient } from './binance-rest.client';
import {
  BinanceWsApiClient,
  BinanceWsApiError,
  BINANCE_WS_API_TESTNET_URL,
} from './binance-ws-api.client';
import { createEd25519Signer } from './ed25519-signer';
import type { ExecutionReportEvent } from './execution-report';

const TESTNET_REST_BASE_URL = 'https://testnet.binance.vision';

const dotenvResult = loadDotenv({
  path: path.resolve(__dirname, '../../../../../.env'),
  processEnv: {},
});
const dotenvVars = dotenvResult.parsed ?? {};

function readEnv(name: string): string | undefined {
  const value = process.env[name] ?? dotenvVars[name];
  return value && value.length > 0 ? value : undefined;
}

function readEd25519PrivateKeyPem(): string | undefined {
  const keyPath = readEnv('BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH');
  if (keyPath) {
    return fs.readFileSync(keyPath, 'utf8');
  }
  const inline = readEnv('BINANCE_API_TESTNET_ED25519_PRIVATE_KEY');
  return inline ? inline.replace(/\\n/g, '\n').trim() : undefined;
}

const TESTNET_E2E_ENABLED = readEnv('BINANCE_TESTNET_E2E') === '1';
const describeTestnet = TESTNET_E2E_ENABLED ? describe : describe.skip;

const hmacApiKey = readEnv('BINANCE_API_TESTNET_KEY');
const hmacApiSecret = readEnv('BINANCE_API_TESTNET_SECRET');

const ed25519ApiKey = readEnv('BINANCE_API_TESTNET_ED25519_KEY');
const ed25519PrivateKeyPem = (() => {
  try {
    return readEd25519PrivateKeyPem();
  } catch {
    return undefined;
  }
})();

const ED25519_CREDENTIAL_PRESENT = Boolean(ed25519ApiKey && ed25519PrivateKeyPem);
const describeAuthenticated = ED25519_CREDENTIAL_PRESENT ? describe : describe.skip;
const MISSING_ED25519_CREDENTIAL_MESSAGE =
  'Blocked by absence of the Ed25519 TESTNET credential, not by a transport defect. ' +
  'Set BINANCE_API_TESTNET_ED25519_KEY and one of BINANCE_API_TESTNET_ED25519_PRIVATE_KEY / ' +
  'BINANCE_API_TESTNET_ED25519_PRIVATE_KEY_PATH in .env (architect.md §1.2) to unblock this half ' +
  'of the harness.';

const SYMBOL = 'BTCUSDT';
const QUANTITY = 0.0002;
const CLIENT_ORDER_PREFIX = 'ent-e2e-uds-';
const CONNECTED_EVENT_TIMEOUT_MS = 15_000;
const EXECUTION_REPORT_TIMEOUT_MS = 20_000;

function entryClientOrderId(scenario: string): string {
  return `${CLIENT_ORDER_PREFIX}${scenario}-${Date.now()}`;
}

function waitForEvent<T>(
  client: BinanceWsApiClient,
  eventName: string,
  timeoutMs: number,
  predicate?: (payload: T) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.removeListener(eventName, onEvent);
      reject(new Error(`Timed out after ${timeoutMs}ms waiting for "${eventName}"`));
    }, timeoutMs);

    function onEvent(payload: T): void {
      if (predicate && !predicate(payload)) return;
      clearTimeout(timer);
      client.removeListener(eventName, onEvent);
      resolve(payload);
    }

    client.on(eventName, onEvent);
  });
}

interface HasInternalSocket {
  ws: { close(): void } | null;
}

function forceCloseUnderlyingSocket(client: BinanceWsApiClient): void {
  (client as unknown as HasInternalSocket).ws?.close();
}

describeTestnet('BinanceWsApiClient TESTNET harness', () => {
  vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

  let client: BinanceWsApiClient;

  beforeAll(async () => {
    client = new BinanceWsApiClient({ testnet: true });

    if (client.getBaseUrl() !== BINANCE_WS_API_TESTNET_URL) {
      throw new Error(
        `Refusing to run: base URL '${client.getBaseUrl()}' is not the TESTNET WebSocket API`,
      );
    }

    const connected = waitForEvent(client, 'connected', CONNECTED_EVENT_TIMEOUT_MS);
    await client.connect();
    await connected;
  });

  afterAll(() => {
    client.disconnect();
  });

  describe('credential-free surface (no Ed25519 required)', () => {
    it('answers ping with status 200', async () => {
      await expect(client.ping()).resolves.toBeUndefined();
    });

    it('answers time with status 200 and a serverTime', async () => {
      const serverTime = await client.time();
      expect(Number.isFinite(serverTime)).toBe(true);
      expect(serverTime).toBeGreaterThan(0);
    });

    it('rejects an unauthenticated userDataStream.subscribe with -1193', async () => {
      await expect(client.subscribeUserDataStream()).rejects.toMatchObject({
        status: 400,
        code: -1193,
      } as Partial<BinanceWsApiError>);
    });
  });

  const authenticatedBlockTitle = ED25519_CREDENTIAL_PRESENT
    ? 'authenticated session (Ed25519 TESTNET credential loaded)'
    : `authenticated session — SKIPPED: ${MISSING_ED25519_CREDENTIAL_MESSAGE}`;

  describeAuthenticated(authenticatedBlockTitle, () => {
    let restClient: BinanceRestClient;
    let ref: number;

    beforeAll(async () => {
      if (!ED25519_CREDENTIAL_PRESENT) {
        throw new Error(MISSING_ED25519_CREDENTIAL_MESSAGE);
      }
      if (!hmacApiKey || !hmacApiSecret) {
        throw new Error(
          'BINANCE_TESTNET_E2E=1 with an Ed25519 credential also requires ' +
            'BINANCE_API_TESTNET_KEY and BINANCE_API_TESTNET_SECRET to place the order that ' +
            'produces a real fill.',
        );
      }

      restClient = new BinanceRestClient({
        apiKey: hmacApiKey,
        apiSecret: hmacApiSecret,
        testnet: true,
      });

      if (restClient.getBaseUrl() !== TESTNET_REST_BASE_URL) {
        throw new Error(
          `Refusing to run: REST base URL '${restClient.getBaseUrl()}' is not TESTNET`,
        );
      }

      ref = await restClient.getTickerPrice(SYMBOL);
    });

    afterAll(async () => {
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
        finalOpenOrders.filter((order) => order.clientOrderId.startsWith(CLIENT_ORDER_PREFIX)),
      ).toHaveLength(0);
    });

    it(
      'logs on, subscribes, receives a real fill, relogons, reconnects and receives another fill',
      async () => {
        const signer = createEd25519Signer(ed25519PrivateKeyPem as string);
        const auth = { apiKey: ed25519ApiKey as string, signer };

        await client.time();
        await client.logon(auth);
        await client.subscribeUserDataStream();

        const firstClientOrderId = entryClientOrderId('s1');
        const firstFillWaiter = waitForEvent<ExecutionReportEvent>(
          client,
          'execution-report',
          EXECUTION_REPORT_TIMEOUT_MS,
          (report) => report.clientOrderId === firstClientOrderId,
        );
        await restClient.placeLimitOrder(SYMBOL, 'BUY', QUANTITY, ref * 1.05, {
          timeInForce: 'IOC',
          clientOrderId: firstClientOrderId,
        });
        const firstReport = await firstFillWaiter;
        expect(firstReport.orderStatus).toBe('FILLED');
        expect(firstReport.cumulativeFilledQuantity).toBeGreaterThan(0);

        await client.logon(auth);

        const reconnected = waitForEvent(client, 'connected', CONNECTED_EVENT_TIMEOUT_MS);
        forceCloseUnderlyingSocket(client);
        await reconnected;
        await client.time();
        await client.logon(auth);
        await client.subscribeUserDataStream();

        const secondClientOrderId = entryClientOrderId('s2');
        const secondFillWaiter = waitForEvent<ExecutionReportEvent>(
          client,
          'execution-report',
          EXECUTION_REPORT_TIMEOUT_MS,
          (report) => report.clientOrderId === secondClientOrderId,
        );
        await restClient.placeLimitOrder(SYMBOL, 'BUY', QUANTITY, ref * 1.05, {
          timeInForce: 'IOC',
          clientOrderId: secondClientOrderId,
        });
        const secondReport = await secondFillWaiter;
        expect(secondReport.orderStatus).toBe('FILLED');
        expect(secondReport.cumulativeFilledQuantity).toBeGreaterThan(0);

        await client.unsubscribeUserDataStream();
        await client.logout();
      },
    );
  });
});
