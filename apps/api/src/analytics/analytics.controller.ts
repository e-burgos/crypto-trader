import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('portfolio')
  getPortfolioSummary(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getPortfolioSummary(user.userId);
  }

  @Get('trades')
  getTradeHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getTradeHistory(
      user.userId,
      limit ? +limit : 50,
    );
  }

  @Get('decisions')
  getAgentDecisionHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getAgentDecisionHistory(
      user.userId,
      limit ? +limit : 20,
    );
  }
}
