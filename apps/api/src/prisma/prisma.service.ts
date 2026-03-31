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
