import { BadRequestException } from '@nestjs/common';

const MODE_RISK_RANK: Record<string, number> = {
  SANDBOX: 0,
  TESTNET: 1,
  LIVE: 2,
};

function riskRank(mode: string): number {
  return MODE_RISK_RANK[mode] ?? 0;
}

export function isModeWithinPlatformCeiling(
  mode: string,
  platformMode: string,
): boolean {
  return riskRank(mode) <= riskRank(platformMode);
}

export function modesAbovePlatformCeiling(platformMode: string): string[] {
  return Object.keys(MODE_RISK_RANK).filter(
    (mode) => !isModeWithinPlatformCeiling(mode, platformMode),
  );
}

export function assertModeWithinPlatformCeiling(
  mode: string,
  platformMode: string,
): void {
  if (isModeWithinPlatformCeiling(mode, platformMode)) return;
  throw new BadRequestException(
    `Bot mode ${mode} is above the platform operation mode ${platformMode}. Switch the platform to ${mode} first.`,
  );
}
