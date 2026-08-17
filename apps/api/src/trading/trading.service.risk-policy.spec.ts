import { TradingService } from './trading.service';

describe('TradingService — aggregate risk policy CRUD (EP-004 / EP-005)', () => {
  function buildService(prisma: any) {
    return new TradingService(
      prisma,
      { add: jest.fn() } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  describe('getRiskPolicy', () => {
    it('returns inactive defaults when the user has no policy row', async () => {
      const prisma = {
        userRiskPolicy: { findUnique: jest.fn().mockResolvedValue(null) },
      };
      const service = buildService(prisma);

      const result = await service.getRiskPolicy('user-1');

      expect(result).toEqual({
        enabled: false,
        maxAssetExposureUsd: null,
        maxAssetExposurePct: null,
        maxDailyLossUsd: null,
        maxDrawdownPct: null,
        pauseAgentsOnDrawdown: true,
        pausedAt: null,
        pausedReason: null,
      });
    });

    it('returns the stored policy when a row exists', async () => {
      const stored = {
        enabled: true,
        maxAssetExposureUsd: 500,
        maxAssetExposurePct: 0.4,
        maxDailyLossUsd: 50,
        maxDrawdownPct: 0.1,
        pauseAgentsOnDrawdown: true,
        pausedAt: null,
        pausedReason: null,
      };
      const prisma = {
        userRiskPolicy: { findUnique: jest.fn().mockResolvedValue(stored) },
      };
      const service = buildService(prisma);

      const result = await service.getRiskPolicy('user-1');

      expect(result).toEqual(stored);
    });
  });

  describe('updateRiskPolicy', () => {
    it('upserts the policy with the submitted values', async () => {
      const upsert = jest.fn().mockImplementation(({ create }) => create);
      const prisma = { userRiskPolicy: { upsert } };
      const service = buildService(prisma);

      const result = await service.updateRiskPolicy('user-1', {
        enabled: true,
        maxAssetExposureUsd: 500,
        maxAssetExposurePct: 0.4,
        maxDailyLossUsd: 50,
        maxDrawdownPct: 0.1,
        pauseAgentsOnDrawdown: true,
      });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          create: expect.objectContaining({
            userId: 'user-1',
            enabled: true,
            maxAssetExposureUsd: 500,
            maxDailyLossUsd: 50,
          }),
        }),
      );
      expect(result.enabled).toBe(true);
    });

    it('clears pausedAt/pausedReason when enabled=false', async () => {
      const upsert = jest.fn().mockImplementation(({ create }) => create);
      const prisma = { userRiskPolicy: { upsert } };
      const service = buildService(prisma);

      await service.updateRiskPolicy('user-1', { enabled: false });

      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            enabled: false,
            pausedAt: null,
            pausedReason: null,
          }),
        }),
      );
    });

    it('defaults nullable numeric limits to null and pauseAgentsOnDrawdown to true when omitted', async () => {
      const upsert = jest.fn().mockImplementation(({ create }) => create);
      const prisma = { userRiskPolicy: { upsert } };
      const service = buildService(prisma);

      const result = await service.updateRiskPolicy('user-1', { enabled: true });

      expect(result.maxAssetExposureUsd).toBeNull();
      expect(result.maxDailyLossUsd).toBeNull();
      expect(result.pauseAgentsOnDrawdown).toBe(true);
    });
  });
});
