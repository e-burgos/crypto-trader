import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EvaluationService, EVALUATION_QUEUE } from './evaluation.service';
import { EvaluationProcessor } from './evaluation.processor';
import { ScorecardController } from './scorecard.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { MarketModule } from '../../market/market.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: EVALUATION_QUEUE }),
    PrismaModule,
    MarketModule,
  ],
  controllers: [ScorecardController],
  providers: [EvaluationService, EvaluationProcessor],
  exports: [EvaluationService],
})
export class EvaluationModule {}
