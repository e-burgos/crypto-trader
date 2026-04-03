import {
  IsEnum,
  IsNumber,
  IsOptional,
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
}

export class CreateTradingConfigDto {
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
    minimum: 0.01,
    maximum: 1,
    example: 0.1,
    description: 'Fracción máxima del balance a usar por trade',
  })
  @IsNumber({}, { message: 'Porcentaje máximo por trade debe ser un número válido' })
  @Min(0.01, { message: 'Porcentaje máximo por trade debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje máximo por trade no puede superar $constraint1 (100%)' })
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10,
    example: 3,
    description: 'Máximo de posiciones abiertas simultáneas',
  })
  @IsNumber({}, { message: 'Máximo de posiciones concurrentes debe ser un número válido' })
  @Min(1, { message: 'Máximo de posiciones concurrentes debe ser al menos $constraint1' })
  @Max(10, { message: 'Máximo de posiciones concurrentes no puede superar $constraint1' })
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
  @Max(1440, { message: 'Intervalo mínimo no puede superar $constraint1 minutos (24hs)' })
  @IsOptional()
  minIntervalMinutes?: number;
}

export class UpdateTradingConfigDto {
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

  @ApiPropertyOptional({ minimum: 0.01, maximum: 1, example: 0.1 })
  @IsNumber({}, { message: 'Porcentaje máximo por trade debe ser un número válido' })
  @Min(0.01, { message: 'Porcentaje máximo por trade debe ser al menos $constraint1' })
  @Max(1, { message: 'Porcentaje máximo por trade no puede superar $constraint1 (100%)' })
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 3 })
  @IsNumber({}, { message: 'Máximo de posiciones concurrentes debe ser un número válido' })
  @Min(1, { message: 'Máximo de posiciones concurrentes debe ser al menos $constraint1' })
  @Max(10, { message: 'Máximo de posiciones concurrentes no puede superar $constraint1' })
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 60 })
  @IsNumber({}, { message: 'Intervalo mínimo debe ser un número válido' })
  @Min(1, { message: 'Intervalo mínimo debe ser al menos $constraint1 minuto' })
  @Max(1440, { message: 'Intervalo mínimo no puede superar $constraint1 minutos (24hs)' })
  @IsOptional()
  minIntervalMinutes?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Activar o desactivar la configuración',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class StartAgentDto {
  @ApiProperty({ enum: AssetEnum, example: AssetEnum.BTC })
  @IsEnum(AssetEnum)
  asset!: AssetEnum;

  @ApiProperty({ enum: QuoteCurrencyEnum, example: QuoteCurrencyEnum.USDT })
  @IsEnum(QuoteCurrencyEnum)
  pair!: QuoteCurrencyEnum;
}
