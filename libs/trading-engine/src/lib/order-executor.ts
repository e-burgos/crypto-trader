import {
  OrderResult,
  Balance,
  TradeRecord,
  TradeType,
  TradingMode,
  ExchangeOrderStatus,
} from '@crypto-trader/shared';
import { TRADE_FEE_PCT } from '@crypto-trader/shared';

export interface ProtectionOrderRequest {
  symbol: string;
  quantity: number;
  stopPrice: number;
  stopLimitPrice: number;
  takeProfitPrice: number;
  referencePrice: number;
  clientOrderId?: string;
}

export interface ProtectionOrderRef {
  orderListId?: string | null;
  stopOrderId?: string | null;
}

export interface ProtectionOrderResult {
  kind: 'OCO' | 'SIMULATED';
  orderListId: string | null;
  stopOrderId: string | null;
  limitOrderId: string | null;
  placedAt: Date;
}

/**
 * Abstract order executor — real Binance or sandbox.
 */
export interface OrderExecutorPort {
  placeMarketOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
  ): Promise<OrderResult>;
  getBalance(asset: string): Promise<Balance>;
  getPrice(symbol: string): Promise<number>;
  placeLimitOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
    price: number,
  ): Promise<OrderResult>;
  placeStopLossLimitOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
    stopPrice: number,
    limitPrice: number,
  ): Promise<OrderResult>;
  placeProtectionOrder(
    req: ProtectionOrderRequest,
  ): Promise<ProtectionOrderResult>;
  getProtectionOrderStatus(
    symbol: string,
    ref: ProtectionOrderRef,
  ): Promise<ExchangeOrderStatus>;
  cancelProtectionOrder(symbol: string, ref: ProtectionOrderRef): Promise<void>;
}

interface SandboxProtection {
  symbol: string;
  quantity: number;
  stopPrice: number;
  takeProfitPrice: number;
}

/**
 * Sandbox executor for paper trading.
 */
export class SandboxOrderExecutor implements OrderExecutorPort {
  private balances: Map<string, Balance>;
  private readonly protections = new Map<string, SandboxProtection>();
  private protectionCounter = 0;

  constructor(initialBalance = 10_000) {
    this.balances = new Map();
    this.balances.set('USDT', {
      asset: 'USDT',
      free: initialBalance,
      locked: 0,
    });
    this.balances.set('USDC', {
      asset: 'USDC',
      free: initialBalance,
      locked: 0,
    });
  }

  private currentPrices: Map<string, number> = new Map();

  setPrice(symbol: string, price: number): void {
    this.currentPrices.set(symbol, price);
  }

  /** Seed a balance for paper-trading (e.g. base asset before a SELL). */
  setBalance(asset: string, free: number): void {
    this.balances.set(asset, { asset, free, locked: 0 });
  }

  async getPrice(symbol: string): Promise<number> {
    const price = this.currentPrices.get(symbol);
    if (!price) throw new Error(`No sandbox price set for ${symbol}`);
    return price;
  }

  async getBalance(asset: string): Promise<Balance> {
    return this.balances.get(asset) ?? { asset, free: 0, locked: 0 };
  }

  private async fillAtPrice(
    symbol: string,
    side: TradeType,
    quantity: number,
    price: number,
  ): Promise<OrderResult> {
    const cost = price * quantity;
    const fee = cost * TRADE_FEE_PCT;

    // Extract base and quote from symbol (e.g., BTCUSDT → BTC, USDT)
    const { base, quote } = this.parseSymbol(symbol);

    if (side === TradeType.BUY) {
      const quoteBalance = await this.getBalance(quote);
      if (quoteBalance.free < cost + fee) {
        throw new Error(
          `Insufficient ${quote} balance: need ${cost + fee}, have ${quoteBalance.free}`,
        );
      }
      quoteBalance.free -= cost + fee;
      this.balances.set(quote, quoteBalance);

      const baseBalance = await this.getBalance(base);
      baseBalance.free += quantity;
      this.balances.set(base, baseBalance);
    } else {
      const baseBalance = await this.getBalance(base);
      if (baseBalance.free < quantity) {
        throw new Error(
          `Insufficient ${base} balance: need ${quantity}, have ${baseBalance.free}`,
        );
      }
      baseBalance.free -= quantity;
      this.balances.set(base, baseBalance);

      const quoteBalance = await this.getBalance(quote);
      quoteBalance.free += cost - fee;
      this.balances.set(quote, quoteBalance);
    }

    return {
      orderId: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      symbol,
      side,
      price,
      quantity,
      status: 'FILLED',
      executedAt: new Date(),
    };
  }

