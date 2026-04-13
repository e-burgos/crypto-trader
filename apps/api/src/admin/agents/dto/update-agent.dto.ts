import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAgentDto {
  @ApiPropertyOptional({
    description: 'System prompt del agente (editable por Admin)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  systemPrompt?: string;

  @ApiPropertyOptional({ description: 'Activar/desactivar agente' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
