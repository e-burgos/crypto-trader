import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AssetEnum {
  BTC = 'BTC',
  ETH = 'ETH',
}

export enum QuoteCurrencyEnum {
  USDT = 'USDT',
  USDC = 'USDC',
}

export enum TradingModeEnum {
  LIVE = 'LIVE',
  SANDBOX = 'SANDBOX',
  TESTNET = 'TESTNET',
}

export enum IntervalModeEnum {
  AGENT = 'AGENT',
  CUSTOM = 'CUSTOM',
}

export enum RiskProfileEnum {
  CONSERVATIVE = 'CONSERVATIVE',
  MODERATE = 'MODERATE',
  AGGRESSIVE = 'AGGRESSIVE',
}

export enum LLMProviderEnum {
  CLAUDE = 'CLAUDE',
  OPENAI = 'OPENAI',
  GROQ = 'GROQ',
  GEMINI = 'GEMINI',
  MISTRAL = 'MISTRAL',
  TOGETHER = 'TOGETHER',
  OPENROUTER = 'OPENROUTER',
}

export class CreateTradingConfigDto {
  @ApiPropertyOptional({
    example: 'BTC Agresivo',
    description: 'Nombre descriptivo del agente',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: AssetEnum, example: AssetEnum.BTC })
  @IsEnum(AssetEnum)
  asset!: AssetEnum;

  @ApiProperty({ enum: QuoteCurrencyEnum, example: QuoteCurrencyEnum.USDT })
  @IsEnum(QuoteCurrencyEnum)
  pair!: QuoteCurrencyEnum;

