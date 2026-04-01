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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
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

@ApiTags('trading')
@ApiBearerAuth('access-token')
@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  // ── Config ────────────────────────────────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuraciones de trading del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de configuraciones' })
  getConfigs(@CurrentUser() user: RequestUser) {
    return this.tradingService.getConfigs(user.userId);
  }

  @Put('config')
  @ApiOperation({
    summary:
      'Crear o actualizar configuración de trading (upsert por asset+pair)',
  })
  @ApiResponse({ status: 200, description: 'Configuración guardada' })
  upsertConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTradingConfigDto,
  ) {
    return this.tradingService.upsertConfig(user.userId, dto);
  }

  @Put('config/:id')
  @ApiOperation({ summary: 'Actualizar una configuración existente por ID' })
  @ApiParam({ name: 'id', description: 'ID de la configuración' })
  @ApiResponse({ status: 200, description: 'Configuración actualizada' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
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
  @ApiOperation({
    summary: 'Arrancar el agente de trading para un par específico',
  })
  @ApiResponse({ status: 200, description: 'Agente iniciado. Devuelve jobId.' })
  @ApiResponse({
    status: 404,
    description: 'Configuración no encontrada para el par indicado',
  })
  startAgent(@CurrentUser() user: RequestUser, @Body() dto: StartAgentDto) {
    return this.tradingService.startAgent(user.userId, dto);
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detener el agente de trading para un par específico',
  })
  @ApiResponse({ status: 200, description: 'Agente detenido' })
  stopAgent(
    @CurrentUser() user: RequestUser,
    @Body() body: { asset: string; pair: string },
  ) {
    return this.tradingService.stopAgent(user.userId, body.asset, body.pair);
  }

  @Get('status')
  @ApiOperation({ summary: 'Estado actual de todos los agentes del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de estados de agentes' })
  getAgentStatus(@CurrentUser() user: RequestUser) {
    return this.tradingService.getAgentStatus(user.userId);
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  @Get('positions')
  @ApiOperation({ summary: 'Posiciones abiertas del usuario (paginado)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista de posiciones abiertas' })
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
  @ApiOperation({
    summary: 'Historial de trades cerrados (paginado, filtrable)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'asset', required: false, type: String, example: 'BTC' })
  @ApiQuery({ name: 'mode', required: false, enum: ['LIVE', 'SANDBOX'] })
  @ApiResponse({ status: 200, description: 'Historial de trades' })
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
  @ApiOperation({ summary: 'Log de decisiones del agente IA (paginado)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Lista de decisiones del agente' })
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
