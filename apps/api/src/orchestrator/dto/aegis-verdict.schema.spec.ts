import { AegisVerdict } from './decision-synthesis.dto';
import {
  aegisVerdictSchema,
  isOverridableBlock,
  parseAegisVerdict,
} from './aegis-verdict.schema';

describe('aegisVerdictSchema', () => {
  it('parses a fully valid payload as-is', () => {
    const result = aegisVerdictSchema.parse({
      riskScore: 72,
      verdict: 'REDUCE',
      positionSizeMultiplier: 0.5,
      blockReasons: [],
      reason: 'Volatilidad elevada',
      alerts: ['drawdown cerca del límite'],
    });

    expect(result).toEqual({
      riskScore: 72,
      verdict: 'REDUCE',
      positionSizeMultiplier: 0.5,
      blockReasons: [],
      reason: 'Volatilidad elevada',
      alerts: ['drawdown cerca del límite'],
    });
  });

  it('degrades missing fields to their neutral default instead of throwing', () => {
    const result = aegisVerdictSchema.parse({});

    expect(result).toEqual({
      riskScore: 50,
      verdict: 'PASS',
      positionSizeMultiplier: 1,
      blockReasons: [],
      reason: '',
      alerts: [],
    });
  });

  it('degrades an invalid verdict value to PASS', () => {
    const result = aegisVerdictSchema.parse({ verdict: 'MAYBE' });
    expect(result.verdict).toBe('PASS');
  });

  it('degrades blockReasons to an empty array when it contains an unrecognized value', () => {
    const result = aegisVerdictSchema.parse({
      verdict: 'BLOCK',
      blockReasons: ['DRAWDOWN', 'NOT_A_REAL_REASON'],
    });
    expect(result.blockReasons).toEqual([]);
  });

  it('accepts blockReasons made up entirely of recognized values', () => {
    const result = aegisVerdictSchema.parse({
      verdict: 'BLOCK',
      blockReasons: ['DRAWDOWN', 'MAX_POSITIONS'],
    });
    expect(result.blockReasons).toEqual(['DRAWDOWN', 'MAX_POSITIONS']);
  });

  it('clamps positionSizeMultiplier above 1 down to the schema max', () => {
    const result = aegisVerdictSchema.parse({ positionSizeMultiplier: 3 });
    expect(result.positionSizeMultiplier).toBe(1);
  });

  it('clamps a negative positionSizeMultiplier to the schema default', () => {
    const result = aegisVerdictSchema.parse({ positionSizeMultiplier: -0.5 });
    expect(result.positionSizeMultiplier).toBe(1);
  });

  it('coerces a numeric-string riskScore and clamps it above 100 down to the default', () => {
    const result = aegisVerdictSchema.parse({ riskScore: '150' });
    expect(result.riskScore).toBe(50);
  });
});

describe('parseAegisVerdict', () => {
  it('parses raw JSON text from the LLM into a typed AegisVerdict', () => {
    const raw =
      '{"riskScore":88,"verdict":"BLOCK","positionSizeMultiplier":0,"blockReasons":["DRAWDOWN"],"reason":"Drawdown semanal superado","alerts":[]}';

    expect(parseAegisVerdict(raw)).toEqual({
      riskScore: 88,
      verdict: 'BLOCK',
      positionSizeMultiplier: 0,
      blockReasons: ['DRAWDOWN'],
      reason: 'Drawdown semanal superado',
      alerts: [],
    });
  });

  it('degrades unparsable text to a neutral PASS verdict instead of throwing', () => {
    expect(parseAegisVerdict('not json at all')).toEqual({
      riskScore: 50,
      verdict: 'PASS',
      positionSizeMultiplier: 1,
      blockReasons: [],
      reason: '',
      alerts: [],
    });
  });

  it('strips <think> tags and markdown fences before parsing', () => {
    const raw =
      '<think>reasoning...</think>```json\n{"verdict":"REDUCE","positionSizeMultiplier":0.4}\n```';
    const result = parseAegisVerdict(raw);
    expect(result.verdict).toBe('REDUCE');
    expect(result.positionSizeMultiplier).toBe(0.4);
  });
});

describe('isOverridableBlock', () => {
  const base: AegisVerdict = {
    riskScore: 90,
    verdict: 'BLOCK',
    positionSizeMultiplier: 0,
    blockReasons: [],
    reason: 'Concentración de riesgo detectada',
    alerts: [],
  };

  it('is fail-closed when blockReasons is empty, regardless of the reason text', () => {
    expect(isOverridableBlock({ ...base, blockReasons: [] })).toBe(false);
  });

  it('is overridable when blockReasons is exactly [SINGLE_ASSET_CONCENTRATION]', () => {
    expect(
      isOverridableBlock({
        ...base,
        blockReasons: ['SINGLE_ASSET_CONCENTRATION'],
      }),
    ).toBe(true);
  });

  it('is fail-closed when blockReasons mixes the overridable reason with any other reason', () => {
    expect(
      isOverridableBlock({
        ...base,
        blockReasons: ['SINGLE_ASSET_CONCENTRATION', 'DRAWDOWN'],
      }),
    ).toBe(false);
  });

  it('is fail-closed for a single non-overridable reason even if the text says "concentración"', () => {
    expect(
      isOverridableBlock({
        ...base,
        blockReasons: ['DRAWDOWN'],
        reason: 'Concentración de riesgo detectada',
      }),
    ).toBe(false);
  });

  it('returns false when verdict is not BLOCK, regardless of blockReasons', () => {
    expect(
      isOverridableBlock({
        ...base,
        verdict: 'REDUCE',
        blockReasons: ['SINGLE_ASSET_CONCENTRATION'],
      }),
    ).toBe(false);
  });

  it('returns false for PASS with no blockReasons', () => {
    expect(
      isOverridableBlock({ ...base, verdict: 'PASS', blockReasons: [] }),
    ).toBe(false);
  });
});
