import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class UpdateUserRiskPolicyDto {
  @ApiProperty({
    example: true,
    description: 'Interruptor maestro de los límites agregados por usuario',
  })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({
    example: 500,
    nullable: true,
    description:
      'Techo de exposición nocional por activo entre todas las configs del usuario',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Exposición máxima por activo (USD) debe ser un número válido' })
  @Min(0, { message: 'Exposición máxima por activo (USD) debe ser mayor o igual a $constraint1' })
  maxAssetExposureUsd?: number | null;

  @ApiPropertyOptional({
    example: 0.4,
    nullable: true,
    description: 'Ídem en fracción del equity (wallets + exposición)',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Exposición máxima por activo (%) debe ser un número válido' })
  @Min(0.001, { message: 'Exposición máxima por activo (%) debe ser al menos $constraint1' })
  @Max(1, { message: 'Exposición máxima por activo (%) no puede superar $constraint1' })
  maxAssetExposurePct?: number | null;

  @ApiPropertyOptional({
    example: 50,
    nullable: true,
    description: 'Pérdida realizada máxima del día calendario UTC',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Pérdida diaria máxima debe ser un número válido' })
  @Min(0, { message: 'Pérdida diaria máxima debe ser mayor o igual a $constraint1' })
  maxDailyLossUsd?: number | null;

  @ApiPropertyOptional({
    example: 0.1,
    nullable: true,
    description: 'Drawdown del día que dispara la pausa',
  })
  @IsOptional()
  @IsNumber({}, { message: 'Drawdown máximo debe ser un número válido' })
  @Min(0.001, { message: 'Drawdown máximo debe ser al menos $constraint1' })
  @Max(1, { message: 'Drawdown máximo no puede superar $constraint1' })
  maxDrawdownPct?: number | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Al cruzar el drawdown, pone isRunning=false en todas las configs del usuario',
  })
  @IsOptional()
  @IsBoolean()
  pauseAgentsOnDrawdown?: boolean;
}

export interface UserRiskPolicyResponse {
  enabled: boolean;
  maxAssetExposureUsd: number | null;
  maxAssetExposurePct: number | null;
  maxDailyLossUsd: number | null;
  maxDrawdownPct: number | null;
  pauseAgentsOnDrawdown: boolean;
  pausedAt: Date | null;
  pausedReason: string | null;
}
