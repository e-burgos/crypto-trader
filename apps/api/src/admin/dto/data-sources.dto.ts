import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToggleDataSourceDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateDataSourceConfigDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 1000, example: 10 })
  @IsInt()
  @Min(0)
  @Max(1000)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100_000, example: 60 })
  @IsInt()
  @Min(1)
  @Max(100_000)
  @IsOptional()
  rateLimitPerMin?: number;

  @ApiPropertyOptional({ minimum: 1000, maximum: 86_400_000, example: 60_000 })
  @IsInt()
  @Min(1000)
  @Max(86_400_000)
  @IsOptional()
  pollingIntervalMs?: number;
}

export class SetDataSourceCredentialDto {
  @ApiProperty({ example: 'sk-live-abc123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  apiKey!: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  shared?: boolean;
}
