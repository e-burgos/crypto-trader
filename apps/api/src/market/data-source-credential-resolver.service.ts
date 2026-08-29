import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { decrypt } from '../users/utils/encryption.util';
import { NewsApiProvider } from '../../generated/prisma/enums';

export const SHARED_PUBLIC_OWNER = '__public__';

export type CredentialOrigin = 'user' | 'admin-shared';

export interface ResolvedCredential {
  apiKey: string;
  ownerUserId: string;
  origin: CredentialOrigin;
}

@Injectable()
export class DataSourceCredentialResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForDataSources(
    userId: string,
    dataSourceIds: string[],
  ): Promise<Map<string, ResolvedCredential>> {
    const resolved = new Map<string, ResolvedCredential>();
    if (dataSourceIds.length === 0) return resolved;

    const ownCredentials = await this.prisma.dataSourceCredential.findMany({
      where: {
        userId,
        dataSourceId: { in: dataSourceIds },
        isActive: true,
      },
    });
    for (const credential of ownCredentials) {
      resolved.set(credential.dataSourceId, toResolved(credential, 'user'));
    }

    const unresolvedIds = dataSourceIds.filter((id) => !resolved.has(id));
    if (unresolvedIds.length === 0) return resolved;

    const sharedCredentials = await this.prisma.dataSourceCredential.findMany({
      where: {
        dataSourceId: { in: unresolvedIds },
        isActive: true,
        shared: true,
        user: { role: 'ADMIN' },
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const credential of sharedCredentials) {
      if (resolved.has(credential.dataSourceId)) continue;
      resolved.set(
        credential.dataSourceId,
        toResolved(credential, 'admin-shared'),
      );
    }

    return resolved;
  }

  async listSharedDataSourceIds(): Promise<Set<string>> {
    const shared = await this.prisma.dataSourceCredential.findMany({
      where: { isActive: true, shared: true, user: { role: 'ADMIN' } },
      select: { dataSourceId: true },
    });
    return new Set(shared.map((credential) => credential.dataSourceId));
  }

  async resolveForNewsProviders(
    userId: string,
    providers: NewsApiProvider[],
  ): Promise<Map<NewsApiProvider, ResolvedCredential>> {
    const resolved = new Map<NewsApiProvider, ResolvedCredential>();
    if (providers.length === 0) return resolved;

    const ownCredentials = await this.prisma.newsApiCredential.findMany({
      where: {
        userId,
        provider: { in: providers },
        isActive: true,
      },
    });
    for (const credential of ownCredentials) {
      resolved.set(credential.provider, toResolved(credential, 'user'));
    }

    const unresolvedProviders = providers.filter((p) => !resolved.has(p));
    if (unresolvedProviders.length === 0) return resolved;

    const sharedCredentials = await this.prisma.newsApiCredential.findMany({
      where: {
        provider: { in: unresolvedProviders },
        isActive: true,
        shared: true,
        user: { role: 'ADMIN' },
      },
      orderBy: { createdAt: 'asc' },
    });
    for (const credential of sharedCredentials) {
      if (resolved.has(credential.provider)) continue;
      resolved.set(credential.provider, toResolved(credential, 'admin-shared'));
    }

    return resolved;
  }
}

function toResolved(
  credential: {
    userId: string;
    apiKeyEncrypted: string;
    apiKeyIv: string;
  },
  origin: CredentialOrigin,
): ResolvedCredential {
  return {
    apiKey: decrypt(credential.apiKeyEncrypted, credential.apiKeyIv),
    ownerUserId: credential.userId,
    origin,
  };
}
