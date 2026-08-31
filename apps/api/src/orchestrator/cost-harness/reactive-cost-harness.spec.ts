import {
  buildGateSnapshot,
  evaluateDeterministicGate,
  DEFAULT_GATE_THRESHOLDS,
  detectMaterialEvent,
  DEFAULT_MATERIAL_EVENT_THRESHOLDS,
  type MaterialEventReference,
  type MaterialEventState,
  type MaterialEventType,
} from '@crypto-trader/analysis';
import type { AgentTask } from '../sub-agent.service';
import {
  buildScenarioCandleAt,
  buildScenarioTicks,
  computeMacroFingerprint,
  computeNewsFingerprint,
  computePositionsFingerprint,
  REACTIVE_EVENT_SCENARIOS,
  REACTIVE_HARNESS_SCENARIOS,
  SCENARIOS,
  type CostScenario,
  type ScenarioTick,
} from './scenarios.fixture';
import { CountingLLMClient } from './counting-llm-client';
import { scoreRun, type RecordedCall } from './cost-model';

const HARNESS_PROVIDER = 'claude';
const HARNESS_MODEL = 'claude-sonnet-4-20250514';
const DECISION_TASK: AgentTask = 'technical_signal';
const DECISION_SYSTEM_PROMPT = 'reactive cost harness decision cycle';
const DECISION_MAX_TOKENS = 256;
const TICK_COUNT = 50;

type RunId = 'BASELINE' | 'REACTIVE';

interface ScenarioOutcome {
  cycles: number;
  llmCalls: number;
  advancesGranted: number;
  advanceEvent: MaterialEventType | null;
}

interface DetectedAdvance {
  tick: ScenarioTick;
  event: MaterialEventType;
}

const EXPECTED_ADVANCE_EVENT: Readonly<Record<string, MaterialEventType>> = {
  'broken-price-spike': 'PRICE_MOVED',
  'level-break-under-price-threshold': 'LEVEL_BREAK',
  'volume-spike-with-flat-price': 'VOLUME_SPIKE',
};

function buildMaterialReference(scenario: CostScenario): MaterialEventReference {
  return {
    close: scenario.previous.close,
    takenAt: scenario.previous.takenAt,
    supportResistance: scenario.indicators.supportResistance,
    volumeAverage: scenario.indicators.volume.average,
  };
}

function initialDetectorState(): MaterialEventState {
  return {
    confirmedSideByLevel: {},
    lastVolumeEventCandleOpenTime: null,
    lastEvaluatedAtMs: null,
  };
}

function findAdvance(
  scenario: CostScenario,
  ticks: readonly ScenarioTick[],
): DetectedAdvance | null {
  const reference = buildMaterialReference(scenario);
  let state = initialDetectorState();

  for (const tick of ticks) {
    const result = detectMaterialEvent({
      now: tick.timestamp,
      tick: { price: tick.price, timestamp: tick.timestamp },
      candle: buildScenarioCandleAt(scenario, tick),
      reference,
      state,
      thresholds: DEFAULT_MATERIAL_EVENT_THRESHOLDS,
      referenceMaxAgeMs: DEFAULT_GATE_THRESHOLDS.previousDecisionMaxAgeMs,
    });
    state = result.state;
    if (result.event) return { tick, event: result.event };
  }

  return null;
}

function gateHoldsAt(
  scenario: CostScenario,
  decisionClose: number,
  decisionTakenAt: number,
): boolean {
  const current = buildGateSnapshot({
    close: decisionClose,
    indicators: scenario.indicators,
    newsFingerprint: computeNewsFingerprint(scenario.news),
    macroFingerprint: computeMacroFingerprint(scenario.macro),
    positionsFingerprint: computePositionsFingerprint(scenario.openPositions),
    takenAt: decisionTakenAt,
  });

  const result = evaluateDeterministicGate({
    enabled: true,
    now: scenario.now,
    reconciliationConfirmed: scenario.reconciliationConfirmed,
    current,
    previous: scenario.previous,
    thresholds: DEFAULT_GATE_THRESHOLDS,
  });

  return result.holds;
}

async function recordDecisionCall(
  scenarioKey: string,
  calls: RecordedCall[],
): Promise<void> {
  const client = new CountingLLMClient({
    scenarioId: scenarioKey,
    task: DECISION_TASK,
    provider: HARNESS_PROVIDER,
    model: HARNESS_MODEL,
    promptCachingEnabled: false,
    calls,
  });

  await client.complete(DECISION_SYSTEM_PROMPT, scenarioKey, {
    maxTokens: DECISION_MAX_TOKENS,
  });
}

function scenarioKey(runId: RunId, scenario: CostScenario): string {
  return `${runId}:${scenario.id}`;
}

async function runBaseline(
  scenario: CostScenario,
  calls: RecordedCall[],
): Promise<ScenarioOutcome> {
  const holds = gateHoldsAt(scenario, scenario.close, scenario.snapshotTakenAt);
  if (!holds) {
    await recordDecisionCall(scenarioKey('BASELINE', scenario), calls);
  }
  return { cycles: 1, llmCalls: holds ? 0 : 1, advancesGranted: 0, advanceEvent: null };
}

