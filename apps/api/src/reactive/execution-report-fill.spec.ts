import { BinanceRestClient } from '@crypto-trader/data-fetcher';
import type { ExecutionReportEvent } from '@crypto-trader/data-fetcher';
import type { EntryOrderExchangeStatus } from '@crypto-trader/shared';
import axios from 'axios';
import { toEntryFillStatus } from './execution-report-fill';

jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    request: jest.fn(),
    defaults: { baseURL: 'https://api.binance.com' },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      __mock: mockAxiosInstance,
    },
  };
});

function getMockTransport() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (axios as any).__mock;
}

function buildReport(overrides: Partial<ExecutionReportEvent>): ExecutionReportEvent {
  return {
    eventTimeMs: 1000,
    transactionTimeMs: 1000,
    symbol: 'ENTRYUSDT',
    clientOrderId: 'client-1',
    originalClientOrderId: null,
    side: 'BUY',
    orderType: 'LIMIT_MAKER',
    executionType: 'TRADE',
    orderStatus: 'FILLED',
    orderId: '1001',
    orderListId: null,
    orderQuantity: 0.5,
    lastExecutedQuantity: 0.5,
    cumulativeFilledQuantity: 0.5,
    lastExecutedPrice: 46300,
    cumulativeQuoteQuantity: 23150,
    tradeId: '1',
    ...overrides,
  };
}

async function restStatusForLooseEntry(
  client: BinanceRestClient,
  data: Record<string, unknown>,
  ref: { orderId: string },
): Promise<EntryOrderExchangeStatus> {
  getMockTransport().request.mockResolvedValueOnce({ data });
  return client.getEntryOrderStatus('ENTRYUSDT', {
    orderListId: null,
    orderId: ref.orderId,
  });
}

async function restStatusForOcoLeg(
  client: BinanceRestClient,
  data: Record<string, unknown>,
  ref: {
    orderListId: string;
    limitLegOrderId: string;
    stopLegOrderId: string;
    leg: 'LIMIT' | 'STOP';
  },
): Promise<EntryOrderExchangeStatus> {
  getMockTransport().request.mockResolvedValueOnce({ data });
  return client.getEntryOrderStatus(
    'ENTRYOCOUSDT',
    {
      orderListId: ref.orderListId,
      orderId: null,
      limitLegOrderId: ref.limitLegOrderId,
      stopLegOrderId: ref.stopLegOrderId,
    },
    { leg: ref.leg },
  );
}

describe('toEntryFillStatus', () => {
  let client: BinanceRestClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new BinanceRestClient({ apiKey: 'test-key', apiSecret: 'test-secret' });
  });

  describe('parity with the REST detector for the same fill', () => {
    it('matches BinanceRestClient.getEntryOrderStatus for a LIMIT_MAKER loose entry fill', async () => {
      const restStatus = await restStatusForLooseEntry(
        client,
        {
          orderId: 1001,
          symbol: 'ENTRYUSDT',
          status: 'FILLED',
          type: 'LIMIT_MAKER',
          origQty: '0.5',
          executedQty: '0.5',
          cummulativeQuoteQty: '23150',
        },
        { orderId: '1001' },
      );

      const report = buildReport({
        symbol: 'ENTRYUSDT',
        orderType: 'LIMIT_MAKER',
        orderId: '1001',
        orderListId: null,
        orderQuantity: 0.5,
        cumulativeFilledQuantity: 0.5,
        cumulativeQuoteQuantity: 23150,
        lastExecutedPrice: 45000,
      });

      expect(toEntryFillStatus(report)).toEqual(restStatus);
    });

    it('matches BinanceRestClient.getEntryOrderStatus for an OCO STOP_LOSS_LIMIT leg fill', async () => {
      const restStatus = await restStatusForOcoLeg(
        client,
        {
          orderId: 2002,
          symbol: 'ENTRYOCOUSDT',
          status: 'FILLED',
          type: 'STOP_LOSS_LIMIT',
          origQty: '0.3',
          executedQty: '0.3',
          cummulativeQuoteQty: '9000',
        },
        {
          orderListId: '2000',
          limitLegOrderId: '2001',
          stopLegOrderId: '2002',
          leg: 'STOP',
        },
      );

      const report = buildReport({
        symbol: 'ENTRYOCOUSDT',
        orderType: 'STOP_LOSS_LIMIT',
        orderId: '2002',
        orderListId: '2000',
        orderQuantity: 0.3,
        cumulativeFilledQuantity: 0.3,
        cumulativeQuoteQuantity: 9000,
        lastExecutedPrice: 29500,
      });

      expect(toEntryFillStatus(report)).toEqual(restStatus);
    });
  });

  it('uses the weighted average quoteQty/executedQty, not lastExecutedPrice', () => {
    const report = buildReport({
      cumulativeFilledQuantity: 2,
      cumulativeQuoteQuantity: 59000,
      lastExecutedPrice: 31000,
    });

    const status = toEntryFillStatus(report);

    expect(status?.executedPrice).toBe(29500);
    expect(status?.executedPrice).not.toBe(report.lastExecutedPrice);
  });

  it('returns executedPrice null when cumulativeQuoteQuantity is 0', () => {
    const report = buildReport({
      cumulativeQuoteQuantity: 0,
    });

    const status = toEntryFillStatus(report);

    expect(status?.state).toBe('FILLED');
    expect(status?.executedPrice).toBeNull();
  });

  it('returns null for a SELL side report', () => {
    const report = buildReport({ side: 'SELL' });

    expect(toEntryFillStatus(report)).toBeNull();
  });

  it('returns null for a PARTIALLY_FILLED report', () => {
    const report = buildReport({
      orderStatus: 'PARTIALLY_FILLED',
      cumulativeFilledQuantity: 0.2,
    });

    expect(toEntryFillStatus(report)).toBeNull();
  });

  it('returns null for an EXPIRED report (OCO leg cancelled by the other filling)', () => {
    const report = buildReport({ orderStatus: 'EXPIRED' });

    expect(toEntryFillStatus(report)).toBeNull();
  });

  it('returns null for a CANCELED report', () => {
    const report = buildReport({ orderStatus: 'CANCELED' });

    expect(toEntryFillStatus(report)).toBeNull();
  });

  it('returns null for a FILLED report with cumulativeFilledQuantity 0', () => {
    const report = buildReport({ cumulativeFilledQuantity: 0 });

    expect(toEntryFillStatus(report)).toBeNull();
  });
});
