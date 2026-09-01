import { Type } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum EntryOrderStatusEnum {
  RESTING = 'RESTING',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  MISSING = 'MISSING',
}

export class ListEntryOrdersDto {
  @ApiPropertyOptional({
    description: 'Filtrar por configId (TradingConfig) del usuario',
  })
  @IsOptional()
  @IsString()
  configId?: string;

  @ApiPropertyOptional({
    enum: EntryOrderStatusEnum,
    description: 'Filtrar por estado de la entrada',
  })
  @IsOptional()
  @IsEnum(EntryOrderStatusEnum)
  status?: EntryOrderStatusEnum;

  @ApiPropertyOptional({
    example: '2026-08-01T00:00:00Z',
    description: 'Solo entradas con placedAt >= esta fecha (ISO-8601)',
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
