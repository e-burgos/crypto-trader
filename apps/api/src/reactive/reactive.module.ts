import { Module } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { BinanceRestClient, BinanceWsClient } from '@crypto-trader/data-fetcher';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayModule } from '../gateway/gateway.module';
import { AppGateway } from '../gateway/app.gateway';
import { TradingModule } from '../trading/trading.module';
import { ActionGateService } from '../trading/action-gate.service';
import { PositionActionService } from '../trading/position-action.service';
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
import { StreamHealthService } from './stream-health.service';
import { FastPathService } from './fast-path.service';

@Module({
  imports: [PrismaModule, ReactiveCoordinationModule, GatewayModule, TradingModule],
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
    {
      provide: StreamHealthService,
      useFactory: (
        coordination: ReactiveCoordinationPort,
        prisma: PrismaService,
        gateway: AppGateway,
        marketStream: MarketStreamService,
      ) =>
        new StreamHealthService(
          coordination,
          prisma,
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
          gateway,
          marketStream,
        ),
      inject: [REACTIVE_COORDINATION, PrismaService, AppGateway, MarketStreamService],
    },
    {
      provide: FastPathService,
      useFactory: (
        prisma: PrismaService,
        marketStream: MarketStreamService,
        actionGate: ActionGateService,
        positionAction: PositionActionService,
      ) =>
        new FastPathService(
          prisma,
          marketStream,
          actionGate,
          positionAction,
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        ),
      inject: [PrismaService, MarketStreamService, ActionGateService, PositionActionService],
    },
  ],
  exports: [MarketStreamService, StreamHealthService, FastPathService],
})
export class ReactiveModule {}
