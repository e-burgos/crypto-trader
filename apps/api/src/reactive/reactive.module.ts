import { Module } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getQueueToken } from '@nestjs/bull';
import type { Queue } from 'bull';
import { BinanceRestClient, BinanceWsClient, BinanceWsApiClient } from '@crypto-trader/data-fetcher';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { GatewayModule } from '../gateway/gateway.module';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { TradingModule } from '../trading/trading.module';
import { TRADING_QUEUE } from '../trading/trading.service';
import { ActionGateService } from '../trading/action-gate.service';
import { PositionActionService } from '../trading/position-action.service';
import { EntryOrderService } from '../trading/entry-order.service';
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
import { StreamHealthController } from './stream-health.controller';
import { FastPathService } from './fast-path.service';
import { EntryFillWatchService } from './entry-fill-watch.service';
import { MaterialEventService } from './material-event.service';
import { UserDataStreamService } from './user-data-stream.service';
import {
  USER_STREAM_AUTH_CREDENTIAL,
  type UserStreamAuthCredentialPort,
} from './user-stream-auth-credential.port';
import { EnvUserStreamAuthCredentialResolver } from './env-user-stream-auth-credential.resolver';
import {
  USER_STREAM_WS_API_FACTORY,
  type UserStreamWsApiFactory,
} from './user-stream-ws-api.test-double';
import { isUserDataStreamFillsEnabled } from './user-data-stream-flag';

@Module({
  imports: [
    PrismaModule,
    ReactiveCoordinationModule,
    GatewayModule,
    NotificationsModule,
    TradingModule,
  ],
  controllers: [StreamHealthController],
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
        notifications: NotificationsService,
      ) =>
        new StreamHealthService(
          coordination,
          prisma,
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
          gateway,
          marketStream,
          notifications,
        ),
      inject: [
        REACTIVE_COORDINATION,
        PrismaService,
        AppGateway,
        MarketStreamService,
        NotificationsService,
      ],
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
    {
      provide: EntryFillWatchService,
      useFactory: (
        prisma: PrismaService,
        marketStream: MarketStreamService,
        entryOrderService: EntryOrderService,
        fastPath: FastPathService,
      ) =>
        new EntryFillWatchService(
          prisma,
          marketStream,
          entryOrderService,
          fastPath,
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
        ),
      inject: [PrismaService, MarketStreamService, EntryOrderService, FastPathService],
    },
    {
      provide: MaterialEventService,
      useFactory: (
        prisma: PrismaService,
        marketStream: MarketStreamService,
        streamHealth: StreamHealthService,
        coordination: ReactiveCoordinationPort,
        tradingQueue: Queue,
        gateway: AppGateway,
      ) =>
        new MaterialEventService(
          prisma,
          marketStream,
          streamHealth,
          coordination,
          tradingQueue,
          DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
          gateway,
        ),
      inject: [
        PrismaService,
        MarketStreamService,
        StreamHealthService,
        REACTIVE_COORDINATION,
        getQueueToken(TRADING_QUEUE),
        AppGateway,
      ],
    },
    {
      provide: USER_STREAM_AUTH_CREDENTIAL,
      useFactory: (): UserStreamAuthCredentialPort => new EnvUserStreamAuthCredentialResolver(),
    },
    {
      provide: USER_STREAM_WS_API_FACTORY,
      useFactory: (): UserStreamWsApiFactory =>
        ({ testnet }) =>
          new BinanceWsApiClient({
            testnet,
            wsPingIntervalMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPingIntervalMs,
            wsPongTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.wsPongTimeoutMs,
            reconnectBaseDelayMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectBaseDelayMs,
            reconnectMaxDelayMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectMaxDelayMs,
            reconnectAttemptsBeforeExhaustion:
              DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamReconnectAttemptsBeforeRenegotiate,
            requestTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamRequestTimeoutMs,
            connectTimeoutMs: DEFAULT_REACTIVE_RUNTIME_THRESHOLDS.userStreamConnectTimeoutMs,
          }),
    },
    {
      provide: UserDataStreamService,
      useFactory: (
        prisma: PrismaService,
        coordination: ReactiveCoordinationPort,
        entryOrders: EntryOrderService,
        fastPath: FastPathService,
        authCredentials: UserStreamAuthCredentialPort,
        wsApiFactory: UserStreamWsApiFactory,
      ): UserDataStreamService | null =>
        isUserDataStreamFillsEnabled()
          ? new UserDataStreamService(
              prisma,
              coordination,
              entryOrders,
              fastPath,
              authCredentials,
              wsApiFactory,
              DEFAULT_REACTIVE_RUNTIME_THRESHOLDS,
              randomUUID(),
            )
          : null,
      inject: [
        PrismaService,
        REACTIVE_COORDINATION,
        EntryOrderService,
        FastPathService,
        USER_STREAM_AUTH_CREDENTIAL,
        USER_STREAM_WS_API_FACTORY,
      ],
    },
  ],
  exports: [
    MarketStreamService,
    StreamHealthService,
    FastPathService,
    EntryFillWatchService,
    MaterialEventService,
  ],
})
export class ReactiveModule {}
