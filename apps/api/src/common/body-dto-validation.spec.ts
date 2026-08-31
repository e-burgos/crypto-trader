import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  SetDataSourceCredentialDto,
  ToggleDataSourceDto,
  UpdateDataSourceConfigDto,
} from '../admin/dto/data-sources.dto';
import { SetMyDataSourceCredentialDto } from '../users/dto/data-source-credential.dto';
import { UpdateNewsConfigDto } from '../market/dto/news-config.dto';
import { SelectOptionDto } from '../chat/dto/chat.dto';
import {
  AutoNameAgentDto,
  InitSandboxWalletDto,
} from '../trading/dto/trading-config.dto';

const globalPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
});

function transformBody(metatype: any, body: unknown) {
  return globalPipe.transform(body, { type: 'body', metatype });
}

describe('Global ValidationPipe over the request bodies it used to skip (FIX-e-burgos-010)', () => {
  const cases: Array<{
    name: string;
    metatype: any;
    valid: Record<string, unknown>;
    extra: Record<string, unknown>;
    illTyped: Record<string, unknown>;
  }> = [
    {
      name: 'ToggleDataSourceDto',
      metatype: ToggleDataSourceDto,
      valid: { isActive: true },
      extra: { isActive: true, priority: 999 },
      illTyped: { isActive: 'yes' },
    },
    {
      name: 'UpdateDataSourceConfigDto',
      metatype: UpdateDataSourceConfigDto,
      valid: { priority: 5 },
      extra: { priority: 5, isActive: true },
      illTyped: { priority: 'high' },
    },
    {
      name: 'SetDataSourceCredentialDto',
      metatype: SetDataSourceCredentialDto,
      valid: { apiKey: 'sk-1', shared: true },
      extra: { apiKey: 'sk-1', userId: 'someone-else' },
      illTyped: { apiKey: '' },
    },
    {
      name: 'SetMyDataSourceCredentialDto',
      metatype: SetMyDataSourceCredentialDto,
      valid: { apiKey: 'sk-1' },
      extra: { apiKey: 'sk-1', shared: true },
      illTyped: { apiKey: 42 },
    },
    {
      name: 'UpdateNewsConfigDto',
      metatype: UpdateNewsConfigDto,
      valid: {
        intervalMinutes: 10,
        newsCount: 15,
        enabledSources: ['coindesk'],
        onlySummary: true,
        botEnabled: true,
        newsWeight: 15,
      },
      extra: { intervalMinutes: 10, userId: 'someone-else' },
      illTyped: { newsWeight: 500 },
    },
    {
      name: 'SelectOptionDto',
      metatype: SelectOptionDto,
      valid: { optionId: 'confirm', value: 'BTCUSDT' },
      extra: { optionId: 'confirm', value: 'BTCUSDT', sessionId: 'other' },
      illTyped: { optionId: 'confirm' },
    },
    {
      name: 'InitSandboxWalletDto',
      metatype: InitSandboxWalletDto,
      valid: { capitalUsdt: 10_000, capitalUsdc: 10_000 },
      extra: { capitalUsdt: 10_000, userId: 'someone-else' },
      illTyped: { capitalUsdt: -1 },
    },
    {
      name: 'AutoNameAgentDto',
      metatype: AutoNameAgentDto,
      valid: { asset: 'BTC', riskProfile: 'MODERATE' },
      extra: { asset: 'BTC', name: 'injected' },
      illTyped: { asset: 'BTC', riskProfile: 'RECKLESS' },
    },
  ];

  it.each(cases)('$name accepts a well-formed body', async ({
    metatype,
    valid,
  }) => {
    await expect(transformBody(metatype, valid)).resolves.toMatchObject(valid);
  });

  it.each(cases)('$name rejects a body carrying undeclared fields', async ({
    metatype,
    extra,
  }) => {
    await expect(transformBody(metatype, extra)).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each(cases)('$name rejects an ill-typed or out-of-range body', async ({
    metatype,
    illTyped,
  }) => {
    await expect(transformBody(metatype, illTyped)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('Every @Body() in the API is typed with a validated DTO class', () => {
  const apiSrc = resolve(__dirname, '..');

  function collectControllers(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        return entry === 'node_modules' ? [] : collectControllers(full);
      }
      return full.endsWith('.controller.ts') && !full.endsWith('.spec.ts')
        ? [full]
        : [];
    });
  }

  it('leaves no inline object, interface or any as a request body type', () => {
    const offenders: string[] = [];
    const bodyParam = /@Body\(\)\s*([A-Za-z_]\w*)\s*:\s*([^,)]+)/g;

    for (const file of collectControllers(apiSrc)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(bodyParam)) {
        const declaredType = match[2].trim();
        if (!/^[A-Z]\w*Dto$/.test(declaredType)) {
          offenders.push(`${relative(apiSrc, file)}: ${match[0].trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
