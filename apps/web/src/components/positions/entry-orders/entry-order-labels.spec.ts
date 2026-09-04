import { describe, expect, it } from 'vitest';
import {
  ENTRY_ORDER_CANCEL_REASONS,
  ENTRY_ORDER_STATUSES,
  type EntryOrderCancelReasonWire,
  type EntryOrderStatusWire,
} from '@crypto-trader/shared';
import {
  ENTRY_ORDER_CANCEL_REASON_LABEL_KEY,
  ENTRY_ORDER_STATUS_BADGE_VARIANT,
  entryOrderCancelReasonLabelKey,
  entryOrderModeBadgeClassName,
  entryOrderModeLabelKey,
  entryOrderStatusBadgeVariant,
  entryOrderStatusLabelKey,
  filledLegLabelKey,
  formatEntryOrderDateTime,
  formatEntryOrderNumber,
  formatEntryOrderUsd,
  hasKnownConfig,
  resolveBotLabel,
  resolveEntryOrderCancelReason,
  resolveEntryOrderMode,
  resolveEntryOrderStatus,
  resolveFilledLeg,
} from './entry-order-labels';
import { makeFixtureConfig } from './fixtures';

function sorted<T>(values: readonly T[]): T[] {
  return [...values].sort();
}

describe('entry-order-labels — exhaustiveness twins', () => {
  it('ENTRY_ORDER_STATUS_BADGE_VARIANT covers exactly ENTRY_ORDER_STATUSES', () => {
    expect(sorted(Object.keys(ENTRY_ORDER_STATUS_BADGE_VARIANT))).toEqual(
      sorted(ENTRY_ORDER_STATUSES as readonly string[]),
    );
  });

  it('ENTRY_ORDER_CANCEL_REASON_LABEL_KEY covers exactly ENTRY_ORDER_CANCEL_REASONS', () => {
    expect(sorted(Object.keys(ENTRY_ORDER_CANCEL_REASON_LABEL_KEY))).toEqual(
      sorted(ENTRY_ORDER_CANCEL_REASONS as readonly string[]),
    );
  });
});

describe('resolveEntryOrderStatus', () => {
  it.each(ENTRY_ORDER_STATUSES)('resolves the known status %s to itself', (status) => {
    expect(resolveEntryOrderStatus(status)).toBe(status);
  });

  it('degrades an unknown status to "unknown"', () => {
    expect(resolveEntryOrderStatus('PENDING_REVIEW')).toBe('unknown');
  });
});

describe('entryOrderStatusBadgeVariant / entryOrderStatusLabelKey', () => {
  it.each(ENTRY_ORDER_STATUSES)('gives %s its own badge variant and key', (status) => {
    const resolved = resolveEntryOrderStatus(status);
    expect(entryOrderStatusBadgeVariant(resolved)).toBe(ENTRY_ORDER_STATUS_BADGE_VARIANT[status]);
    expect(entryOrderStatusLabelKey(resolved)).toBe(`positions.entries.status.${status}`);
  });

  it('degrades unknown to the neutral variant and the unknown key', () => {
    const resolved = resolveEntryOrderStatus('PENDING_REVIEW');
    expect(entryOrderStatusBadgeVariant(resolved)).toBe('neutral');
    expect(entryOrderStatusLabelKey(resolved)).toBe('positions.entries.status.unknown');
  });
});

describe('resolveEntryOrderCancelReason', () => {
  it.each(ENTRY_ORDER_CANCEL_REASONS)('resolves the known reason %s to itself', (reason) => {
    expect(resolveEntryOrderCancelReason(reason)).toBe(reason);
  });

  it('resolves null to null (no legend to render)', () => {
    expect(resolveEntryOrderCancelReason(null)).toBeNull();
  });

  it('degrades an unknown reason to "unknown"', () => {
    expect(resolveEntryOrderCancelReason('SOMETHING_ELSE')).toBe('unknown');
  });
});

describe('entryOrderCancelReasonLabelKey', () => {
  it.each(ENTRY_ORDER_CANCEL_REASONS)('gives %s its own key', (reason) => {
    const resolved = resolveEntryOrderCancelReason(reason) as EntryOrderCancelReasonWire;
    expect(entryOrderCancelReasonLabelKey(resolved)).toBe(`positions.entries.cancelReason.${reason}`);
  });

  it('degrades unknown to the neutral generic key', () => {
    const resolved = resolveEntryOrderCancelReason('SOMETHING_ELSE');
    expect(entryOrderCancelReasonLabelKey(resolved as EntryOrderStatusWire | 'unknown')).toBe(
      'positions.entries.cancelReason.unknown',
    );
  });
});

