import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetMyDataSourceCredentialDto {
  @ApiProperty({ example: 'sk-live-abc123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  apiKey!: string;
}
