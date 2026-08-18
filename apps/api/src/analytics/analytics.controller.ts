import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { TradingMode } from '../../generated/prisma/enums';
import { AnalyticsService, parseAgentCostPeriod } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('portfolio')
  @ApiOperation({
    summary: 'Resumen del portfolio: P&L total, win rate, trades totales',
  })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiResponse({ status: 200, description: 'Resumen del portfolio' })
  getPortfolioSummary(
    @CurrentUser() user: RequestUser,
    @Query('mode') mode?: TradingMode,
  ) {
    return this.analyticsService.getPortfolioSummary(user.userId, mode);
  }

  @Get('trades')
  @ApiOperation({ summary: 'Historial de trades del usuario (paginado)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiResponse({ status: 200, description: 'Lista de trades' })
  getTradeHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('mode') mode?: TradingMode,
  ) {
    return this.analyticsService.getTradeHistory(
      user.userId,
      limit ? +limit : 50,
      mode,
    );
  }

  @Get('decisions')
  @ApiOperation({ summary: 'Historial de decisiones del agente IA' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiResponse({ status: 200, description: 'Lista de decisiones del agente' })
  getAgentDecisionHistory(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
    @Query('mode') mode?: TradingMode,
  ) {
    return this.analyticsService.getAgentDecisionHistory(
      user.userId,
      limit ? +limit : 20,
      mode,
    );
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Métricas avanzadas: win rate, Sharpe ratio, drawdown',
  })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiResponse({ status: 200, description: 'Resumen de métricas avanzadas' })
  getSummary(
    @CurrentUser() user: RequestUser,
    @Query('mode') mode?: TradingMode,
  ) {
    return this.analyticsService.getSummary(user.userId, mode);
  }

  @Get('pnl-chart')
  @ApiOperation({ summary: 'Datos de P&L agrupados por día (últimos 30 días)' })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiResponse({ status: 200, description: 'Array de puntos {date, pnl}' })
  getPnlChart(
    @CurrentUser() user: RequestUser,
    @Query('mode') mode?: TradingMode,
  ) {
    return this.analyticsService.getPnlChart(user.userId, mode);
  }

  @Get('asset-breakdown')
  @ApiOperation({ summary: 'P&L desglosado por asset (BTC/ETH)' })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiResponse({ status: 200, description: 'P&L por asset' })
  getAssetBreakdown(
    @CurrentUser() user: RequestUser,
    @Query('mode') mode?: TradingMode,
  ) {
    return this.analyticsService.getAssetBreakdown(user.userId, mode);
  }

  @Get('agent-costs')
  @ApiOperation({
    summary:
      'Costo LLM real del usuario por bot y por dia calendario UTC (fuente: AgentDecision.llmCostUsd)',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d'],
    description: 'Ventana de agregacion (default 30d)',
  })
  @ApiQuery({
    name: 'mode',
    required: false,
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
  })
  @ApiQuery({ name: 'configId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Desglose de costo LLM por bot' })
  @ApiResponse({ status: 400, description: 'period fuera de 7d | 30d | 90d' })
  async getAgentCosts(
    @CurrentUser() user: RequestUser,
    @Query('period') period?: string,
    @Query('mode') mode?: TradingMode,
    @Query('configId') configId?: string,
  ) {
    const breakdown = await this.analyticsService.getAgentCostBreakdown({
      userId: user.userId,
      period: parseAgentCostPeriod(period),
      mode,
      configId,
    });

    return {
      period: breakdown.period,
      from: breakdown.from,
      to: breakdown.to,
      costUsd: breakdown.costUsd,
      decisions: breakdown.decisions,
      llmDecisions: breakdown.llmDecisions,
      gateDecisions: breakdown.gateDecisions,
      unpricedDecisions: breakdown.unpricedDecisions,
      byBot: breakdown.byBot,
      dailySeries: breakdown.dailySeries,
    };
  }
}
