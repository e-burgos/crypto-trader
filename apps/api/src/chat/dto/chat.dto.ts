import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LLMProvider, AgentId } from '../../../generated/prisma/enums';

export class CreateSessionDto {
  @ApiProperty({ enum: LLMProvider })
  @IsEnum(LLMProvider)
  provider!: LLMProvider;

  @ApiProperty({ example: 'claude-sonnet-4-20250514' })
  @IsString()
  @IsNotEmpty()
  model!: string;

  @ApiPropertyOptional({ example: 'Market analysis session' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    enum: AgentId,
    description: 'Agent to use for this session. If omitted, KRYPTO routes on first message.',
  })
  @IsOptional()
  @IsEnum(AgentId)
  agentId?: AgentId;
}

export class SendMessageDto {
  @ApiProperty({ example: 'What is the RSI indicator?' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiPropertyOptional({
    description: 'Optional capability hint: help | trade | market',
    example: 'market',
  })
  @IsOptional()
  @IsString()
  capability?: string;
}

export class ChatMessageResponse {
  id!: string;
  role!: string;
  content!: string;
  createdAt!: Date;
  metadata?: unknown;
}

export class ChatSessionResponse {
  id!: string;
  title!: string;
  provider!: string;
  model!: string;
  createdAt!: Date;
  updatedAt!: Date;
  messages?: ChatMessageResponse[];
}

export class LLMOptionResponse {
  provider!: string;
  label!: string;
  model!: string;
  models!: string[];
}
