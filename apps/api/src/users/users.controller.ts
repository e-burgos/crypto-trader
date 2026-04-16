import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Patch,
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
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  BinanceKeyDto,
  SetTestnetBinanceKeysDto,
  LLMKeyDto,
  LLMModelDto,
  NewsApiKeyDto,
  UpdateUserStatusDto,
  UpdateOperationModeDto,
} from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';
import { LLMModelsService } from '../llm/llm-models.service';
import { LLMUsageService } from '../llm/llm-usage.service';
import { ProviderHealthService } from '../llm/provider-health.service';
import { LLMProvider } from '../../generated/prisma/enums';
import { suggestModels } from '../llm/model-ranking';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly llmModelsService: LLMModelsService,
    private readonly llmUsageService: LLMUsageService,
    private readonly providerHealthService: ProviderHealthService,
    private readonly prisma: PrismaService,
  ) {}

  // ── /users/me ────────────────────────────────────────────────────────────

  @Get('users/me')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Datos del perfil' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.userId);
  }

  @Put('users/me')
  @ApiOperation({ summary: 'Actualizar email o contraseña' })
  @ApiResponse({ status: 200, description: 'Perfil actualizado' })
  @ApiResponse({ status: 409, description: 'Email ya en uso' })
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.userId, dto);
  }

  // ── /users/me/operation-mode ──────────────────────────────────────────────

  @Patch('users/me/operation-mode')
  @ApiOperation({
    summary:
      'Actualizar el modo de operación global de la plataforma (SANDBOX / TESTNET / LIVE)',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { platformOperationMode: 'SANDBOX' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Claves API no configuradas para el modo solicitado',
  })
  updateOperationMode(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateOperationModeDto,
  ) {
    return this.usersService.updateOperationMode(user.userId, dto);
  }

  // ── /users/me/binance-keys ────────────────────────────────────────────────

  @Post('users/me/binance-keys')
  @ApiOperation({
    summary: 'Guardar credenciales de Binance (encriptadas AES-256-GCM)',
  })
  @ApiResponse({ status: 201, description: 'Credenciales guardadas' })
  setBinanceKeys(@CurrentUser() user: RequestUser, @Body() dto: BinanceKeyDto) {
    return this.usersService.setBinanceKeys(user.userId, dto);
  }

  @Delete('users/me/binance-keys')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar credenciales de Binance' })
  @ApiResponse({ status: 204, description: 'Credenciales eliminadas' })
  deleteBinanceKeys(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteBinanceKeys(user.userId);
  }

  @Get('users/me/binance-keys/status')
  @ApiOperation({
    summary: 'Verificar si hay credenciales de Binance configuradas',
  })
  @ApiResponse({ status: 200, schema: { example: { connected: true } } })
  getBinanceKeyStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getBinanceKeyStatus(user.userId);
  }

  @Get('users/me/binance-keys/test')
  @ApiOperation({
    summary: 'Probar conexión con Binance usando las claves guardadas',
  })
  @ApiResponse({ status: 200, schema: { example: { connected: true } } })
  testBinanceConnection(@CurrentUser() user: RequestUser) {
    return this.usersService.testBinanceConnection(user.userId);
  }

  // ── /users/me/binance-keys/testnet ─────────────────────────────────────

  @Post('users/me/binance-keys/testnet')
  @ApiOperation({
    summary:
      'Guardar credenciales de Binance Testnet (encriptadas AES-256-GCM)',
  })
  @ApiResponse({ status: 201, description: 'Credenciales testnet guardadas' })
  setTestnetBinanceKeys(
    @CurrentUser() user: RequestUser,
    @Body() dto: SetTestnetBinanceKeysDto,
  ) {
    return this.usersService.setTestnetBinanceKeys(user.userId, dto);
  }

  @Delete('users/me/binance-keys/testnet')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar credenciales de Binance Testnet' })
  @ApiResponse({ status: 204, description: 'Credenciales testnet eliminadas' })
  deleteTestnetBinanceKeys(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteTestnetBinanceKeys(user.userId);
  }

  @Get('users/me/binance-keys/testnet/status')
  @ApiOperation({
    summary: 'Verificar si hay credenciales de Binance Testnet configuradas',
  })
  @ApiResponse({
    status: 200,
    schema: { example: { hasKeys: true, isActive: true } },
  })
  getTestnetBinanceKeyStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getTestnetBinanceKeyStatus(user.userId);
  }

  @Get('users/me/binance-keys/testnet/test')
  @ApiOperation({
    summary: 'Probar conexión con Binance Testnet usando las claves guardadas',
  })
  @ApiResponse({ status: 200, schema: { example: { connected: true } } })
  testTestnetBinanceConnection(@CurrentUser() user: RequestUser) {
    return this.usersService.testTestnetBinanceConnection(user.userId);
  }

  // ── /users/me/llm-keys ────────────────────────────────────────────────────

  @Post('users/me/llm-keys')
  @ApiOperation({
    summary: 'Guardar clave de proveedor LLM (Claude / OpenAI / Groq)',
  })
  @ApiResponse({ status: 201, description: 'Clave LLM guardada' })
  setLLMKey(@CurrentUser() user: RequestUser, @Body() dto: LLMKeyDto) {
    return this.usersService.setLLMKey(user.userId, dto);
  }

  @Patch('users/me/llm-keys/model')
  @ApiOperation({
    summary: 'Actualizar modelo seleccionado de un proveedor LLM',
  })
  @ApiResponse({ status: 200, description: 'Modelo actualizado' })
  updateLLMModel(@CurrentUser() user: RequestUser, @Body() dto: LLMModelDto) {
    return this.usersService.updateLLMModel(
      user.userId,
      dto.provider,
      dto.selectedModel ?? null,
    );
  }

  @Delete('users/me/llm-keys/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar clave de un proveedor LLM' })
  @ApiParam({ name: 'provider', enum: ['CLAUDE', 'OPENAI', 'GROQ'] })
  @ApiResponse({ status: 204, description: 'Clave LLM eliminada' })
  deleteLLMKey(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ) {
    return this.usersService.deleteLLMKey(user.userId, provider);
  }

  @Get('users/me/llm-keys/status')
  @ApiOperation({ summary: 'Estado de cada proveedor LLM configurado' })
  getLLMKeyStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getLLMKeyStatus(user.userId);
  }

  @Get('users/me/llm-keys/validate-all')
  @ApiOperation({ summary: 'Validar todas las LLM API keys del usuario' })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        results: [
          { provider: 'OPENAI', status: 'ACTIVE' },
          { provider: 'GROQ', status: 'INVALID', error: 'Unauthorized' },
        ],
        active: 1,
        total: 2,
      },
    },
  })
  validateAllLLMKeys(@CurrentUser() user: RequestUser) {
    return this.usersService.validateAllLLMKeys(user.userId);
  }

  @Get('users/me/llm-keys/:provider/test')
  @ApiOperation({ summary: 'Probar conexión con un proveedor LLM' })
  @ApiParam({ name: 'provider', enum: ['CLAUDE', 'OPENAI', 'GROQ'] })
  @ApiResponse({ status: 200, schema: { example: { connected: true } } })
  testLLMKey(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ) {
    return this.usersService.testLLMKey(user.userId, provider);
  }

  // ── /users/me/news-api-keys ───────────────────────────────────────────────

  @Post('users/me/news-api-keys')
  @ApiOperation({
    summary:
      'Guardar API key de proveedor de noticias (encriptada AES-256-GCM)',
  })
  @ApiResponse({ status: 201, description: 'Clave guardada' })
  setNewsApiKey(@CurrentUser() user: RequestUser, @Body() dto: NewsApiKeyDto) {
    return this.usersService.setNewsApiKey(user.userId, dto);
  }

  @Delete('users/me/news-api-keys/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar API key de un proveedor de noticias' })
  @ApiParam({ name: 'provider', enum: ['CRYPTOPANIC'] })
  @ApiResponse({ status: 204 })
  deleteNewsApiKey(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ) {
    return this.usersService.deleteNewsApiKey(user.userId, provider);
  }

  @Get('users/me/news-api-keys/status')
  @ApiOperation({
    summary: 'Estado de los proveedores de noticias configurados',
  })
  @ApiResponse({ status: 200 })
  getNewsApiKeyStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getNewsApiKeyStatus(user.userId);
  }

  @Get('users/me/news-api-keys/:provider/test')
  @ApiOperation({ summary: 'Probar conexión con un proveedor de noticias' })
  @ApiParam({ name: 'provider', enum: ['CRYPTOPANIC'] })
  @ApiResponse({ status: 200, schema: { example: { connected: true } } })
  testNewsApiKey(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ) {
    return this.usersService.testNewsApiKey(user.userId, provider);
  }

  // ── /users/me/llm ─────────────────────────────────────────────────────────

  @Get('users/me/llm/:provider/models')
  @ApiOperation({ summary: 'Listar modelos disponibles de un proveedor LLM' })
  @ApiParam({
    name: 'provider',
    enum: ['CLAUDE', 'OPENAI', 'GROQ', 'GEMINI', 'MISTRAL', 'TOGETHER'],
  })
  @ApiResponse({ status: 200, description: 'Modelos del proveedor' })
  @ApiResponse({ status: 404, description: 'Sin API key para este proveedor' })
  @ApiResponse({ status: 502, description: 'Proveedor no responde' })
  getProviderModels(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ) {
    return this.llmModelsService.getModels(
      user.userId,
      provider as LLMProvider,
    );
  }

  @Get('users/me/llm/usage')
  @ApiOperation({ summary: 'Estadísticas de uso de LLM del usuario' })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d', 'all'],
  })
  @ApiResponse({ status: 200, description: 'Estadísticas de uso' })
  getLLMUsage(
    @CurrentUser() user: RequestUser,
    @Query('period') period?: string,
  ) {
    const validPeriods = ['7d', '30d', '90d', 'all'] as const;
    const p = validPeriods.includes(period as any)
      ? (period as '7d' | '30d' | '90d' | 'all')
      : '30d';
    return this.llmUsageService.getStats(user.userId, p);
  }

  @Get('users/me/llm/suggested')
  @ApiOperation({ summary: 'Sugerir mejores modelos según providers activos' })
  @ApiQuery({
    name: 'useCase',
    required: false,
    enum: ['TRADING', 'NEWS', 'CHAT', 'CLASSIFY'],
  })
  @ApiResponse({ status: 200, description: 'Top 3 sugerencias de modelos' })
  async getLLMSuggested(
    @CurrentUser() user: RequestUser,
    @Query('useCase') useCase?: string,
  ) {
    const validUseCases = ['TRADING', 'NEWS', 'CHAT', 'CLASSIFY'] as const;
    const uc = validUseCases.includes(useCase as any)
      ? (useCase as 'TRADING' | 'NEWS' | 'CHAT' | 'CLASSIFY')
      : 'TRADING';

    const activeKeys = await this.prisma.lLMCredential.findMany({
      where: { userId: user.userId, isActive: true },
      select: { provider: true },
    });
    const activeProviders = [
      ...new Set(activeKeys.map((k) => k.provider as LLMProvider)),
    ];

    return suggestModels(activeProviders, uc);
  }

  @Get('users/me/llm/providers/status')
  @ApiOperation({
    summary: 'Get availability status of all configured LLM providers',
  })
  @ApiResponse({
    status: 200,
    description:
      'Array of ProviderStatus with availability, usage, rate limits',
  })
  getProvidersStatus(@CurrentUser() user: RequestUser) {
    return this.providerHealthService.getAllProvidersStatus(user.userId);
  }

  @Get('users/me/llm/providers/:provider/usage')
  @ApiOperation({
    summary: 'Get detailed usage for a specific LLM provider',
  })
  @ApiParam({
    name: 'provider',
    enum: ['CLAUDE', 'OPENAI', 'GROQ', 'GEMINI', 'MISTRAL', 'TOGETHER'],
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['7d', '30d', '90d'],
  })
  @ApiResponse({ status: 200, description: 'Provider usage detail' })
  getProviderUsage(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Query('period') period?: string,
  ) {
    const validPeriods = ['7d', '30d', '90d'] as const;
    const p = validPeriods.includes(period as any)
      ? (period as '7d' | '30d' | '90d')
      : '30d';
    return this.providerHealthService.getProviderUsage(
      user.userId,
      provider as LLMProvider,
      p,
    );
  }

  // ── /admin/users ──────────────────────────────────────────────────────────

  @Get('admin/users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiTags('admin')
  @ApiOperation({ summary: '[ADMIN] Listar todos los usuarios con su estado' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  getAllUsers(@CurrentUser() user: RequestUser) {
    return this.usersService.getAllUsers(user.userId);
  }

  @Patch('admin/users/:id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiTags('admin')
  @ApiOperation({
    summary: '[ADMIN] Activar o desactivar una cuenta de usuario',
  })
  @ApiParam({ name: 'id', description: 'ID del usuario' })
  @ApiResponse({ status: 200, description: 'Estado actualizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  setUserStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setUserStatus(
      user.userId,
      targetUserId,
      dto.isActive,
    );
  }
}
