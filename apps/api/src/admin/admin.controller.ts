import {
  Controller,
  Get,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../auth/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Post('kill-switch')
  @HttpCode(HttpStatus.OK)
  killSwitch(@CurrentUser() user: RequestUser) {
    return this.adminService.killSwitch(user.userId);
  }

  @Get('audit-log')
  getAuditLog(@CurrentUser() user: RequestUser) {
    return this.adminService.getAuditLog(user.userId);
  }
}
