import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('portfolio')
  @ApiOperation({ summary: 'Resumen del portfolio: P&L total, win rate, trades totales' })
  @ApiResponse({ status: 200, description: 'Resumen del portfolio' })
  getPortfolioSummary(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getPortfolioSummary(user.userId);
  }

  @Get('trades')
  @ApiOperation({ summary: 'Historial de trades del usuario (paginado)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Lista de trades' })
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
  @ApiOperation({ summary: 'Historial de decisiones del agente IA' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista de decisiones del agente' })
  getAgentDecisionHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getAgentDecisionHistory(
      user.userId,
      limit ? +limit : 20,
    );
  }

  @Get('summary')
  @ApiOperation({ summary: 'Métricas avanzadas: win rate, Sharpe ratio, drawdown' })
  @ApiResponse({ status: 200, description: 'Resumen de métricas avanzadas' })
  getSummary(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getSummary(user.userId);
  }

  @Get('pnl-chart')
  @ApiOperation({ summary: 'Datos de P&L agrupados por día (últimos 30 días)' })
  @ApiResponse({ status: 200, description: 'Array de puntos {date, pnl}' })
  getPnlChart(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getPnlChart(user.userId);
  }

  @Get('asset-breakdown')
  @ApiOperation({ summary: 'P&L desglosado por asset (BTC/ETH)' })
  @ApiResponse({ status: 200, description: 'P&L por asset' })
  getAssetBreakdown(@CurrentUser() user: RequestUser) {
    return this.analyticsService.getAssetBreakdown(user.userId);
  }
}
