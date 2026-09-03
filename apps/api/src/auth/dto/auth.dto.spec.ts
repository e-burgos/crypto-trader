import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LLMKeyDto, LLMModelDto } from './auth.dto';

async function validateLLMKey(overrides: Record<string, unknown>) {
  const instance = plainToInstance(LLMKeyDto, {
    provider: 'CLAUDE',
    apiKey: 'sk-ant-valid',
    ...overrides,
  });
  return validate(instance);
}

async function validateLLMModel(overrides: Record<string, unknown>) {
  const instance = plainToInstance(LLMModelDto, {
    provider: 'CLAUDE',
    ...overrides,
  });
  return validate(instance);
}

describe('LLMKeyDto', () => {
  it('accepts a known provider with a non-empty apiKey', async () => {
    const errors = await validateLLMKey({});
    expect(errors).toHaveLength(0);
  });

  it('rejects a provider outside the LLMProvider enum', async () => {
    const errors = await validateLLMKey({ provider: 'NOT_A_PROVIDER' });
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });

  it('rejects an empty apiKey', async () => {
    const errors = await validateLLMKey({ apiKey: '' });
    expect(errors.some((e) => e.property === 'apiKey')).toBe(true);
  });
});

describe('LLMModelDto', () => {
  it('accepts a known provider', async () => {
    const errors = await validateLLMModel({});
    expect(errors).toHaveLength(0);
  });

  it('rejects a provider outside the LLMProvider enum', async () => {
    const errors = await validateLLMModel({ provider: 'NOT_A_PROVIDER' });
    expect(errors.some((e) => e.property === 'provider')).toBe(true);
  });
});
