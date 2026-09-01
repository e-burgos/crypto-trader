import { vi } from 'vitest';
import {
  ActionCapsInput,
  BotActionKind,
  classifyActionExposure,
  evaluateActionCaps,
} from './action-caps';

function baseInput(overrides: Partial<ActionCapsInput> = {}): ActionCapsInput {
  return {
    now: 1_000_000,
    kind: 'BUY',
    executedActionsInLastHour: 0,
    lastExecutedActionAtMs: null,
    maxActionsPerHour: 6,
    minActionIntervalMs: 60_000,
    dailyLossReached: false,
    ...overrides,
  };
}

describe('classifyActionExposure', () => {
  it.each<[BotActionKind, string]>([
    ['BUY', 'INCREASING'],
    ['SELL_FULL', 'REDUCING'],
    ['SELL_PARTIAL', 'REDUCING'],
    ['PROTECTION_REARM', 'NEUTRAL'],
    ['ENTRY_CANCEL', 'REDUCING'],
  ])('classifies %s as %s', (kind, expected) => {
    expect(classifyActionExposure(kind)).toBe(expected);
  });
});

describe('evaluateActionCaps', () => {
  describe('REDUCING actions are never blocked (§3.1)', () => {
    it.each<BotActionKind>(['SELL_FULL', 'SELL_PARTIAL', 'ENTRY_CANCEL'])(
      'allows %s even with daily loss reached, min interval violated and hourly cap exhausted',
      (kind) => {
        const decision = evaluateActionCaps(
          baseInput({
            kind,
            dailyLossReached: true,
            lastExecutedActionAtMs: 999_999,
            executedActionsInLastHour: 999,
          }),
        );
        expect(decision).toEqual({ allowed: true, reason: 'REDUCING_EXPOSURE_EXEMPT' });
      },
    );
  });

  describe('DAILY_LOSS', () => {
    it('discards a BUY when daily loss is reached', () => {
      const decision = evaluateActionCaps(baseInput({ kind: 'BUY', dailyLossReached: true }));
      expect(decision).toEqual({
        allowed: false,
        blockedBy: 'DAILY_LOSS',
        disposition: 'DISCARDED',
        reason: 'DAILY_LOSS_LIMIT_REACHED',
      });
    });

    it('does not block PROTECTION_REARM (NEUTRAL) even when daily loss is reached', () => {
      const decision = evaluateActionCaps(
        baseInput({ kind: 'PROTECTION_REARM', dailyLossReached: true }),
      );
      expect(decision.allowed).toBe(true);
    });
  });

  describe('MIN_INTERVAL', () => {
    it('defers a BUY when the minimum interval has not elapsed', () => {
      const decision = evaluateActionCaps(
        baseInput({ kind: 'BUY', lastExecutedActionAtMs: 970_000, minActionIntervalMs: 60_000 }),
      );
      expect(decision).toEqual({
        allowed: false,
        blockedBy: 'MIN_INTERVAL',
        disposition: 'DEFERRED',
        reason: 'MIN_ACTION_INTERVAL_NOT_ELAPSED',
      });
    });

    it('defers a PROTECTION_REARM when the minimum interval has not elapsed', () => {
      const decision = evaluateActionCaps(
        baseInput({
          kind: 'PROTECTION_REARM',
          lastExecutedActionAtMs: 970_000,
          minActionIntervalMs: 60_000,
        }),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.blockedBy).toBe('MIN_INTERVAL');
        expect(decision.disposition).toBe('DEFERRED');
      }
    });

    it('allows when exactly at the interval boundary', () => {
      const decision = evaluateActionCaps(
        baseInput({ kind: 'BUY', now: 1_000_000, lastExecutedActionAtMs: 940_000, minActionIntervalMs: 60_000 }),
      );
      expect(decision.allowed).toBe(true);
    });

    it('skips the interval check when there is no previous executed action', () => {
      const decision = evaluateActionCaps(baseInput({ kind: 'BUY', lastExecutedActionAtMs: null }));
      expect(decision.allowed).toBe(true);
    });
  });

  describe('ACTIONS_PER_HOUR', () => {
    it('defers a BUY when the hourly cap is reached', () => {
      const decision = evaluateActionCaps(
        baseInput({ kind: 'BUY', executedActionsInLastHour: 6, maxActionsPerHour: 6 }),
      );
      expect(decision).toEqual({
        allowed: false,
        blockedBy: 'ACTIONS_PER_HOUR',
        disposition: 'DEFERRED',
        reason: 'MAX_ACTIONS_PER_HOUR_REACHED',
      });
    });

    it('defers a PROTECTION_REARM when the hourly cap is reached', () => {
      const decision = evaluateActionCaps(
        baseInput({ kind: 'PROTECTION_REARM', executedActionsInLastHour: 6, maxActionsPerHour: 6 }),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.blockedBy).toBe('ACTIONS_PER_HOUR');
      }
    });

    it('allows when strictly below the hourly cap', () => {
      const decision = evaluateActionCaps(
        baseInput({ kind: 'BUY', executedActionsInLastHour: 5, maxActionsPerHour: 6 }),
      );
      expect(decision.allowed).toBe(true);
    });
  });

  describe('evaluation order (fixed precedence from architect.md §6.3)', () => {
    it('reports DAILY_LOSS before MIN_INTERVAL or ACTIONS_PER_HOUR when all would block a BUY', () => {
      const decision = evaluateActionCaps(
        baseInput({
          kind: 'BUY',
          dailyLossReached: true,
          lastExecutedActionAtMs: 999_999,
          executedActionsInLastHour: 6,
          maxActionsPerHour: 6,
        }),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.blockedBy).toBe('DAILY_LOSS');
    });

    it('reports MIN_INTERVAL before ACTIONS_PER_HOUR when both would block a BUY', () => {
      const decision = evaluateActionCaps(
        baseInput({
          kind: 'BUY',
          lastExecutedActionAtMs: 999_999,
          minActionIntervalMs: 60_000,
          executedActionsInLastHour: 6,
          maxActionsPerHour: 6,
        }),
      );
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.blockedBy).toBe('MIN_INTERVAL');
    });
  });

  it('allows a BUY when within every cap', () => {
    const decision = evaluateActionCaps(baseInput({ kind: 'BUY' }));
    expect(decision).toEqual({ allowed: true, reason: 'WITHIN_CAPS' });
  });

  describe('CA-004: the decision is invariant to any LLM-shaped extra data (proof at the signature level)', () => {
    it('produces the same blocked decision regardless of arbitrary confidence/reasoning-like values, and takes no execution path', () => {
      const arbitraryLlmLikeValues = [
        { confidence: 0, reasoning: '' },
        { confidence: 0.5, reasoning: 'strong bullish divergence, high conviction' },
        { confidence: 1, reasoning: 'x'.repeat(500) },
      ];

      const executeMock = vi.fn();
      const input = baseInput({
        kind: 'BUY',
        executedActionsInLastHour: 6,
        maxActionsPerHour: 6,
      });

      const decisions = arbitraryLlmLikeValues.map(() => {
        const decision = evaluateActionCaps(input);
        return decision;
      });

      expect(executeMock).not.toHaveBeenCalled();
      decisions.forEach((decision) => expect(decision).toEqual(decisions[0]));
    });
  });
});
