export interface ExecutionReportEvent {
  eventTimeMs: number;
  transactionTimeMs: number;
  symbol: string;
  clientOrderId: string;
  originalClientOrderId: string | null;
  side: 'BUY' | 'SELL';
  orderType: string;
  executionType: string;
  orderStatus: string;
  orderId: string;
  orderListId: string | null;
  orderQuantity: number;
  lastExecutedQuantity: number;
  cumulativeFilledQuantity: number;
  lastExecutedPrice: number;
  cumulativeQuoteQuantity: number;
  tradeId: string | null;
}

export interface RawUserDataStreamMessage {
  e?: string;
  E?: number;
  T?: number;
  s?: string;
  c?: string;
  C?: string;
  S?: string;
  o?: string;
  x?: string;
  X?: string;
  i?: number;
  g?: number;
  q?: string;
  l?: string;
  z?: string;
  L?: string;
  Z?: string;
  t?: number;
}

export function parseExecutionReport(raw: RawUserDataStreamMessage): ExecutionReportEvent {
  return {
    eventTimeMs: raw.E ?? 0,
    transactionTimeMs: raw.T ?? 0,
    symbol: raw.s ?? '',
    clientOrderId: raw.c ?? '',
    originalClientOrderId: raw.C && raw.C !== '' ? raw.C : null,
    side: raw.S === 'SELL' ? 'SELL' : 'BUY',
    orderType: raw.o ?? '',
    executionType: raw.x ?? '',
    orderStatus: raw.X ?? '',
    orderId: String(raw.i ?? ''),
    orderListId: raw.g !== undefined && raw.g !== -1 ? String(raw.g) : null,
    orderQuantity: parseFloat(raw.q ?? '0'),
    lastExecutedQuantity: parseFloat(raw.l ?? '0'),
    cumulativeFilledQuantity: parseFloat(raw.z ?? '0'),
    lastExecutedPrice: parseFloat(raw.L ?? '0'),
    cumulativeQuoteQuantity: parseFloat(raw.Z ?? '0'),
    tradeId: raw.t !== undefined && raw.t !== -1 ? String(raw.t) : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractUserDataEvent(frame: unknown): RawUserDataStreamMessage | null {
  if (!isRecord(frame)) return null;

  const candidate = isRecord(frame['event']) ? frame['event'] : frame;

  return typeof candidate['e'] === 'string' ? (candidate as RawUserDataStreamMessage) : null;
}
