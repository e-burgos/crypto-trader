import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNewsConfigDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 1440, example: 10 })
  @IsInt()
  @Min(1)
  @Max(1440)
  @IsOptional()
  intervalMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, example: 15 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  newsCount?: number;

  @ApiPropertyOptional({ type: [String], example: ['coindesk'] })
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @IsOptional()
  enabledSources?: string[];

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  onlySummary?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  botEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 15 })
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  newsWeight?: number;
}
