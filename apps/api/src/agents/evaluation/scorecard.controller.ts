import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { EvaluationService, ScorecardFilters } from './evaluation.service';

@Controller('agents/scorecard')
@UseGuards(JwtAuthGuard)
export class ScorecardController {
  constructor(private readonly evaluationService: EvaluationService) {}

  @Get()
  getScorecard(
    @Query('agentId') agentId?: string,
    @Query('model') model?: string,
    @Query('provider') provider?: string,
    @Query('symbol') symbol?: string,
    @Query('mode') mode?: string,
    @Query('riskProfile') riskProfile?: string,
    @Query('marketRegime') marketRegime?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: ScorecardFilters = {
      agentId,
      model,
      provider,
      symbol,
      mode,
      riskProfile,
      marketRegime,
      from,
      to,
    };
    return this.evaluationService.getScorecard(filters);
  }

  @Get('summary')
  getSummary(
    @Query('agentId') agentId?: string,
    @Query('model') model?: string,
    @Query('provider') provider?: string,
    @Query('symbol') symbol?: string,
    @Query('mode') mode?: string,
    @Query('riskProfile') riskProfile?: string,
    @Query('marketRegime') marketRegime?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: ScorecardFilters = {
      agentId,
      model,
      provider,
      symbol,
      mode,
      riskProfile,
      marketRegime,
      from,
      to,
    };
    return this.evaluationService.getSummary(filters);
  }
}
