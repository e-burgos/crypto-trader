import {
  buildGateSnapshot,
  evaluateDeterministicGate,
  DEFAULT_GATE_THRESHOLDS,
} from '@crypto-trader/analysis';
import type { AgentTask } from '../sub-agent.service';
import { resolveMaxTokensForTask } from '../agent-task-limits';
import { InMemorySharedCache } from '../../cache/in-memory-shared-cache.service';
import { SignalCacheService } from '../../cache/signal-cache.service';
import {
  computeMacroFingerprint,
  computeNewsFingerprint,
  computePositionsFingerprint,
  HARNESS_ASSET,
  HARNESS_PAIR,
  HARNESS_TIMEFRAME,
  SCENARIOS,
  type CostScenario,
} from './scenarios.fixture';
import { CountingLLMClient } from './counting-llm-client';
import { scoreRun, type RecordedCall } from './cost-model';

const HARNESS_PROVIDER = 'claude';
const HARNESS_MODEL = 'claude-sonnet-4-20250514';

const BASELINE_MAX_TOKENS = 1024;

const HARNESS_LEGS: readonly AgentTask[] = [
  'technical_signal',
  'news_sentiment',
  'sizing_suggestion',
  'risk_gate',
  'macro_context',
];

function buildHarnessSystemPrompt(): string {
  const sentence =
    'You are a specialized trading sub-agent operating inside a multi-agent crypto trading system; follow your persona instructions precisely and respond only with the requested JSON schema. ';
  const targetChars = 700 * 4; // representative of the 650-830 tok AgentDefinition prompts (§4.2)
  return sentence.repeat(Math.ceil(targetChars / sentence.length)).slice(0, targetChars);
}

const HARNESS_SYSTEM_PROMPT = buildHarnessSystemPrompt();

function buildHarnessUserPrompt(task: AgentTask, scenario: CostScenario): string {
  switch (task) {
    case 'technical_signal':
      return JSON.stringify({ indicators: scenario.indicators });
    case 'news_sentiment':
      return JSON.stringify({ news: scenario.news });
    case 'sizing_suggestion':
      return JSON.stringify({ openPositions: scenario.openPositions });
    case 'risk_gate':
      return JSON.stringify({
        openPositions: scenario.openPositions,
        indicators: scenario.indicators,
      });
    case 'macro_context':
      return JSON.stringify({ macro: scenario.macro });
    default:
      return '{}';
  }
}

interface RunConfig {
  gateEnabled: boolean;
  cacheEnabled: boolean;
  promptCachingEnabled: boolean;
  maxTokensForTask: (task: AgentTask) => number;
}

const BASELINE_CONFIG: RunConfig = {
  gateEnabled: false,
  cacheEnabled: false,
  promptCachingEnabled: false,
  maxTokensForTask: () => BASELINE_MAX_TOKENS,
};

const OPTIMIZED_CONFIG: RunConfig = {
  gateEnabled: true,
  cacheEnabled: true,
  promptCachingEnabled: true,
  maxTokensForTask: resolveMaxTokensForTask,
};

function evaluateScenarioGate(scenario: CostScenario, gateEnabled: boolean): boolean {
  const positionsFingerprint = computePositionsFingerprint(scenario.openPositions);
  const newsFingerprint = computeNewsFingerprint(scenario.news);
  const macroFingerprint = computeMacroFingerprint(scenario.macro);

  const current = buildGateSnapshot({
    close: scenario.close,
    indicators: scenario.indicators,
    newsFingerprint,
    macroFingerprint,
    positionsFingerprint,
    takenAt: scenario.snapshotTakenAt,
  });

  const result = evaluateDeterministicGate({
    enabled: gateEnabled,
    now: scenario.now,
    reconciliationConfirmed: scenario.reconciliationConfirmed,
    current,
    previous: scenario.previous,
    thresholds: DEFAULT_GATE_THRESHOLDS,
  });

  return result.holds;
}

async function callLeg(
  scenario: CostScenario,
  task: AgentTask,
  config: RunConfig,
  calls: RecordedCall[],
): Promise<void> {
  const client = new CountingLLMClient({
    scenarioId: scenario.id,
    task,
    provider: HARNESS_PROVIDER,
    model: HARNESS_MODEL,
    promptCachingEnabled: config.promptCachingEnabled,
    calls,
  });

  await client.complete(HARNESS_SYSTEM_PROMPT, buildHarnessUserPrompt(task, scenario), {
    maxTokens: config.maxTokensForTask(task),
  });
}