describe('resolveEntryOrderMode / entryOrderModeLabelKey', () => {
  it('resolves LIMIT_MAKER and OCO to themselves', () => {
    expect(resolveEntryOrderMode('LIMIT_MAKER')).toBe('LIMIT_MAKER');
    expect(resolveEntryOrderMode('OCO')).toBe('OCO');
    expect(entryOrderModeLabelKey(resolveEntryOrderMode('LIMIT_MAKER'))).toBe(
      'positions.entries.entryMode.LIMIT_MAKER',
    );
    expect(entryOrderModeLabelKey(resolveEntryOrderMode('OCO'))).toBe(
      'positions.entries.entryMode.OCO',
    );
  });

  it('degrades MARKET to unknown (H5: MARKET should never reach a row)', () => {
    expect(resolveEntryOrderMode('MARKET')).toBe('unknown');
    expect(entryOrderModeLabelKey(resolveEntryOrderMode('MARKET'))).toBe(
      'positions.entries.entryMode.unknown',
    );
  });

  it('degrades any other value to unknown', () => {
    expect(resolveEntryOrderMode('SOMETHING_ELSE')).toBe('unknown');
  });
});

describe('resolveFilledLeg / filledLegLabelKey', () => {
  it('resolves LIMIT and STOP to themselves with their own key', () => {
    expect(resolveFilledLeg('LIMIT')).toBe('LIMIT');
    expect(filledLegLabelKey(resolveFilledLeg('LIMIT'))).toBe('positions.entries.fill.legLimit');
    expect(resolveFilledLeg('STOP')).toBe('STOP');
    expect(filledLegLabelKey(resolveFilledLeg('STOP'))).toBe('positions.entries.fill.legStop');
  });

  it('resolves null to null with no label key', () => {
    expect(resolveFilledLeg(null)).toBeNull();
    expect(filledLegLabelKey(resolveFilledLeg(null))).toBeNull();
  });

  it('degrades an unknown value to null with no label key', () => {
    expect(resolveFilledLeg('SOMETHING_ELSE')).toBeNull();
    expect(filledLegLabelKey(resolveFilledLeg('SOMETHING_ELSE'))).toBeNull();
  });
});

describe('resolveBotLabel / hasKnownConfig', () => {
  const configs = [
    makeFixtureConfig({ id: 'cfg_named', name: 'BTC Momentum', asset: 'BTC', pair: 'USDT' }),
    makeFixtureConfig({ id: 'cfg_unnamed', name: '', asset: 'ETH', pair: 'USDT' }),
  ];

  it('resolves the config name when it has one', () => {
    expect(resolveBotLabel('cfg_named', configs)).toBe('BTC Momentum');
    expect(hasKnownConfig('cfg_named', configs)).toBe(true);
  });

  it('falls back to asset/pair when the config has no name', () => {
    expect(resolveBotLabel('cfg_unnamed', configs)).toBe('ETH/USDT');
  });

  it('falls back to the raw configId when no config matches, and reports it as unknown', () => {
    expect(resolveBotLabel('cfg_ghost', configs)).toBe('cfg_ghost');
    expect(hasKnownConfig('cfg_ghost', configs)).toBe(false);
  });
});

describe('entryOrderModeBadgeClassName', () => {
  it('gives LIVE and TESTNET their own tone and everything else neutral', () => {
    expect(entryOrderModeBadgeClassName('LIVE')).toContain('red');
    expect(entryOrderModeBadgeClassName('TESTNET')).toContain('sky');
    expect(entryOrderModeBadgeClassName('SANDBOX')).toContain('muted');
  });
});

describe('formatting helpers', () => {
  it('formats a number with two decimals and no currency sign', () => {
    expect(formatEntryOrderNumber(61250.5)).toBe('61,250.50');
  });

  it('prefixes the formatted number with a dollar sign', () => {
    expect(formatEntryOrderUsd(61250.5)).toBe('$61,250.50');
  });

  it('formats an ISO date into a non-empty, non-raw string', () => {
    const formatted = formatEntryOrderDateTime('2026-09-03T12:00:00.000Z');
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).not.toBe('2026-09-03T12:00:00.000Z');
  });
});
