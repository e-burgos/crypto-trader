import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  type RequestUser,
} from '../auth/decorators/current-user.decorator';
import { StreamHealthService } from './stream-health.service';

@ApiTags('trading')
@ApiBearerAuth('access-token')
@Controller('trading')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('TRADER')
export class StreamHealthController {
  constructor(private readonly streamHealth: StreamHealthService) {}

  @Get('stream-health')
  @ApiOperation({
    summary:
      'Salud del stream reactivo por símbolo de las configuraciones activas del usuario',
  })
  @ApiResponse({
    status: 200,
    description:
      'Un símbolo sin registro se reporta UNKNOWN/NO_RECORD, nunca se omite',
  })
  getStreamHealth(@CurrentUser() user: RequestUser) {
    return this.streamHealth.getHealthForUser(user.userId);
  }
}