  async placeMarketOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
  ): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    return this.fillAtPrice(symbol, side, quantity, price);
  }

  async placeLimitOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
    price: number,
  ): Promise<OrderResult> {
    return this.fillAtPrice(symbol, side, quantity, price);
  }

  async placeStopLossLimitOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
    _stopPrice: number,
    limitPrice: number,
  ): Promise<OrderResult> {
    return this.fillAtPrice(symbol, side, quantity, limitPrice);
  }

  async placeProtectionOrder(
    req: ProtectionOrderRequest,
  ): Promise<ProtectionOrderResult> {
    const id = `sandbox-oco-${++this.protectionCounter}`;
    this.protections.set(id, {
      symbol: req.symbol,
      quantity: req.quantity,
      stopPrice: req.stopPrice,
      takeProfitPrice: req.takeProfitPrice,
    });

    const { base } = this.parseSymbol(req.symbol);
    const baseBalance = await this.getBalance(base);
    this.balances.set(base, {
      asset: base,
      free: baseBalance.free - req.quantity,
      locked: baseBalance.locked + req.quantity,
    });

    return {
      kind: 'SIMULATED',
      orderListId: id,
      stopOrderId: null,
      limitOrderId: null,
      placedAt: new Date(),
    };
  }

  async getProtectionOrderStatus(
    symbol: string,
    ref: ProtectionOrderRef,
  ): Promise<ExchangeOrderStatus> {
    const entry = ref.orderListId
      ? this.protections.get(ref.orderListId)
      : undefined;
    if (!entry) {
      return {
        state: 'MISSING',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      };
    }

    const price = this.currentPrices.get(symbol);
    if (price !== undefined) {
      if (price <= entry.stopPrice) {
        return {
          state: 'FILLED',
          filledLeg: 'STOP',
          executedPrice: price,
          executedQuantity: entry.quantity,
          orderId: ref.orderListId ?? null,
        };
      }
      if (price >= entry.takeProfitPrice) {
        return {
          state: 'FILLED',
          filledLeg: 'TAKE_PROFIT',
          executedPrice: price,
          executedQuantity: entry.quantity,
          orderId: ref.orderListId ?? null,
        };
      }
    }

    return {
      state: 'ACTIVE',
      filledLeg: null,
      executedPrice: null,
      executedQuantity: null,
      orderId: ref.orderListId ?? null,
    };
  }

  async cancelProtectionOrder(
    symbol: string,
    ref: ProtectionOrderRef,
  ): Promise<void> {
    if (!ref.orderListId) return;
    const entry = this.protections.get(ref.orderListId);
    if (!entry) return;
    this.protections.delete(ref.orderListId);

    const { base } = this.parseSymbol(symbol);
    const baseBalance = await this.getBalance(base);
    this.balances.set(base, {
      asset: base,
      free: baseBalance.free + entry.quantity,
      locked: Math.max(0, baseBalance.locked - entry.quantity),
    });
  }

  private parseSymbol(symbol: string): { base: string; quote: string } {
    for (const quote of ['USDT', 'USDC']) {
      if (symbol.endsWith(quote)) {
        return { base: symbol.slice(0, -quote.length), quote };
      }
    }
    throw new Error(`Cannot parse symbol: ${symbol}`);
  }
}

/**
 * Order executor that delegates to a Binance REST client.
 */
