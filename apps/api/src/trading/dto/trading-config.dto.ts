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
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 100,
    example: 70,
    description: 'Confianza mínima para ejecutar SELL',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellThreshold?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 0.5,
    example: 0.03,
    description: 'Stop-loss como fracción del precio de entrada',
  })
  @IsNumber()
  @Min(0.001)
  @Max(0.5)
  @IsOptional()
  stopLossPct?: number;

  @ApiPropertyOptional({
    minimum: 0.001,
    maximum: 1,
    example: 0.05,
    description: 'Take-profit como fracción del precio de entrada',
  })
  @IsNumber()
  @Min(0.001)
  @Max(1)
  @IsOptional()
  takeProfitPct?: number;

  @ApiPropertyOptional({
    minimum: 0.01,
    maximum: 1,
    example: 0.1,
    description: 'Fracción máxima del balance a usar por trade',
  })
  @IsNumber()
  @Min(0.01)
  @Max(1)
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 10,
    example: 3,
    description: 'Máximo de posiciones abiertas simultáneas',
  })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 1440,
    example: 60,
    description: 'Intervalo mínimo entre ciclos en minutos',
  })
  @IsNumber()
  @Min(1)
  @Max(1440)
  @IsOptional()
  minIntervalMinutes?: number;
}

export class UpdateTradingConfigDto {
  @ApiPropertyOptional({ enum: TradingModeEnum })
  @IsEnum(TradingModeEnum)
  @IsOptional()
  mode?: TradingModeEnum;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyThreshold?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 70 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellThreshold?: number;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 0.5, example: 0.03 })
  @IsNumber()
  @Min(0.001)
  @Max(0.5)
  @IsOptional()
  stopLossPct?: number;

  @ApiPropertyOptional({ minimum: 0.001, maximum: 1, example: 0.05 })
  @IsNumber()
  @Min(0.001)
  @Max(1)
  @IsOptional()
  takeProfitPct?: number;

  @ApiPropertyOptional({ minimum: 0.01, maximum: 1, example: 0.1 })
  @IsNumber()
  @Min(0.01)
  @Max(1)
  @IsOptional()
  maxTradePct?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, example: 3 })
  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxConcurrentPositions?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 60 })
  @IsNumber()
  @Min(1)
  @Max(1440)
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