async function runSubAgentLegs(
  scenario: CostScenario,
  config: RunConfig,
  calls: RecordedCall[],
  signalCache: SignalCacheService,
): Promise<void> {
  await Promise.all(
    HARNESS_LEGS.map((task) => {
      if (task === 'technical_signal') {
        return signalCache.getOrComputeTechnical(
          HARNESS_ASSET,
          HARNESS_PAIR,
          HARNESS_TIMEFRAME,
          async () => {
            await callLeg(scenario, task, config, calls);
            return 'cached';
          },
        );
      }
      if (task === 'macro_context') {
        return signalCache.getOrComputeMacro(
          HARNESS_ASSET,
          HARNESS_PAIR,
          HARNESS_TIMEFRAME,
          async () => {
            await callLeg(scenario, task, config, calls);
            return 'cached';
          },
        );
      }
      return callLeg(scenario, task, config, calls);
    }),
  );
}

interface SuiteResult {
  invocations: number;
  costProxy: number;
  byScenario: Record<string, { gateApplied: boolean }>;
}

async function runSuite(config: RunConfig): Promise<SuiteResult> {
  const calls: RecordedCall[] = [];
  const signalCache = new SignalCacheService(new InMemorySharedCache());
  const previousCacheFlag = process.env.SHARED_SIGNAL_CACHE_ENABLED;
  process.env.SHARED_SIGNAL_CACHE_ENABLED = config.cacheEnabled ? 'true' : 'false';

  try {
    const byScenario: Record<string, { gateApplied: boolean }> = {};

    for (const scenario of SCENARIOS) {
      const gateApplied = evaluateScenarioGate(scenario, config.gateEnabled);
      byScenario[scenario.id] = { gateApplied };
      if (gateApplied) continue;
      await runSubAgentLegs(scenario, config, calls, signalCache);
    }

    const { invocations, costProxy } = scoreRun(calls);
    return { invocations, costProxy, byScenario };
  } finally {
    if (previousCacheFlag === undefined) {
      delete process.env.SHARED_SIGNAL_CACHE_ENABLED;
    } else {
      process.env.SHARED_SIGNAL_CACHE_ENABLED = previousCacheFlag;
    }
  }
}

describe('LLM cost harness — deterministic verification of the -50% ahorro (cycle-03)', () => {
  it('CA-059: the fixture is a fixed set of 12 scenarios covering "no signal" and "with signal" cases', () => {
    expect(SCENARIOS).toHaveLength(12);
    expect(SCENARIOS.filter((s) => !s.withSignal)).toHaveLength(5);
    expect(SCENARIOS.filter((s) => s.withSignal)).toHaveLength(7);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(12);
  });

  it('CA-060/CA-061: runs the same 12 scenarios twice (baseline vs optimized), and the optimized run needs at least 50% fewer invocations and 50% less cost proxy', async () => {
    const baseline = await runSuite(BASELINE_CONFIG);
    const optimized = await runSuite(OPTIMIZED_CONFIG);

    // Baseline: gate disabled ⇒ every scenario calls all 5 legs (12 × 5 = 60).
    expect(baseline.invocations).toBe(SCENARIOS.length * HARNESS_LEGS.length);

    expect(optimized.invocations).toBeGreaterThan(0);
    expect(optimized.invocations).toBeLessThanOrEqual(baseline.invocations * 0.5);
    expect(optimized.costProxy).toBeLessThanOrEqual(baseline.costProxy * 0.5);
  });

  it('CA-062: no "with signal" scenario resolves HOLD by the gate in the optimized run — asserted per scenario, never in aggregate', async () => {
    const optimized = await runSuite(OPTIMIZED_CONFIG);

    for (const scenario of SCENARIOS.filter((s) => s.withSignal)) {
      expect(optimized.byScenario[scenario.id].gateApplied).toBe(false);
    }
  });

  it('every "no signal" scenario resolves HOLD by the gate in the optimized run, with zero LLM calls', async () => {
    const optimized = await runSuite(OPTIMIZED_CONFIG);

    for (const scenario of SCENARIOS.filter((s) => !s.withSignal)) {
      expect(optimized.byScenario[scenario.id].gateApplied).toBe(true);
    }
  });

  it('the gate never applies in the baseline run, regardless of withSignal (feature disabled by default, RN-04)', async () => {
    const baseline = await runSuite(BASELINE_CONFIG);

    for (const scenario of SCENARIOS) {
      expect(baseline.byScenario[scenario.id].gateApplied).toBe(false);
    }
  });

  it('with the shared signal cache active, repeated technical/macro legs across scenarios of the same (asset, pair, timeframe) collapse to a single real invocation (D2)', async () => {
    const cachedOnly = await runSuite(OPTIMIZED_CONFIG);
    const uncached = await runSuite({ ...OPTIMIZED_CONFIG, cacheEnabled: false });

    expect(cachedOnly.invocations).toBeLessThan(uncached.invocations);
  });

  it('documents that prompt caching contributes zero savings with today’s system prompt sizes (§4.2) — the -50% does not depend on it', async () => {
    const withPromptCaching = await runSuite(OPTIMIZED_CONFIG);
    const withoutPromptCaching = await runSuite({
      ...OPTIMIZED_CONFIG,
      promptCachingEnabled: false,
    });

    expect(withPromptCaching.costProxy).toBe(withoutPromptCaching.costProxy);
  });
});
