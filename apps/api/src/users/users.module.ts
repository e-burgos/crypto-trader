import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { LlmModule } from '../llm/llm.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [LlmModule, MarketModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
