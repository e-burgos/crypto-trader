import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TradingController } from './trading.controller';
import { TradingService, TRADING_QUEUE } from './trading.service';
import { TradingProcessor } from './trading.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { GatewayModule } from '../gateway/gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRADING_QUEUE }),
    PrismaModule,
    GatewayModule,
    NotificationsModule,
    UsersModule,
    MarketModule,
  ],
  controllers: [TradingController],
  providers: [TradingService, TradingProcessor],
  exports: [TradingService],
})
export class TradingModule {}