export class LiveOrderExecutor implements OrderExecutorPort {
  constructor(
    private readonly binance: {
      placeMarketOrder(
        symbol: string,
        side: TradeType,
        quantity: number,
      ): Promise<OrderResult>;
      getBalances(): Promise<Balance[]>;
      getTickerPrice(symbol: string): Promise<number>;
      placeLimitOrder(
        symbol: string,
        side: TradeType,
        quantity: number,
        price: number,
      ): Promise<OrderResult>;
      placeStopLossLimitOrder(
        symbol: string,
        side: TradeType,
        quantity: number,
        stopPrice: number,
        limitPrice: number,
      ): Promise<OrderResult>;
      placeOcoSellOrder(
        symbol: string,
        params: {
          quantity: number;
          takeProfitPrice: number;
          stopPrice: number;
          stopLimitPrice: number;
          listClientOrderId?: string;
          referencePrice?: number;
        },
      ): Promise<{
        orderListId: string;
        stopOrderId: string;
        limitOrderId: string;
        placedAt: Date;
      }>;
      getOcoStatus(
        symbol: string,
        orderListId: string,
      ): Promise<ExchangeOrderStatus>;
      cancelOcoOrderList(symbol: string, orderListId: string): Promise<void>;
    },
  ) {}

  async placeMarketOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
  ): Promise<OrderResult> {
    return this.binance.placeMarketOrder(symbol, side, quantity);
  }

  async getBalance(asset: string): Promise<Balance> {
    const balances = await this.binance.getBalances();
    return (
      balances.find((b) => b.asset === asset) ?? { asset, free: 0, locked: 0 }
    );
  }

  async getPrice(symbol: string): Promise<number> {
    return this.binance.getTickerPrice(symbol);
  }

  async placeLimitOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
    price: number,
  ): Promise<OrderResult> {
    return this.binance.placeLimitOrder(symbol, side, quantity, price);
  }

  async placeStopLossLimitOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
    stopPrice: number,
    limitPrice: number,
  ): Promise<OrderResult> {
    return this.binance.placeStopLossLimitOrder(
      symbol,
      side,
      quantity,
      stopPrice,
      limitPrice,
    );
  }

  async placeProtectionOrder(
    req: ProtectionOrderRequest,
  ): Promise<ProtectionOrderResult> {
    const result = await this.binance.placeOcoSellOrder(req.symbol, {
      quantity: req.quantity,
      takeProfitPrice: req.takeProfitPrice,
      stopPrice: req.stopPrice,
      stopLimitPrice: req.stopLimitPrice,
      listClientOrderId: req.clientOrderId,
      referencePrice: req.referencePrice,
    });

    return {
      kind: 'OCO',
      orderListId: result.orderListId,
      stopOrderId: result.stopOrderId,
      limitOrderId: result.limitOrderId,
      placedAt: result.placedAt,
    };
  }

  async getProtectionOrderStatus(
    symbol: string,
    ref: ProtectionOrderRef,
  ): Promise<ExchangeOrderStatus> {
    if (!ref.orderListId) {
      return {
        state: 'MISSING',
        filledLeg: null,
        executedPrice: null,
        executedQuantity: null,
        orderId: null,
      };
    }
    return this.binance.getOcoStatus(symbol, ref.orderListId);
  }

  async cancelProtectionOrder(
    symbol: string,
    ref: ProtectionOrderRef,
  ): Promise<void> {
    if (!ref.orderListId) return;
    await this.binance.cancelOcoOrderList(symbol, ref.orderListId);
  }
}

/**
 * Calculate trade quantity based on config and balance.
 */
export function calculateTradeQuantity(
  balance: number,
  price: number,
  maxTradePct: number,
): number {
  const maxSpend = balance * maxTradePct;
  const quantity = maxSpend / price;
  // Round to 8 decimals (Binance standard)
  return Math.floor(quantity * 1e8) / 1e8;
}

/**
 * Create a trade record from an order result.
 */
export function createTradeRecord(
  order: OrderResult,
  userId: string,
  positionId: string,
  mode: TradingMode,
): Omit<TradeRecord, 'id'> {
  const fee = order.price * order.quantity * TRADE_FEE_PCT;
  return {
    userId,
    positionId,
    type: order.side as TradeType,
    price: order.price,
    quantity: order.quantity,
    fee,
    executedAt: order.executedAt,
    mode,
    binanceOrderId: order.orderId,
  };
}
