import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    example: 'trader@example.com',
    description: 'Email único del usuario',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'SecurePass123!',
    minLength: 8,
    description: 'Mínimo 8 caracteres',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @ApiProperty({ example: 'trader@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'JWT refresh token' })
  @IsString()
  refreshToken!: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'new@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'NewSecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;
}

export class UpdateUserStatusDto {
  @ApiProperty({ example: true, description: 'Activar o desactivar la cuenta' })
  @IsBoolean()
  isActive!: boolean;
}

export class BinanceKeyDto {
  @ApiProperty({
    description: 'Binance API Key (permisos de lectura y trading)',
  })
  @IsString()
  apiKey!: string;

  @ApiProperty({ description: 'Binance API Secret' })
  @IsString()
  apiSecret!: string;
}

export class SetTestnetBinanceKeysDto {
  @ApiProperty({
    description: 'Binance Testnet API Key',
  })
  @IsString()
  apiKey!: string;

  @ApiProperty({ description: 'Binance Testnet API Secret' })
  @IsString()
  apiSecret!: string;
}

export class LLMKeyDto {
  @ApiProperty({
    enum: ['CLAUDE', 'OPENAI', 'GROQ', 'GEMINI', 'MISTRAL', 'TOGETHER'],
    example: 'CLAUDE',
  })
  @IsString()
  provider!: string;

  @ApiProperty({ description: 'API Key del proveedor LLM' })
  @IsString()
  apiKey!: string;

  @ApiProperty({
    example: 'claude-sonnet-4-6',
    description: 'Modelo seleccionado del proveedor',
  })
  @IsString()
  selectedModel!: string;
}

export class NewsApiKeyDto {
  @ApiProperty({ enum: ['CRYPTOPANIC'], example: 'CRYPTOPANIC' })
  @IsString()
  provider!: string;

  @ApiProperty({ description: 'API Key del proveedor de noticias' })
  @IsString()
  apiKey!: string;
}

export class UpdateOperationModeDto {
  @ApiProperty({
    enum: ['SANDBOX', 'TESTNET', 'LIVE'],
    example: 'SANDBOX',
    description: 'Modo de operación global de la plataforma',
  })
  @IsEnum(['SANDBOX', 'TESTNET', 'LIVE'])
  mode!: 'SANDBOX' | 'TESTNET' | 'LIVE';
}
