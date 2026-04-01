import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: '[ADMIN] Stats globales de la plataforma' })
  @ApiResponse({
    status: 200,
    schema: { example: { totalUsers: 12, totalTrades: 340, totalPnl: 1250.5, activeAgents: 3 } },
  })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  getStats() {
    return this.adminService.getStats();
  }

  @Post('kill-switch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Detener todos los agentes activos en la plataforma' })
  @ApiResponse({ status: 200, description: 'Kill-switch ejecutado. Todos los agentes detenidos.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  killSwitch(@CurrentUser() user: RequestUser) {
    return this.adminService.killSwitch(user.userId);
  }

  @Get('agents/status')
  @ApiOperation({ summary: '[ADMIN] Estado de todos los agentes de trading activos' })
  @ApiResponse({ status: 200, description: 'Lista de estados de agentes' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  getAgentsStatus() {
    return this.adminService.getAllAgentsStatus();
  }

  @Get('audit-log')
  @ApiOperation({ summary: '[ADMIN] Ver log de acciones administrativas' })
  @ApiResponse({ status: 200, description: 'Historial de acciones admin' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  getAuditLog() {
    return this.adminService.getAuditLog();
  }
}