  @ApiProperty({ enum: TradingModeEnum, example: TradingModeEnum.SANDBOX })
  @IsEnum(TradingModeEnum)
  mode!: TradingModeEnum;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 70,
    description: 'Confianza mínima para ejecutar BUY',
  })
  @IsNumber({}, { message: 'Umbral de compra debe ser un número válido' })
  @Min(0, { message: 'Umbral de compra debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de compra no debe superar $constraint1' })
  @IsOptional()
  buyThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 70,
    description: 'Confianza mínima para ejecutar SELL',
  })
  @IsNumber({}, { message: 'Umbral de venta debe ser un número válido' })
  @Min(0, { message: 'Umbral de venta debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de venta no debe superar $constraint1' })
  @IsOptional()
  sellThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 0.5,
    example: 0.03,
    description: 'Stop-loss como fracción del precio de entrada',
  })
  @IsNumber({}, { message: 'Stop-loss debe ser un número válido' })
  @Min(0.001, { message: 'Stop-loss debe ser al menos $constraint1 (0.1%)' })
  @Max(0.5, { message: 'Stop-loss no puede superar $constraint1 (50%)' })
  @IsOptional()
  stopLossPct?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.05,
    description: 'Take-profit como fracción del precio de entrada',
  })
  @IsNumber({}, { message: 'Take-profit debe ser un número válido' })
  @Min(0.001, { message: 'Take-profit debe ser al menos $constraint1 (0.1%)' })
  @Max(1, { message: 'Take-profit no puede superar $constraint1 (100%)' })
  @IsOptional()
  takeProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.5,
    example: 0.003,
    description:
      'Ganancia mínima requerida para ejecutar SELL por decisión LLM (0.003 = 0.3%)',
  })
  @IsNumber({}, { message: 'Ganancia mínima debe ser un número válido' })
  @Min(0, { message: 'Ganancia mínima debe ser mayor o igual a $constraint1' })
  @Max(0.5, { message: 'Ganancia mínima no puede superar $constraint1 (50%)' })
  @IsOptional()
  minProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0.01,
    maximum: 1,
    example: 0.1,
    description: 'Fracción máxima del balance a usar por trade',
  })
  @IsNumber(
    {},
    { message: 'Porcentaje máximo por trade debe ser un número válido' },
  )
  @Min(0.01, {
    message: 'Porcentaje máximo por trade debe ser al menos $constraint1',
  })
  @Max(1, {
    message: 'Porcentaje máximo por trade no puede superar $constraint1 (100%)',
  })
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10,
    example: 3,
    description: 'Máximo de posiciones abiertas simultáneas',
  })
  @IsNumber(
    {},
    { message: 'Máximo de posiciones concurrentes debe ser un número válido' },
  )
  @Min(1, {
    message: 'Máximo de posiciones concurrentes debe ser al menos $constraint1',
  })
  @Max(10, {
    message: 'Máximo de posiciones concurrentes no puede superar $constraint1',
  })
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1440,
    example: 60,
    description: 'Intervalo mínimo entre ciclos en minutos',
  })
  @IsNumber({}, { message: 'Intervalo mínimo debe ser un número válido' })
  @Min(1, { message: 'Intervalo mínimo debe ser al menos $constraint1 minuto' })
  @Max(1440, {
    message: 'Intervalo mínimo no puede superar $constraint1 minutos (24hs)',
  })
  @IsOptional()
  minIntervalMinutes?: number;

  @ApiPropertyOptional({
    minimum: -0.05,
    maximum: 0.05,
    example: 0,
    description:
      'Offset de precio relativo al mercado para la ejecución de órdenes. ' +
      'Negativo = intenta comprar por debajo del precio de mercado (simulación). ' +
      'Positivo = ejecuta por encima del precio de mercado.',
  })
  @IsNumber({}, { message: 'Offset de precio debe ser un número válido' })
  @Min(-0.05, { message: 'Offset de precio no puede ser menor a -5%' })
  @Max(0.05, { message: 'Offset de precio no puede superar +5%' })
  @IsOptional()
  orderPriceOffsetPct?: number;

  @ApiPropertyOptional({
    enum: IntervalModeEnum,
    example: IntervalModeEnum.AGENT,
    description:
      'AGENT = respeta la sugerencia del LLM; CUSTOM = usa minIntervalMinutes fijo',
  })
  @IsEnum(IntervalModeEnum)
  @IsOptional()
  intervalMode?: IntervalModeEnum;

  @ApiPropertyOptional({
    enum: LLMProviderEnum,
    description: 'Primary LLM provider for this agent',
  })
  @IsEnum(LLMProviderEnum)
  @IsOptional()
  primaryProvider?: LLMProviderEnum;

  @ApiPropertyOptional({ description: 'Primary LLM model ID' })
  @IsString()
  @IsOptional()
  primaryModel?: string;

  @ApiPropertyOptional({
    enum: LLMProviderEnum,
    description: 'Fallback LLM provider',
  })
  @IsEnum(LLMProviderEnum)
  @IsOptional()
  fallbackProvider?: LLMProviderEnum;

  @ApiPropertyOptional({ description: 'Fallback LLM model ID' })
  @IsString()
  @IsOptional()
  fallbackModel?: string;

  @ApiPropertyOptional({
    enum: RiskProfileEnum,
    example: RiskProfileEnum.MODERATE,
    description: 'Risk profile for model selection and prompts',
  })
  @IsEnum(RiskProfileEnum)
  @IsOptional()
  riskProfile?: RiskProfileEnum;
}

