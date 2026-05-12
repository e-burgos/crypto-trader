import { Injectable } from '@nestjs/common';
import { AgentToolName } from '../../../generated/prisma/enums';
import { AgentTool, AgentToolInput, AgentToolOutput } from './agent-tool.interface';

const SLIPPAGE_PCT: Record<string, number> = {
  BTC: 0.0005,
  ETH: 0.001,
  default: 0.0015,
};

@Injectable()
export class TradeSimulationTool implements AgentTool {
  readonly name = AgentToolName.TRADE_SIMULATION;

  async execute(input: AgentToolInput): Promise<AgentToolOutput> {
    const price = Number(input.price) || 0;
    const quantity = Number(input.quantity) || 0;
    const side = String(input.side ?? 'BUY').toUpperCase();
    const feePct = Number(input.feePct) || 0.001; // default 0.1%
    const stopLossPct = Number(input.stopLossPct) || 0;
    const takeProfitPct = Number(input.takeProfitPct) || 0;

    const asset = (input.pair ?? input.asset ?? 'default')
      .replace(/USDT$|USD$|\/.*$/, '')
      .toUpperCase();
    const slippagePct = SLIPPAGE_PCT[asset] ?? SLIPPAGE_PCT.default;

    const notional = price * quantity;
    const feesUsd = notional * feePct;
    const slippageUsd = notional * slippagePct;

    // Expected P&L based on take-profit assumption
    const expectedGrossPnlUsd =
      takeProfitPct > 0
        ? notional * takeProfitPct * (side === 'BUY' ? 1 : -1)
        : 0;

    const expectedPnlUsd = expectedGrossPnlUsd - feesUsd - slippageUsd;

    // Downside based on stop-loss
    const downsideUsd =
      stopLossPct > 0 ? notional * stopLossPct + feesUsd + slippageUsd : feesUsd + slippageUsd;

    const expectedNetValueUsd = notional + expectedPnlUsd;

    const data = {
      expectedPnlUsd: round(expectedPnlUsd),
      feesUsd: round(feesUsd),
      slippageUsd: round(slippageUsd),
      expectedNetValueUsd: round(expectedNetValueUsd),
      downsideUsd: round(downsideUsd),
      slippagePct,
      notional: round(notional),
      side,
    };

    const tokenEstimate = Math.ceil(JSON.stringify(data).length / 4);

    return { data, tokenEstimate, freshnessMs: 0 };
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
