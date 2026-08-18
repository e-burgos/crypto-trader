export {
  SandboxOrderExecutor,
  LiveOrderExecutor,
  calculateTradeQuantity,
  createTradeRecord,
} from './order-executor';
export type {
  OrderExecutorPort,
  ProtectionOrderRequest,
  ProtectionOrderRef,
  ProtectionOrderResult,
  OpenOrderSummary,
} from './order-executor';

export {
  PositionManager,
  updateTrailingStop,
  shouldExitByTime,
  resolvePartialTakeProfit,
  applyPartialExit,
  resolveProtectionRearm,
  PROTECTION_REARM_MIN_STOP_DELTA_PCT,
} from './position-manager';
export type {
  OpenPositionParams,
  ClosePositionResult,
  TrailingConfig,
  TrailingState,
  PartialTakeProfitConfig,
  ResolvePartialTakeProfitInput,
  PartialTakeProfitResult,
  ApplyPartialExitResult,
  ProtectionRearmInput,
  ProtectionRearmDecision,
} from './position-manager';

export { simulateTrade, SLIPPAGE_PCT_BY_ASSET } from './risk/trade-simulation';
export type {
  TradeSide,
  TradeSimulationInput,
  TradeSimulationResult,
} from './risk/trade-simulation';

export { resolveTradeQuantity } from './sizing';
export type {
  AegisVerdictValue,
  TradeSizingInput,
  TradeSizingResult,
} from './sizing';

export { evaluateSellPolicy } from './sell-policy';
export type {
  SellPath,
  SellPolicyConfig,
  SellPolicyInput,
  SellPolicyDecision,
} from './sell-policy';
