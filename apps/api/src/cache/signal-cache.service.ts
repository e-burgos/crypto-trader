import { Inject, Injectable } from '@nestjs/common';
import { SHARED_CACHE } from './shared-cache.port';
import type { SharedCachePort } from './shared-cache.port';

export const DEFAULT_ANALYSIS_TIMEFRAME = '1h';

export const SIGNAL_TTL_TECHNICAL_MS = 5 * 60_000;
export const SIGNAL_TTL_MACRO_MS = 4 * 60 * 60_000;
export const SIGNAL_TTL_NEWS_MS = 10 * 60_000;

export function buildTechnicalSignalKey(
  asset: string,
  pair: string,
  timeframe: string,
): string {
  return `sig:v1:tech:${asset}:${pair}:${timeframe}`;
}

export function buildMacroSignalKey(
  asset: string,
  pair: string,
  timeframe: string,
): string {
  return `sig:v1:macro:${asset}:${pair}:${timeframe}`;
}

export function buildNewsSignalKey(
  asset: string,
  pair: string,
  newsFingerprint: string,
): string {
  return `sig:v1:news:${asset}:${pair}:${newsFingerprint}`;
}

@Injectable()
export class SignalCacheService {
  constructor(
    @Inject(SHARED_CACHE) private readonly cache: SharedCachePort,
  ) {}

  private get enabled(): boolean {
    return process.env.SHARED_SIGNAL_CACHE_ENABLED === 'true';
  }

  getOrComputeTechnical(
    asset: string,
    pair: string,
    timeframe: string,
    compute: () => Promise<string>,
  ): Promise<string> {
    if (!this.enabled) return compute();
    return this.cache.getOrCompute(
      buildTechnicalSignalKey(asset, pair, timeframe),
      SIGNAL_TTL_TECHNICAL_MS,
      compute,
    );
  }

  getOrComputeMacro(
    asset: string,
    pair: string,
    timeframe: string,
    compute: () => Promise<string>,
  ): Promise<string> {
    if (!this.enabled) return compute();
    return this.cache.getOrCompute(
      buildMacroSignalKey(asset, pair, timeframe),
      SIGNAL_TTL_MACRO_MS,
      compute,
    );
  }

  getOrComputeNews(
    asset: string,
    pair: string,
    newsFingerprint: string,
    compute: () => Promise<string>,
  ): Promise<string> {
    if (!this.enabled) return compute();
    return this.cache.getOrCompute(
      buildNewsSignalKey(asset, pair, newsFingerprint),
      SIGNAL_TTL_NEWS_MS,
      compute,
    );
  }
}
