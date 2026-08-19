import { DataSourceCredentialResolver } from './data-source-credential-resolver.service';
import { NewsApiProvider } from '../../generated/prisma/enums';

jest.mock('../users/utils/encryption.util', () => ({
  decrypt: jest.fn((encrypted: string) => `decrypted:${encrypted}`),
}));

function credential(overrides: Record<string, unknown>) {
  return {
    userId: 'owner',
    apiKeyEncrypted: 'enc',
    apiKeyIv: 'iv',
    isActive: true,
    shared: false,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('DataSourceCredentialResolver', () => {
  let prisma: any;
  let resolver: DataSourceCredentialResolver;

  beforeEach(() => {
    prisma = {
      dataSourceCredential: { findMany: jest.fn().mockResolvedValue([]) },
      newsApiCredential: { findMany: jest.fn().mockResolvedValue([]) },
    };
    resolver = new DataSourceCredentialResolver(prisma);
  });

  describe('resolveForDataSources', () => {
    it('CA-005: resolves the trader own credential and reports it as user-owned', async () => {
      prisma.dataSourceCredential.findMany.mockResolvedValueOnce([
        credential({
          userId: 'trader-1',
          dataSourceId: 'ds-1',
          apiKeyEncrypted: 'own',
        }),
      ]);

      const resolved = await resolver.resolveForDataSources('trader-1', [
        'ds-1',
      ]);

      expect(resolved.get('ds-1')).toEqual({
        apiKey: 'decrypted:own',
        ownerUserId: 'trader-1',
        origin: 'user',
      });
    });

    it('scopes the own-credential query to the requesting user', async () => {
      await resolver.resolveForDataSources('trader-1', ['ds-1', 'ds-2']);

      expect(prisma.dataSourceCredential.findMany).toHaveBeenNthCalledWith(1, {
        where: {
          userId: 'trader-1',
          dataSourceId: { in: ['ds-1', 'ds-2'] },
          isActive: true,
        },
      });
    });

    it('CA-001: falls back to an admin shared credential when the trader has none', async () => {
      prisma.dataSourceCredential.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          credential({
            userId: 'admin-1',
            dataSourceId: 'ds-1',
            apiKeyEncrypted: 'shared',
            shared: true,
          }),
        ]);

      const resolved = await resolver.resolveForDataSources('trader-1', [
        'ds-1',
      ]);

      expect(resolved.get('ds-1')).toEqual({
        apiKey: 'decrypted:shared',
        ownerUserId: 'admin-1',
        origin: 'admin-shared',
      });
    });

    it('CA-004: only considers shared credentials owned by an admin', async () => {
      await resolver.resolveForDataSources('trader-1', ['ds-1']);

      expect(prisma.dataSourceCredential.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          dataSourceId: { in: ['ds-1'] },
          isActive: true,
          shared: true,
          user: { role: 'ADMIN' },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('CA-005: prefers the own credential over an available shared one', async () => {
      prisma.dataSourceCredential.findMany.mockResolvedValueOnce([
        credential({
          userId: 'trader-1',
          dataSourceId: 'ds-1',
          apiKeyEncrypted: 'own',
        }),
      ]);

      const resolved = await resolver.resolveForDataSources('trader-1', [
        'ds-1',
      ]);

      expect(resolved.get('ds-1')?.origin).toBe('user');
      expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledTimes(1);
    });

    it('CA-003: leaves unresolved sources out of the map', async () => {
      const resolved = await resolver.resolveForDataSources('trader-1', [
        'ds-1',
      ]);

      expect(resolved.has('ds-1')).toBe(false);
    });

    it('picks the oldest shared credential when several admins share the same source', async () => {
      prisma.dataSourceCredential.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          credential({
            userId: 'admin-old',
            dataSourceId: 'ds-1',
            apiKeyEncrypted: 'old',
            shared: true,
          }),
          credential({
            userId: 'admin-new',
            dataSourceId: 'ds-1',
            apiKeyEncrypted: 'new',
            shared: true,
          }),
        ]);

      const resolved = await resolver.resolveForDataSources('trader-1', [
        'ds-1',
      ]);

      expect(resolved.get('ds-1')?.ownerUserId).toBe('admin-old');
    });

    it('does not query the database when no source is requested', async () => {
      const resolved = await resolver.resolveForDataSources('trader-1', []);

      expect(resolved.size).toBe(0);
      expect(prisma.dataSourceCredential.findMany).not.toHaveBeenCalled();
    });

    it('resolves in two batched queries regardless of how many sources are requested', async () => {
      await resolver.resolveForDataSources('trader-1', [
        'ds-1',
        'ds-2',
        'ds-3',
        'ds-4',
      ]);

      expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('listSharedDataSourceIds', () => {
    it('CA-004: applies the same admin-only rule the resolution applies', async () => {
      prisma.dataSourceCredential.findMany.mockResolvedValueOnce([
        { dataSourceId: 'ds-1' },
      ]);

      const shared = await resolver.listSharedDataSourceIds();

      expect(prisma.dataSourceCredential.findMany).toHaveBeenCalledWith({
        where: { isActive: true, shared: true, user: { role: 'ADMIN' } },
        select: { dataSourceId: true },
      });
      expect(shared).toEqual(new Set(['ds-1']));
    });
  });

  describe('resolveForNewsProviders', () => {
    it('CA-002: falls back to an admin shared credential for a news provider', async () => {
      prisma.newsApiCredential.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          credential({
            userId: 'admin-1',
            provider: NewsApiProvider.FINNHUB,
            apiKeyEncrypted: 'shared',
            shared: true,
          }),
        ]);

      const resolved = await resolver.resolveForNewsProviders('trader-1', [
        NewsApiProvider.FINNHUB,
      ]);

      expect(resolved.get(NewsApiProvider.FINNHUB)).toEqual({
        apiKey: 'decrypted:shared',
        ownerUserId: 'admin-1',
        origin: 'admin-shared',
      });
    });

    it('prefers the trader own news credential', async () => {
      prisma.newsApiCredential.findMany.mockResolvedValueOnce([
        credential({
          userId: 'trader-1',
          provider: NewsApiProvider.FINNHUB,
          apiKeyEncrypted: 'own',
        }),
      ]);

      const resolved = await resolver.resolveForNewsProviders('trader-1', [
        NewsApiProvider.FINNHUB,
      ]);

      expect(resolved.get(NewsApiProvider.FINNHUB)?.origin).toBe('user');
      expect(prisma.newsApiCredential.findMany).toHaveBeenCalledTimes(1);
    });

    it('CA-004: only considers shared news credentials owned by an admin', async () => {
      await resolver.resolveForNewsProviders('trader-1', [
        NewsApiProvider.FINNHUB,
      ]);

      expect(prisma.newsApiCredential.findMany).toHaveBeenNthCalledWith(2, {
        where: {
          provider: { in: [NewsApiProvider.FINNHUB] },
          isActive: true,
          shared: true,
          user: { role: 'ADMIN' },
        },
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
