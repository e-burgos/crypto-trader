export { BinanceRestClient } from './binance-rest.client';
export type { BinanceRestConfig } from './binance-rest.client';
export {
  OrderValidationError,
  RETRYABLE_BINANCE_ERROR_CODES,
  getBinanceErrorCode,
  isRetryableBinanceErrorCode,
} from './binance-rest.client';
export type {
  SymbolFilters,
  TrailingDeltaFilter,
  OrderValidationCode,
  OcoOrderResult,
} from './binance-rest.client';

export { BinanceWsClient } from './binance-ws.client';
export type { BinanceWsConfig, TickerUpdate, KlineUpdate } from './binance-ws.client';

export { BinanceRateLimiter } from './binance-rate-limiter';

export {
  BinanceWsApiClient,
  BinanceWsApiError,
  BINANCE_WS_API_URL,
  BINANCE_WS_API_TESTNET_URL,
} from './binance-ws-api.client';
export type {
  BinanceWsApiConfig,
  WsApiConnectedEvent,
  WsApiDisconnectedEvent,
  WsApiReconnectingEvent,
  WsApiHeartbeatEvent,
  WsApiSessionLostEvent,
  WsApiSessionLostReason,
} from './binance-ws-api.client';

export {
  createEd25519Signer,
  buildSignaturePayload,
  redactWsApiRequest,
} from './ed25519-signer';
export type { Ed25519Signer } from './ed25519-signer';

export { parseExecutionReport, extractUserDataEvent } from './execution-report';
export type {
  ExecutionReportEvent,
  RawUserDataStreamMessage,
} from './execution-report';
