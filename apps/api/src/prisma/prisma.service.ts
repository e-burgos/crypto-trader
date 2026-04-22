import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _client: PrismaClientInstance;

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._client = new (PrismaClient as any)({ adapter });
  }

  get user() {
    return this._client.user;
  }
  get binanceCredential() {
    return this._client.binanceCredential;
  }
  get lLMCredential() {
    return this._client.lLMCredential;
  }
  get tradingConfig() {
    return this._client.tradingConfig;
  }
  get position() {
    return this._client.position;
  }
  get trade() {
    return this._client.trade;
  }
  get agentDecision() {
    return this._client.agentDecision;
  }
  get newsItem() {
    return this._client.newsItem;
  }
  get notification() {
    return this._client.notification;
  }
  get adminAction() {
    return this._client.adminAction;
  }
  get newsApiCredential() {
    return this._client.newsApiCredential;
  }
  get sandboxWallet() {
    return this._client.sandboxWallet;
  }
  get chatSession() {
    return this._client.chatSession;
  }
  get chatMessage() {
    return this._client.chatMessage;
  }
  get newsConfig() {
    return this._client.newsConfig;
  }
  get newsAnalysis() {
    return this._client.newsAnalysis;
  }
  get agentDefinition() {
    return this._client.agentDefinition;
  }
  get agentDocument() {
    return this._client.agentDocument;
  }
  get agentDocumentChunk() {
    return this._client.agentDocumentChunk;
  }
  get llmUsageLog() {
    return this._client.llmUsageLog;
  }
  get agentConfig() {
    return this._client.agentConfig;
  }
  get adminAgentConfig() {
    return this._client.adminAgentConfig;
  }
  get platformLLMProvider() {
    return this._client.platformLLMProvider;
  }

  $queryRaw<T = unknown>(
    ...args: Parameters<PrismaClientInstance['$queryRaw']>
  ): Promise<T> {
    return (this._client.$queryRaw as (...a: unknown[]) => Promise<T>)(...args);
  }

  $transaction(...args: Parameters<PrismaClientInstance['$transaction']>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this._client.$transaction as any)(...args);
  }

  async onModuleInit() {
    await this._client.$connect();
  }

  async onModuleDestroy() {
    await this._client.$disconnect();
  }
}