export class UpdateTradingConfigDto {
  @ApiPropertyOptional({
    example: 'BTC Agresivo',
    description: 'Nombre descriptivo del agente',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: TradingModeEnum })
  @IsEnum(TradingModeEnum)
  @IsOptional()
  mode?: TradingModeEnum;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsNumber({}, { message: 'Umbral de compra debe ser un número válido' })
  @Min(0, { message: 'Umbral de compra debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de compra no debe superar $constraint1' })
  @IsOptional()
  buyThreshold?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsNumber({}, { message: 'Umbral de venta debe ser un número válido' })
  @Min(0, { message: 'Umbral de venta debe ser mayor o igual a $constraint1' })
  @Max(100, { message: 'Umbral de venta no debe superar $constraint1' })
  @IsOptional()
  sellThreshold?: number;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 0.5, example: 0.03 })
  @IsNumber({}, { message: 'Stop-loss debe ser un número válido' })
  @Min(0.001, { message: 'Stop-loss debe ser al menos $constraint1 (0.1%)' })
  @Max(0.5, { message: 'Stop-loss no puede superar $constraint1 (50%)' })
  @IsOptional()
  stopLossPct?: number;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 1, example: 0.05 })
  @IsNumber({}, { message: 'Take-profit debe ser un número válido' })
  @Min(0.001, { message: 'Take-profit debe ser al menos $constraint1 (0.1%)' })
  @Max(1, { message: 'Take-profit no puede superar $constraint1 (100%)' })
  @IsOptional()
  takeProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 0.5,
    example: 0.003,
    description:
      'Ganancia mínima requerida para ejecutar SELL por decisión LLM (0.003 = 0.3%)',
  })
  @IsNumber({}, { message: 'Ganancia mínima debe ser un número válido' })
  @Min(0, { message: 'Ganancia mínima debe ser mayor o igual a $constraint1' })
  @Max(0.5, { message: 'Ganancia mínima no puede superar $constraint1 (50%)' })
  @IsOptional()
  minProfitPct?: number;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 1, example: 0.1 })
  @IsNumber(
    {},
    { message: 'Porcentaje máximo por trade debe ser un número válido' },
  )
  @Min(0.01, {
    message: 'Porcentaje máximo por trade debe ser al menos $constraint1',
  })
  @Max(1, {
    message: 'Porcentaje máximo por trade no puede superar $constraint1 (100%)',
  })
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 3 })
  @IsNumber(
    {},
    { message: 'Máximo de posiciones concurrentes debe ser un número válido' },
  )
  @Min(1, {
    message: 'Máximo de posiciones concurrentes debe ser al menos $constraint1',
  })
  @Max(10, {
    message: 'Máximo de posiciones concurrentes no puede superar $constraint1',
  })
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 60 })
  @IsNumber({}, { message: 'Intervalo mínimo debe ser un número válido' })
  @Min(1, { message: 'Intervalo mínimo debe ser al menos $constraint1 minuto' })
  @Max(1440, {
    message: 'Intervalo mínimo no puede superar $constraint1 minutos (24hs)',
  })
  @IsOptional()
  minIntervalMinutes?: number;

  @ApiPropertyOptional({ minimum: -0.05, maximum: 0.05, example: 0 })
  @IsNumber({}, { message: 'Offset de precio debe ser un número válido' })
  @Min(-0.05, { message: 'Offset de precio no puede ser menor a -5%' })
  @Max(0.05, { message: 'Offset de precio no puede superar +5%' })
  @IsOptional()
  orderPriceOffsetPct?: number;

  @ApiPropertyOptional({
    enum: IntervalModeEnum,
    example: IntervalModeEnum.AGENT,
  })
  @IsEnum(IntervalModeEnum)
  @IsOptional()
  intervalMode?: IntervalModeEnum;

  @ApiPropertyOptional({
    example: true,
    description: 'Activar o desactivar la configuración',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: LLMProviderEnum,
    description: 'Primary LLM provider for this agent',
  })
  @IsEnum(LLMProviderEnum)
  @IsOptional()
  primaryProvider?: LLMProviderEnum;

  @ApiPropertyOptional({ description: 'Primary LLM model ID' })
  @IsString()
  @IsOptional()
  primaryModel?: string;

  @ApiPropertyOptional({
    enum: LLMProviderEnum,
    description: 'Fallback LLM provider',
  })
  @IsEnum(LLMProviderEnum)
  @IsOptional()
  fallbackProvider?: LLMProviderEnum;

  @ApiPropertyOptional({ description: 'Fallback LLM model ID' })
  @IsString()
  @IsOptional()
  fallbackModel?: string;

  @ApiPropertyOptional({
    enum: RiskProfileEnum,
    example: RiskProfileEnum.MODERATE,
    description: 'Risk profile for model selection and prompts',
  })
  @IsEnum(RiskProfileEnum)
  @IsOptional()
  riskProfile?: RiskProfileEnum;
}

export class StartAgentDto {
  @ApiProperty({ description: 'ID de la configuración del agente' })
  @IsString()
  configId!: string;
}

export class StopAgentDto {
  @ApiProperty({ description: 'ID de la configuración del agente' })
  @IsString()
  configId!: string;
}

export class StopAgentsByModeDto {
  @ApiProperty({
    enum: TradingModeEnum,
    description: 'Modo cuyos agentes se detendrán',
  })
  @IsEnum(TradingModeEnum)
  mode!: TradingModeEnum;
}