async function runReactive(
  scenario: CostScenario,
  calls: RecordedCall[],
): Promise<ScenarioOutcome> {
  const ticks = buildScenarioTicks(scenario, TICK_COUNT);
  const advance = findAdvance(scenario, ticks);
  const decisionClose = advance ? advance.tick.price : scenario.close;
  const decisionTakenAt = advance ? advance.tick.timestamp : scenario.snapshotTakenAt;

  const holds = gateHoldsAt(scenario, decisionClose, decisionTakenAt);
  if (!holds) {
    await recordDecisionCall(scenarioKey('REACTIVE', scenario), calls);
  }
  return {
    cycles: 1,
    llmCalls: holds ? 0 : 1,
    advancesGranted: advance ? 1 : 0,
    advanceEvent: advance ? advance.event : null,
  };
}

describe('Reactive cost harness — CA-003 (architect.md §4.4): the reactive loop must not raise LLM cost', () => {
  const calls: RecordedCall[] = [];
  const baselineByScenario = new Map<string, ScenarioOutcome>();
  const reactiveByScenario = new Map<string, ScenarioOutcome>();

  beforeAll(async () => {
    for (const scenario of REACTIVE_HARNESS_SCENARIOS) {
      baselineByScenario.set(scenario.id, await runBaseline(scenario, calls));
    }
    for (const scenario of REACTIVE_HARNESS_SCENARIOS) {
      reactiveByScenario.set(scenario.id, await runReactive(scenario, calls));
    }
  });

  it('buildScenarioTicks interpolates linearly between the previous and current decision, sustaining volume', () => {
    for (const scenario of REACTIVE_HARNESS_SCENARIOS) {
      const ticks = buildScenarioTicks(scenario, TICK_COUNT);

      expect(ticks).toHaveLength(TICK_COUNT);
      expect(ticks[0].price).toBeCloseTo(scenario.previous.close, 8);
      expect(ticks[0].timestamp).toBe(scenario.previous.takenAt);
      expect(ticks[ticks.length - 1].price).toBeCloseTo(scenario.close, 8);
      expect(ticks[ticks.length - 1].timestamp).toBe(scenario.snapshotTakenAt);

      for (const tick of ticks) {
        expect(tick.volume).toBe(scenario.indicators.volume.current);
      }
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].timestamp).toBeGreaterThanOrEqual(ticks[i - 1].timestamp);
      }
    }
  });

  it('cycles: every scenario resolves exactly one decision cycle per window, with the loop off or on (D2)', () => {
    for (const scenario of REACTIVE_HARNESS_SCENARIOS) {
      expect(baselineByScenario.get(scenario.id)?.cycles).toBe(1);
      expect(reactiveByScenario.get(scenario.id)?.cycles).toBe(1);
    }
  });

  it('CA-003 per scenario: the reactive run never calls the LLM more than the baseline run', () => {
    for (const scenario of REACTIVE_HARNESS_SCENARIOS) {
      const baseline = baselineByScenario.get(scenario.id);
      const reactive = reactiveByScenario.get(scenario.id);
      expect(reactive?.llmCalls).toBeLessThanOrEqual(baseline?.llmCalls ?? 0);
    }
  });

  it('CA-003 aggregate: total reactive LLM calls never exceed total baseline calls across every harness scenario', () => {
    const totalBaseline = REACTIVE_HARNESS_SCENARIOS.reduce(
      (sum, s) => sum + (baselineByScenario.get(s.id)?.llmCalls ?? 0),
      0,
    );
    const totalReactive = REACTIVE_HARNESS_SCENARIOS.reduce(
      (sum, s) => sum + (reactiveByScenario.get(s.id)?.llmCalls ?? 0),
      0,
    );

    expect(totalReactive).toBeLessThanOrEqual(totalBaseline);

    const baselineCalls = calls.filter((c) => c.scenarioId.startsWith('BASELINE:'));
    const reactiveCalls = calls.filter((c) => c.scenarioId.startsWith('REACTIVE:'));
    expect(scoreRun(reactiveCalls).invocations).toBeLessThanOrEqual(
      scoreRun(baselineCalls).invocations,
    );
  });

  it('window-token invariant: no scenario grants more than one advance (rx:v1:advance token, D2)', () => {
    for (const scenario of REACTIVE_HARNESS_SCENARIOS) {
      expect(reactiveByScenario.get(scenario.id)?.advancesGranted).toBeLessThanOrEqual(1);
    }
  });

  it('non-vacuity: at least three scenarios actually advance their cycle', () => {
    const totalAdvances = REACTIVE_HARNESS_SCENARIOS.reduce(
      (sum, s) => sum + (reactiveByScenario.get(s.id)?.advancesGranted ?? 0),
      0,
    );

    expect(totalAdvances).toBeGreaterThanOrEqual(3);
  });

  it('the harness exercises all three material event types, each advance matching its declared type', () => {
    const advancedEvents = REACTIVE_HARNESS_SCENARIOS.map((s) => ({
      id: s.id,
      event: reactiveByScenario.get(s.id)?.advanceEvent ?? null,
    })).filter((entry) => entry.event !== null);

    for (const entry of advancedEvents) {
      expect(entry.event).toBe(EXPECTED_ADVANCE_EVENT[entry.id]);
    }

    expect(new Set(advancedEvents.map((entry) => entry.event))).toEqual(
      new Set<MaterialEventType>(['PRICE_MOVED', 'LEVEL_BREAK', 'VOLUME_SPIKE']),
    );
  });

  it('the reactive-only scenarios are absent from the frozen fixture the LLM cost harness asserts on (CA-059)', () => {
    for (const scenario of REACTIVE_EVENT_SCENARIOS) {
      expect(SCENARIOS.some((s) => s.id === scenario.id)).toBe(false);
    }
    expect(REACTIVE_HARNESS_SCENARIOS).toHaveLength(
      SCENARIOS.length + REACTIVE_EVENT_SCENARIOS.length,
    );
  });
});
