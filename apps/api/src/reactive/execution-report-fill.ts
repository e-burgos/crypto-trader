import type { ExecutionReportEvent } from '@crypto-trader/data-fetcher';
import type { EntryOrderExchangeStatus, EntryOrderLeg } from '@crypto-trader/shared';

function legForOrderType(orderType: string): EntryOrderLeg | null {
  if (orderType === 'STOP_LOSS_LIMIT') return 'STOP';
  if (orderType === 'LIMIT_MAKER') return 'LIMIT';
  return null;
}

export function toEntryFillStatus(
  report: ExecutionReportEvent,
): EntryOrderExchangeStatus | null {
  if (
    report.side !== 'BUY' ||
    report.orderStatus !== 'FILLED' ||
    report.cumulativeFilledQuantity <= 0
  ) {
    return null;
  }

  return {
    state: 'FILLED',
    filledLeg: legForOrderType(report.orderType),
    executedPrice:
      report.cumulativeQuoteQuantity > 0
        ? report.cumulativeQuoteQuantity / report.cumulativeFilledQuantity
        : null,
    executedQuantity: report.cumulativeFilledQuantity,
    remainingQuantity: report.orderQuantity - report.cumulativeFilledQuantity,
    partial: false,
    orderId: report.orderId,
  };
}
