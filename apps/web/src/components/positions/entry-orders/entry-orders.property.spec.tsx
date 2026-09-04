import '@testing-library/jest-dom/vitest';
import { render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import '../../../lib/i18n';
import {
  ENTRY_ORDER_CANCEL_REASONS,
  ENTRY_ORDER_STATUSES,
  type EntryOrderCancelReasonWire,
  type EntryOrderStatusWire,
  type EntryOrderWire,
} from '@crypto-trader/shared';
import { EntryOrdersTable } from './entry-orders-table';
import { TRADING_CONFIGS_FOR_ENTRIES, makeFixtureEntry } from './fixtures';

const STATUS_LABEL: Record<EntryOrderStatusWire | 'UNKNOWN_STATUS', string> = {
  RESTING: 'Resting',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
  MISSING: 'Missing',
  UNKNOWN_STATUS: 'Unknown',
};

const CANCEL_REASON_LABEL: Record<EntryOrderCancelReasonWire | 'UNKNOWN_REASON', string> = {
  TTL_EXPIRED: 'It expired before it could fill',
  LATER_DECISION: 'The bot dropped it after a later decision',
  DAILY_LOSS_DISCARDED: 'Discarded by the daily loss limit',
  BOT_STOPPED: 'The bot was stopped',
  REPLACED_BY_NEW_ENTRY: 'Replaced by a newer entry',
  PARTIAL_FILL_REMAINDER: 'The unfilled remainder was cancelled',
  ORPHAN_SWEEP: 'Cleaned up: no bot cycle was behind it',
  VANISHED_ON_EXCHANGE: 'Vanished from the exchange without confirmation',
  UNKNOWN_REASON: 'Unknown reason',
};

const FILL_LEG_TEXT: Record<'LIMIT' | 'STOP', string> = {
  LIMIT: 'Filled on the support leg',
  STOP: 'Filled on the breakout leg',
};

const PRIMARY_OUTCOME_PHRASE: Record<EntryOrderStatusWire | 'UNKNOWN_STATUS', string | null> = {
  RESTING: 'Expires on',
  FILLED: null,
  CANCELLED: 'Cancelled on',
  EXPIRED: 'Expired on',
  MISSING: 'The backend cannot confirm it on the exchange',
  UNKNOWN_STATUS: null,
};

const ALL_PRIMARY_OUTCOME_PHRASES = Object.values(PRIMARY_OUTCOME_PHRASE).filter(
  (phrase): phrase is string => phrase !== null,
);

interface StatusCase {
  key: EntryOrderStatusWire | 'UNKNOWN_STATUS';
  value: string;
}

const STATUS_CASES: StatusCase[] = [
  ...ENTRY_ORDER_STATUSES.map((status): StatusCase => ({ key: status, value: status })),
  { key: 'UNKNOWN_STATUS', value: 'PENDING_REVIEW' },
];

interface EntryModeVariant {
  key: 'LIMIT_MAKER' | 'OCO_TRAILING' | 'OCO_FIXED' | 'UNKNOWN_MODE';
  entryMode: EntryOrderWire['entryMode'];
  limitPrice: number;
  stopPrice: number | null;
  stopLimitPrice: number | null;
  trailingDeltaBips: number | null;
  levelIncludes: string[];
  levelExcludes: string[];
}

const ENTRY_MODE_VARIANTS: EntryModeVariant[] = [
  {
    key: 'LIMIT_MAKER',
    entryMode: 'LIMIT_MAKER',
    limitPrice: 61000,
    stopPrice: 61500,
    stopLimitPrice: 61600,
    trailingDeltaBips: 55,
    levelIncludes: ['$61,000.00'],
    levelExcludes: ['→', 'trails the price', '$61,500.00', '$61,600.00'],
  },
  {
    key: 'OCO_TRAILING',
    entryMode: 'OCO',
    limitPrice: 62000,
    stopPrice: 63000,
    stopLimitPrice: 63100,
    trailingDeltaBips: 90,
    levelIncludes: ['$62,000.00', 'trails the price (90 bips)'],
    levelExcludes: ['→'],
  },
  {
    key: 'OCO_FIXED',
    entryMode: 'OCO',
    limitPrice: 62500,
    stopPrice: 63500,
    stopLimitPrice: 63600,
    trailingDeltaBips: null,
    levelIncludes: ['$62,500.00', 'Breakout $63,500.00 → $63,600.00'],
    levelExcludes: ['trails the price'],
  },
  {
    key: 'UNKNOWN_MODE',
    entryMode: 'MARKET',
    limitPrice: 61200,
    stopPrice: 61800,
    stopLimitPrice: 61900,
    trailingDeltaBips: 30,
    levelIncludes: ['$61,200.00'],
    levelExcludes: ['→', 'trails the price', '$61,800.00', '$61,900.00'],
  },
];

interface ThirdAxisCase {
  key: EntryOrderCancelReasonWire | 'UNKNOWN_REASON' | 'NONE' | 'LIMIT' | 'STOP';
  cancelReason: string | null;
  filledLeg: 'LIMIT' | 'STOP' | null;
}

const CANCEL_REASON_THIRD_AXIS: ThirdAxisCase[] = [
  ...ENTRY_ORDER_CANCEL_REASONS.map(
    (reason): ThirdAxisCase => ({ key: reason, cancelReason: reason, filledLeg: null }),
  ),
  { key: 'NONE', cancelReason: null, filledLeg: null },
  { key: 'UNKNOWN_REASON', cancelReason: 'SOMETHING_ELSE', filledLeg: null },
];

const FILLED_LEG_THIRD_AXIS: ThirdAxisCase[] = [
  { key: 'LIMIT', cancelReason: null, filledLeg: 'LIMIT' },
  { key: 'STOP', cancelReason: null, filledLeg: 'STOP' },
];

const NO_THIRD_AXIS: ThirdAxisCase[] = [{ key: 'NONE', cancelReason: null, filledLeg: null }];

function thirdAxisFor(statusKey: StatusCase['key']): ThirdAxisCase[] {
  if (statusKey === 'CANCELLED') return CANCEL_REASON_THIRD_AXIS;
  if (statusKey === 'FILLED') return FILLED_LEG_THIRD_AXIS;
  return NO_THIRD_AXIS;
}

interface PropertyCase {
  id: string;
  entry: EntryOrderWire;
  statusLabel: string;
  levelIncludes: string[];
  levelExcludes: string[];
  outcomeIncludes: string[];
  outcomeExcludes: string[];
}

function buildCases(): PropertyCase[] {
  const cases: PropertyCase[] = [];

  for (const statusCase of STATUS_CASES) {
    const primary = PRIMARY_OUTCOME_PHRASE[statusCase.key];
    const isFilledStatus = statusCase.key === 'FILLED';
    const isCancelledStatus = statusCase.key === 'CANCELLED';

    for (const modeVariant of ENTRY_MODE_VARIANTS) {
      for (const third of thirdAxisFor(statusCase.key)) {
        const id = `${statusCase.key}__${modeVariant.key}__${third.key}`;

        const entry = makeFixtureEntry({
          id,
          configId: 'cfg_btc',
          status: statusCase.value as EntryOrderStatusWire,
          entryMode: modeVariant.entryMode,
          limitPrice: modeVariant.limitPrice,
          stopPrice: modeVariant.stopPrice,
          stopLimitPrice: modeVariant.stopLimitPrice,
          trailingDeltaBips: modeVariant.trailingDeltaBips,
          cancelReason: third.cancelReason as EntryOrderCancelReasonWire | null,
          filledLeg: isFilledStatus ? third.filledLeg : null,
          executedPrice: isFilledStatus ? 12345.67 : null,
          executedQuantity: isFilledStatus ? 0.25 : null,
          positionId: isFilledStatus ? 'pos_property' : null,
          settledAt:
            isCancelledStatus || statusCase.key === 'EXPIRED' ? '2026-09-08T00:00:00.000Z' : null,
          expiresAt: '2026-09-09T00:00:00.000Z',
        });

        const outcomeIncludes: string[] = primary !== null ? [primary] : [];
        const outcomeExcludes: string[] = ALL_PRIMARY_OUTCOME_PHRASES.filter(
          (phrase) => phrase !== primary,
        );

        if (isFilledStatus && third.filledLeg) {
          const otherLeg = third.filledLeg === 'LIMIT' ? 'STOP' : 'LIMIT';
          outcomeIncludes.push(FILL_LEG_TEXT[third.filledLeg], '12,345.67');
          outcomeExcludes.push(FILL_LEG_TEXT[otherLeg]);
        }

        if (isCancelledStatus && third.key !== 'NONE') {
          const reasonKey = third.key as EntryOrderCancelReasonWire | 'UNKNOWN_REASON';
          outcomeIncludes.push(CANCEL_REASON_LABEL[reasonKey]);
          for (const [key, label] of Object.entries(CANCEL_REASON_LABEL)) {
            if (key !== reasonKey) outcomeExcludes.push(label);
          }
        } else {
          outcomeExcludes.push(...Object.values(CANCEL_REASON_LABEL));
        }

        cases.push({
          id,
          entry,
          statusLabel: STATUS_LABEL[statusCase.key],
          levelIncludes: modeVariant.levelIncludes,
          levelExcludes: modeVariant.levelExcludes,
          outcomeIncludes,
          outcomeExcludes,
        });
      }
    }
  }

  return cases;
}

const CASES = buildCases();

const EXPECTED_CASE_COUNT = STATUS_CASES.reduce(
  (total, statusCase) => total + ENTRY_MODE_VARIANTS.length * thirdAxisFor(statusCase.key).length,
  0,
);

function renderSingleRow(entry: EntryOrderWire) {
  const { container } = render(
    <MemoryRouter>
      <EntryOrdersTable entries={[entry]} configs={TRADING_CONFIGS_FOR_ENTRIES} />
    </MemoryRouter>,
  );
  const row = container.querySelector('tbody tr');
  if (!row) throw new Error(`no row rendered for entry ${entry.id}`);
  return row as HTMLElement;
}

const STATUS_COLUMN_INDEX = 5;

function statusCell(row: HTMLElement): HTMLElement {
  const cell = row.querySelectorAll('td')[STATUS_COLUMN_INDEX];
  if (!cell) throw new Error('no status cell rendered');
  return cell as HTMLElement;
}

describe('EntryOrdersTable — property sweep over status x entryMode x cancelReason/filledLeg (CA-005)', () => {
  it('builds the case matrix from the wire arrays, not from hand-written pairs', () => {
    expect(CASES.length).toBe(EXPECTED_CASE_COUNT);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
  });

  it(`renders all ${CASES.length} generated rows together without throwing`, () => {
    const { container } = render(
      <MemoryRouter>
        <EntryOrdersTable entries={CASES.map((c) => c.entry)} configs={TRADING_CONFIGS_FOR_ENTRIES} />
      </MemoryRouter>,
    );

    expect(container.querySelectorAll('tbody tr')).toHaveLength(CASES.length);
    expect(container.textContent).not.toMatch(/positions\.entries\./);
  });

  it.each(CASES)(
    'renders $id with its status badge, level cell and outcome text',
    ({ entry, statusLabel, levelIncludes, levelExcludes, outcomeIncludes, outcomeExcludes }) => {
      const row = renderSingleRow(entry);

      expect(within(statusCell(row)).getByText(statusLabel)).toBeInTheDocument();

      for (const text of levelIncludes) expect(row.textContent).toContain(text);
      for (const text of levelExcludes) expect(row.textContent).not.toContain(text);
      for (const text of outcomeIncludes) expect(row.textContent).toContain(text);
      for (const text of outcomeExcludes) expect(row.textContent).not.toContain(text);

      expect(row.textContent).not.toMatch(/positions\.entries\./);
    },
  );
});
