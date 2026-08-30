export type BotActionKind = 'BUY' | 'SELL_FULL' | 'SELL_PARTIAL' | 'PROTECTION_REARM';

export type ActionExposure = 'INCREASING' | 'REDUCING' | 'NEUTRAL';

export type ActionCapId = 'ACTIONS_PER_HOUR' | 'MIN_INTERVAL' | 'DAILY_LOSS';

export interface ActionCapsInput {
  now: number;
  kind: BotActionKind;
  executedActionsInLastHour: number;
  lastExecutedActionAtMs: number | null;
  maxActionsPerHour: number;
  minActionIntervalMs: number;
  dailyLossReached: boolean;
}

export type ActionCapsDecision =
  | { allowed: true; reason: string }
  | { allowed: false; blockedBy: ActionCapId; disposition: 'DEFERRED' | 'DISCARDED'; reason: string };

const EXPOSURE_BY_KIND: Readonly<Record<BotActionKind, ActionExposure>> = {
  BUY: 'INCREASING',
  SELL_FULL: 'REDUCING',
  SELL_PARTIAL: 'REDUCING',
  PROTECTION_REARM: 'NEUTRAL',
};

export function classifyActionExposure(kind: BotActionKind): ActionExposure {
  return EXPOSURE_BY_KIND[kind];
}

export function evaluateActionCaps(input: ActionCapsInput): ActionCapsDecision {
  const exposure = classifyActionExposure(input.kind);

  if (exposure === 'REDUCING') {
    return { allowed: true, reason: 'REDUCING_EXPOSURE_EXEMPT' };
  }

  if (input.dailyLossReached && exposure === 'INCREASING') {
    return {
      allowed: false,
      blockedBy: 'DAILY_LOSS',
      disposition: 'DISCARDED',
      reason: 'DAILY_LOSS_LIMIT_REACHED',
    };
  }

  if (
    input.lastExecutedActionAtMs != null &&
    input.now - input.lastExecutedActionAtMs < input.minActionIntervalMs
  ) {
    return {
      allowed: false,
      blockedBy: 'MIN_INTERVAL',
      disposition: 'DEFERRED',
      reason: 'MIN_ACTION_INTERVAL_NOT_ELAPSED',
    };
  }

  if (input.executedActionsInLastHour >= input.maxActionsPerHour) {
    return {
      allowed: false,
      blockedBy: 'ACTIONS_PER_HOUR',
      disposition: 'DEFERRED',
      reason: 'MAX_ACTIONS_PER_HOUR_REACHED',
    };
  }

  return { allowed: true, reason: 'WITHIN_CAPS' };
}
