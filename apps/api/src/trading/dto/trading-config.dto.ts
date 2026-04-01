import {
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';

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
  @IsEnum(AssetEnum)
  asset!: AssetEnum;

  @IsEnum(QuoteCurrencyEnum)
  pair!: QuoteCurrencyEnum;

  @IsEnum(TradingModeEnum)
  mode!: TradingModeEnum;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyThreshold?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellThreshold?: number;

  @IsNumber()
  @Min(0.001)
  @Max(0.5)
  @IsOptional()
  stopLossPct?: number;

  @IsNumber()
  @Min(0.001)
  @Max(1)
  @IsOptional()
  takeProfitPct?: number;

  @IsNumber()
  @Min(0.01)
  @Max(1)
  @IsOptional()
  maxTradePct?: number;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxConcurrentPositions?: number;

  @IsNumber()
  @Min(1)
  @Max(1440)
  @IsOptional()
  minIntervalMinutes?: number;
}

export class UpdateTradingConfigDto {
  @IsEnum(TradingModeEnum)
  @IsOptional()
  mode?: TradingModeEnum;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  buyThreshold?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  sellThreshold?: number;

  @IsNumber()
  @Min(0.001)
  @Max(0.5)
  @IsOptional()
  stopLossPct?: number;

  @IsNumber()
  @Min(0.001)
  @Max(1)
  @IsOptional()
  takeProfitPct?: number;

  @IsNumber()
  @Min(0.01)
  @Max(1)
  @IsOptional()
  maxTradePct?: number;

  @IsNumber()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxConcurrentPositions?: number;

  @IsNumber()
  @Min(1)
  @Max(1440)
  @IsOptional()
  minIntervalMinutes?: number;
}

export class StartAgentDto {
  @IsEnum(AssetEnum)
  asset!: AssetEnum;

  @IsEnum(QuoteCurrencyEnum)
  pair!: QuoteCurrencyEnum;
}
