import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum BotActionOutcomeEnum {
  EXECUTED = 'EXECUTED',
  BLOCKED = 'BLOCKED',
  DEFERRED = 'DEFERRED',
  SUPERSEDED = 'SUPERSEDED',
}

export class ListBotActionsDto {
  @ApiPropertyOptional({
    description: 'Filtrar por configId (TradingConfig) del usuario',
  })
  @IsOptional()
  @IsString()
  configId?: string;

  @ApiPropertyOptional({
    enum: BotActionOutcomeEnum,
    description: 'Filtrar por outcome del registro',
  })
  @IsOptional()
  @IsEnum(BotActionOutcomeEnum)
  outcome?: BotActionOutcomeEnum;

  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00Z',
    description: 'Solo acciones ocurridas en o después de esta fecha (ISO-8601)',
  })
  @IsOptional()
  @IsISO8601()
  since?: string;

  @ApiPropertyOptional({
    example: 50,
    minimum: 1,
    maximum: 200,
    description: 'Tamaño de página (default 50)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Cursor de paginación: id del último item de la página anterior',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
