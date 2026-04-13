import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExecuteToolDto {
  @ApiProperty({
    description:
      'Tool name to execute (e.g. start_agent, stop_agent, create_config)',
    example: 'start_agent',
  })
  @IsString()
  @IsNotEmpty()
  tool!: string;

  @ApiPropertyOptional({
    description: 'Parameters for the tool',
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'User confirmation token (required for destructive tools)',
    example: 'confirmed',
  })
  @IsOptional()
  @IsString()
  confirmation?: string;
}
