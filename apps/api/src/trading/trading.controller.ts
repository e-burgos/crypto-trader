import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TradingService } from './trading.service';
import {
  CreateTradingConfigDto,
  UpdateTradingConfigDto,
  StartAgentDto,
} from './dto/trading-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  // ── Config ────────────────────────────────────────────────────────────────

  @Get('config')
  getConfigs(@CurrentUser() user: RequestUser) {
    return this.tradingService.getConfigs(user.userId);
  }

  @Put('config')
  upsertConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTradingConfigDto,
  ) {
    return this.tradingService.upsertConfig(user.userId, dto);
  }

  @Put('config/:id')
  updateConfig(
    @CurrentUser() user: RequestUser,
    @Param('id') configId: string,
    @Body() dto: UpdateTradingConfigDto,
  ) {
    return this.tradingService.updateConfig(user.userId, configId, dto);
  }

  // ── Agent lifecycle ───────────────────────────────────────────────────────

  @Post('start')
  @HttpCode(HttpStatus.OK)
  startAgent(@CurrentUser() user: RequestUser, @Body() dto: StartAgentDto) {
    return this.tradingService.startAgent(user.userId, dto);
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  stopAgent(
    @CurrentUser() user: RequestUser,
    @Body() body: { asset: string; pair: string },
  ) {
    return this.tradingService.stopAgent(user.userId, body.asset, body.pair);
  }

  @Get('status')
  getAgentStatus(@CurrentUser() user: RequestUser) {
    return this.tradingService.getAgentStatus(user.userId);
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  @Get('positions')
  getOpenPositions(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tradingService.getOpenPositions(
      user.userId,
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }

  // ── Trade history ─────────────────────────────────────────────────────────

  @Get('history')
  getTradeHistory(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('asset') asset?: string,
    @Query('mode') mode?: string,
  ) {
    return this.tradingService.getTradeHistory(
      user.userId,
      page ? +page : 1,
      limit ? +limit : 20,
      asset,
      mode,
    );
  }

  // ── Decisions ─────────────────────────────────────────────────────────────

  @Get('decisions')
  getDecisions(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tradingService.getDecisions(
      user.userId,
      page ? +page : 1,
      limit ? +limit : 20,
    );
  }
}
