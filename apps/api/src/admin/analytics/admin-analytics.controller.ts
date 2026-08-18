import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { TradingMode } from '../../../generated/prisma/enums';
import {
  AnalyticsService,
  parseAgentCostPeriod,
} from '../../analytics/analytics.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('admin-analytics')
@ApiBearerAuth('access-token')
@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('llm-costs')
  @ApiOperation({
    summary:
      '[ADMIN] Costo LLM agregado de toda la plataforma (misma fuente y metodo que EP-009)',
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
  @ApiQuery({
    name: 'userId',
    required: false,
    type: String,
    description: 'Restringe la respuesta a un usuario; omitir para toda la plataforma',
  })
  @ApiResponse({ status: 200, description: 'Desglose de costo LLM por usuario' })
  @ApiResponse({ status: 400, description: 'period fuera de 7d | 30d | 90d' })
  @ApiResponse({ status: 403, description: 'Usuario autenticado sin rol ADMIN' })
  async getLlmCosts(
    @Query('period') period?: string,
    @Query('mode') mode?: TradingMode,
    @Query('userId') userId?: string,
  ) {
    const breakdown = await this.analyticsService.getAgentCostBreakdown({
      userId: userId ?? null,
      period: parseAgentCostPeriod(period),
      mode,
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
      byUser: breakdown.byUser,
      dailySeries: breakdown.dailySeries.map((day) => ({
        date: day.date,
        costUsd: day.costUsd,
        decisions: day.decisions,
        llmDecisions: day.llmDecisions,
        gateDecisions: day.gateDecisions,
        unpricedDecisions: day.unpricedDecisions,
      })),
    };
  }
}
