import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
  StopAgentDto,
  StopAgentsByModeDto,
} from './dto/trading-config.dto';
import { generateAgentName } from './trading-agent-utils';
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

  @Post('config')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear una nueva configuración de trading' })
  @ApiResponse({ status: 201, description: 'Configuración creada' })
  @ApiResponse({ status: 400, description: 'Configuración idéntica ya existe' })
  createConfig(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTradingConfigDto,
  ) {
    return this.tradingService.createConfig(user.userId, dto);
  }

  @Post('sandbox-wallet/init')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicializar wallets sandbox con capital custom' })
  @ApiResponse({ status: 200, description: 'Wallets inicializadas' })
  initSandboxWallet(
    @CurrentUser() user: RequestUser,
    @Body() body: { capitalUsdt?: number; capitalUsdc?: number },
  ) {
    return this.tradingService.initSandboxWallets(
      user.userId,
      body.capitalUsdt ?? 10_000,
      body.capitalUsdc ?? 10_000,
    );
  }

  @Delete('config/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar una configuración y detener su agente' })
  @ApiParam({ name: 'id', description: 'ID de la configuración' })
  @ApiResponse({ status: 200, description: 'Configuración eliminada' })
  @ApiResponse({ status: 404, description: 'Configuración no encontrada' })
  deleteConfig(
    @CurrentUser() user: RequestUser,
    @Param('id') configId: string,
  ) {
    return this.tradingService.deleteConfig(user.userId, configId);
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

  @Post('config/auto-name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generar nombre automático para un agente' })
  @ApiResponse({ status: 200, description: 'Nombre generado' })
  autoName(
    @Body()
    body: {
      asset: string;
      riskProfile: string;
      primaryProvider?: string;
      primaryModel?: string;
    },
  ) {
    return {
      name: generateAgentName({
        asset: body.asset,
        riskProfile: body.riskProfile ?? 'MODERATE',
        primaryProvider: body.primaryProvider,
        primaryModel: body.primaryModel,
      }),
    };
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
    summary: 'Detener el agente de trading para una configuración específica',
  })
  @ApiResponse({ status: 200, description: 'Agente detenido' })
  stopAgent(@CurrentUser() user: RequestUser, @Body() dto: StopAgentDto) {
    return this.tradingService.stopAgent(user.userId, dto.configId);
  }

  @Post('stop-by-mode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detener todos los agentes de un modo específico',
  })
  @ApiResponse({ status: 200, description: 'Agentes del modo detenidos' })
  stopAgentsByMode(
    @CurrentUser() user: RequestUser,
    @Body() dto: StopAgentsByModeDto,
  ) {
    return this.tradingService.stopAgentsByModeForUser(user.userId, dto.mode);
  }

  @Post('stop-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detener todos los agentes del usuario',
  })
  @ApiResponse({
    status: 200,
    description:
      'Todos los agentes detenidos. Las posiciones abiertas quedan sin cobertura — se emite evento WebSocket agent:all-stopped.',
  })
  stopAllAgents(@CurrentUser() user: RequestUser) {
    return this.tradingService.stopAllAgentsForUser(user.userId);
  }

  @Get('status')
  @ApiOperation({ summary: 'Estado actual de todos los agentes del usuario' })
  @ApiResponse({ status: 200, description: 'Lista de estados de agentes' })
  getAgentStatus(@CurrentUser() user: RequestUser) {
    return this.tradingService.getAgentStatus(user.userId);
  }

  // ── Positions ─────────────────────────────────────────────────────────────

  @Get('positions')
  @ApiOperation({
    summary: 'Posiciones del usuario (paginado, filtrable por status)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['OPEN', 'CLOSED'],
    description: 'Filtrar por estado. Omitir para obtener todas.',
  })
  @ApiResponse({ status: 200, description: 'Lista de posiciones' })
  getPositions(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.tradingService.getPositions(
      user.userId,
      page ? +page : 1,
      limit ? +limit : 20,
      status,
    );
  }

  // ── Trade history ─────────────────────────────────────────────────────────

  @Post('positions/:id/close')
  @HttpCode(HttpStatus.OK)
  @ApiParam({ name: 'id', description: 'Position ID' })
  @ApiOperation({ summary: 'Cerrar manualmente una posición abierta' })
  @ApiResponse({
    status: 200,
    description: 'Posición cerrada. Devuelve exitPrice y pnl.',
  })
  @ApiResponse({
    status: 400,
    description: 'Posición ya cerrada o par no soportado',
  })
  @ApiResponse({ status: 404, description: 'Posición no encontrada' })
  closePosition(
    @CurrentUser() user: RequestUser,
    @Param('id') positionId: string,
  ) {
    return this.tradingService.closePositionManually(user.userId, positionId);
  }

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

  // ── Wallet ────────────────────────────────────────────────────────────────

  @Get('wallet')
  @ApiOperation({ summary: 'Balance del sandbox wallet del usuario' })
  @ApiResponse({ status: 200, description: 'Balances por moneda estable' })
  getWallet(@CurrentUser() user: RequestUser) {
    return this.tradingService.getSandboxWallet(user.userId);
  }

  // ── Live Binance balance (LIVE / TESTNET) ─────────────────────────────────

  @Get('balance')
  @ApiOperation({
    summary:
      'Balance real de USDT y USDC desde Binance (requiere claves API del modo)',
  })
  @ApiQuery({
    name: 'mode',
    required: true,
    enum: ['LIVE', 'TESTNET'],
    description:
      'Modo de trading: LIVE (producción) o TESTNET (testnet Binance)',
  })
  @ApiResponse({
    status: 200,
    description: 'Array de { currency, balance } para USDT y USDC',
    schema: {
      example: [
        { currency: 'USDT', balance: 1000.5 },
        { currency: 'USDC', balance: 500 },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Modo inválido o sin claves configuradas',
  })
  getLiveBinanceBalance(
    @CurrentUser() user: RequestUser,
    @Query('mode') mode?: string,
  ) {
    if (mode !== 'LIVE' && mode !== 'TESTNET') {
      throw new BadRequestException(
        "El parámetro 'mode' debe ser 'LIVE' o 'TESTNET'",
      );
    }
    return this.tradingService.getLiveBinanceBalance(
      user.userId,
      mode === 'TESTNET',
    );
  }
}
