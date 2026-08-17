import { forgeSizingSchema, parseForgeSizing } from './forge-sizing.schema';

describe('forgeSizingSchema', () => {
  it('parses a fully valid payload, mapping maxTradeSize to maxTradePct', () => {
    const result = forgeSizingSchema.parse({
      recommendation: 'proceed',
      maxTradeSize: 0.05,
      reasoning: 'Volatilidad baja, se puede operar el tamaño completo.',
    });

    expect(result).toEqual({
      recommendation: 'proceed',
      maxTradePct: 0.05,
      reasoning: 'Volatilidad baja, se puede operar el tamaño completo.',
    });
  });

  it('degrades a missing payload to a neutral proceed with null maxTradePct', () => {
    const result = forgeSizingSchema.parse({});

    expect(result).toEqual({
      recommendation: 'proceed',
      maxTradePct: null,
      reasoning: '',
    });
  });

  it('degrades an invalid recommendation value to proceed', () => {
    const result = forgeSizingSchema.parse({ recommendation: 'maybe' });
    expect(result.recommendation).toBe('proceed');
  });

  it('parses skip as-is', () => {
    const result = forgeSizingSchema.parse({ recommendation: 'skip' });
    expect(result.recommendation).toBe('skip');
  });

  it('degrades an out-of-range maxTradeSize to null instead of clamping silently', () => {
    const result = forgeSizingSchema.parse({ maxTradeSize: 3 });
    expect(result.maxTradePct).toBeNull();
  });

  it('coerces a numeric-string maxTradeSize', () => {
    const result = forgeSizingSchema.parse({ maxTradeSize: '0.03' });
    expect(result.maxTradePct).toBe(0.03);
  });
});

describe('parseForgeSizing', () => {
  it('parses raw JSON text from the LLM into a typed ForgeSizingSummary', () => {
    const raw =
      '{"recommendation":"skip","maxTradeSize":0.02,"reasoning":"Concentración excesiva en el activo"}';

    expect(parseForgeSizing(raw)).toEqual({
      recommendation: 'skip',
      maxTradePct: 0.02,
      reasoning: 'Concentración excesiva en el activo',
    });
  });

  it('degrades unparsable text to a neutral proceed with null maxTradePct', () => {
    expect(parseForgeSizing('not json at all')).toEqual({
      recommendation: 'proceed',
      maxTradePct: null,
      reasoning: '',
    });
  });

  it('strips <think> tags and markdown fences before parsing', () => {
    const raw =
      '<think>reasoning...</think>```json\n{"recommendation":"proceed","maxTradeSize":0.04}\n```';
    const result = parseForgeSizing(raw);
    expect(result.recommendation).toBe('proceed');
    expect(result.maxTradePct).toBe(0.04);
  });
});
