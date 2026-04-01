import {
  OrderResult,
  Balance,
  TradeRecord,
  TradeType,
  TradingMode,
} from '@crypto-trader/shared';
import { TRADE_FEE_PCT } from '@crypto-trader/shared';

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
}

/**
 * Sandbox executor for paper trading.
 */
export class SandboxOrderExecutor implements OrderExecutorPort {
  private balances: Map<string, Balance>;

  constructor(initialBalance = 10_000) {
    this.balances = new Map();
    this.balances.set('USDT', { asset: 'USDT', free: initialBalance, locked: 0 });
    this.balances.set('USDC', { asset: 'USDC', free: initialBalance, locked: 0 });
  }

  private currentPrices: Map<string, number> = new Map();

  setPrice(symbol: string, price: number): void {
    this.currentPrices.set(symbol, price);
  }

  async getPrice(symbol: string): Promise<number> {
    const price = this.currentPrices.get(symbol);
    if (!price) throw new Error(`No sandbox price set for ${symbol}`);
    return price;
  }

  async getBalance(asset: string): Promise<Balance> {
    return this.balances.get(asset) ?? { asset, free: 0, locked: 0 };
  }

  async placeMarketOrder(
    symbol: string,
    side: TradeType,
    quantity: number,
  ): Promise<OrderResult> {
    const price = await this.getPrice(symbol);
    const cost = price * quantity;
    const fee = cost * TRADE_FEE_PCT;

    // Extract base and quote from symbol (e.g., BTCUSDT → BTC, USDT)
    const { base, quote } = this.parseSymbol(symbol);

    if (side === TradeType.BUY) {
      const quoteBalance = await this.getBalance(quote);
      if (quoteBalance.free < cost + fee) {
        throw new Error(`Insufficient ${quote} balance: need ${cost + fee}, have ${quoteBalance.free}`);
      }
      quoteBalance.free -= cost + fee;
      this.balances.set(quote, quoteBalance);

      const baseBalance = await this.getBalance(base);
      baseBalance.free += quantity;
      this.balances.set(base, baseBalance);
    } else {
      const baseBalance = await this.getBalance(base);
      if (baseBalance.free < quantity) {
        throw new Error(`Insufficient ${base} balance: need ${quantity}, have ${baseBalance.free}`);
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
      placeMarketOrder(symbol: string, side: TradeType, quantity: number): Promise<OrderResult>;
      getBalances(): Promise<Balance[]>;
      getTickerPrice(symbol: string): Promise<number>;
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
    return balances.find((b) => b.asset === asset) ?? { asset, free: 0, locked: 0 };
  }

  async getPrice(symbol: string): Promise<number> {
    return this.binance.getTickerPrice(symbol);
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
