import { Module } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BinanceRestClient, BinanceWsClient } from '@crypto-trader/data-fetcher';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ReactiveCoordinationModule } from './reactive-coordination.module';
import { REACTIVE_COORDINATION } from './reactive-coordination.port';
import type { ReactiveCoordinationPort } from './reactive-coordination.port';
import { DEFAULT_REACTIVE_RUNTIME_THRESHOLDS } from './reactive-runtime-thresholds';
import {
  MARKET_STREAM_REST_CLIENT,
  MARKET_STREAM_WS_CLIENT,
  MarketStreamService,
  type MarketStreamRestClient,
  type MarketStreamWsClient,
} from './market-stream.service';

@Module({
  imports: [PrismaModule, ReactiveCoordinationModule],
  providers: [
    {
      provide: MARKET_STREAM_WS_CLIENT,
      useFactory: (): MarketStreamWsClient =>
        new BinanceWsClient({
          wsPingIntervalMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPingIntervalMs,
          wsPongTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPongTimeoutMs,
        }),
    },
    {
      provide: MARKET_STREAM_REST_CLIENT,
      useFactory: (): MarketStreamRestClient => new BinanceRestClient({}),
    },
    {
      provide: MarketStreamService,
      useFactory: (
        prisma: PrismaService,
        coordination: ReactiveCoordinationPort,
        wsClient: MarketStreamWsClient,
        restClient: MarketStreamRestClient,
      ) =>
        new MarketStreamService(
          prisma,
          coordination,
          wsClient,
          restClient,
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
          randomUUID(),
        ),
      inject: [
        PrismaService,
        REACTIVE_COORDINATION,
        MARKET_STREAM_WS_CLIENT,
        MARKET_STREAM_REST_CLIENT,
      ],
    },
  ],
  exports: [MarketStreamService],
})
export class ReactiveModule {}
