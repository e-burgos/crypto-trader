import {
  Controller,
  Get,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar notificaciones del usuario (las no leídas primero)',
  })
  @ApiQuery({ name: 'take', required: false, type: Number, example: 50 })
  @ApiResponse({ status: 200, description: 'Lista de notificaciones' })
  getAll(@CurrentUser() user: RequestUser, @Query('take') take?: string) {
    return this.notificationsService.getAll(user.userId, take ? +take : 50);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Listar solo notificaciones no leídas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de notificaciones no leídas',
  })
  getUnread(@CurrentUser() user: RequestUser) {
    return this.notificationsService.getUnread(user.userId);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  @ApiResponse({ status: 204, description: 'Todas marcadas como leídas' })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  @ApiParam({ name: 'id', description: 'ID de la notificación' })
  @ApiResponse({ status: 204, description: 'Marcada como leída' })
  @ApiResponse({ status: 404, description: 'Notificación no encontrada' })
  markRead(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }
}
