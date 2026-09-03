import { plainToInstance } from 'class-transformer';
import { validate, getMetadataStorage } from 'class-validator';
import {
  TRADING_CONFIG_BASE_FIELDS,
  TRADING_CONFIG_ADVANCED_FIELDS,
} from '@crypto-trader/shared';
import {
  CreateTradingConfigDto,
  UpdateTradingConfigDto,
  EntryOrderModeEnum,
} from './trading-config.dto';

function validatedProperties(target: new () => unknown): Set<string> {
  return new Set(
    getMetadataStorage()
      .getTargetValidationMetadatas(target, target.name, false, false)
      .map((meta) => meta.propertyName),
  );
}

const baseCreatePayload = {
  asset: 'BTC',
  pair: 'USDT',
  mode: 'SANDBOX',
};

async function validateCreate(overrides: Record<string, unknown>) {
  const instance = plainToInstance(CreateTradingConfigDto, {
    ...baseCreatePayload,
    ...overrides,
  });
  return validate(instance);
}

async function validateUpdate(overrides: Record<string, unknown>) {
  const instance = plainToInstance(UpdateTradingConfigDto, overrides);
  return validate(instance);
}

describe.each([
  ['CreateTradingConfigDto', validateCreate],
  ['UpdateTradingConfigDto', validateUpdate],
])('%s — entryOrderMode / entryOrderTtlMinutes / entryTrailingDeltaBips', (_, validateFn) => {
  it('accepts the three fields when within range', async () => {
    const errors = await validateFn({
      entryOrderMode: EntryOrderModeEnum.OCO,
      entryOrderTtlMinutes: 120,
      entryTrailingDeltaBips: 100,
    });

    expect(errors).toHaveLength(0);
  });

  it('omitting all three fields validates cleanly (default path, CA-001)', async () => {
    const errors = await validateFn({});

    expect(errors).toHaveLength(0);
  });

  it('rejects an entryOrderMode outside the enum', async () => {
    const errors = await validateFn({ entryOrderMode: 'STOP_LIMIT' });

    expect(errors.some((e) => e.property === 'entryOrderMode')).toBe(true);
  });

  it.each([4, 1441])(
    'rejects entryOrderTtlMinutes = %i (outside 5..1440)',
    async (value) => {
      const errors = await validateFn({ entryOrderTtlMinutes: value });

      expect(errors.some((e) => e.property === 'entryOrderTtlMinutes')).toBe(
        true,
      );
    },
  );

  it.each([5, 1440])(
    'accepts entryOrderTtlMinutes = %i (boundary of 5..1440)',
    async (value) => {
      const errors = await validateFn({ entryOrderTtlMinutes: value });

      expect(errors.some((e) => e.property === 'entryOrderTtlMinutes')).toBe(
        false,
      );
    },
  );

  it.each([9, 2001])(
    'rejects entryTrailingDeltaBips = %i (outside 10..2000)',
    async (value) => {
      const errors = await validateFn({ entryTrailingDeltaBips: value });

      expect(
        errors.some((e) => e.property === 'entryTrailingDeltaBips'),
      ).toBe(true);
    },
  );

  it.each([10, 2000])(
    'accepts entryTrailingDeltaBips = %i (boundary of 10..2000)',
    async (value) => {
      const errors = await validateFn({ entryTrailingDeltaBips: value });

      expect(
        errors.some((e) => e.property === 'entryTrailingDeltaBips'),
      ).toBe(false);
    },
  );

  it('rejects a non-integer entryTrailingDeltaBips', async () => {
    const errors = await validateFn({ entryTrailingDeltaBips: 100.5 });

    expect(errors.some((e) => e.property === 'entryTrailingDeltaBips')).toBe(
      true,
    );
  });
});

describe('UpdateTradingConfigDto — isActive has no column (FIX-e-burgos-027)', () => {
  it('rejects isActive as non-whitelisted', async () => {
    const instance = plainToInstance(UpdateTradingConfigDto, {
      isActive: true,
    });
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(
      errors.some(
        (e) => e.property === 'isActive' && !!e.constraints?.whitelistValidation,
      ),
    ).toBe(true);
  });

  it('does not declare isActive as a validated property', () => {
    expect(validatedProperties(UpdateTradingConfigDto).has('isActive')).toBe(
      false,
    );
  });
});

describe('trading-config DTOs — cross-DTO field parity', () => {
  const newFields = [
    'entryOrderMode',
    'entryOrderTtlMinutes',
    'entryTrailingDeltaBips',
  ];

  it('declares each new field as a validated property on both Create and Update DTOs', () => {
    const createFields = validatedProperties(CreateTradingConfigDto);
    const updateFields = validatedProperties(UpdateTradingConfigDto);

    for (const field of newFields) {
      expect(createFields.has(field)).toBe(true);
      expect(updateFields.has(field)).toBe(true);
    }
  });
});

describe('CreateTradingConfigDto — runtime key parity with the shared wire (D2)', () => {
  it('Object.keys of a fully-populated instance equals the wire field partitions', () => {
    const wireKeys = [...TRADING_CONFIG_BASE_FIELDS, ...TRADING_CONFIG_ADVANCED_FIELDS];
    const fixture = Object.fromEntries(wireKeys.map((key) => [key, 1]));

    const instance = plainToInstance(CreateTradingConfigDto, fixture);

    expect(wireKeys).toHaveLength(40);
    expect(new Set(Object.keys(instance))).toEqual(new Set(wireKeys));
  });
});
