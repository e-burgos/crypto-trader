import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  BinanceKeyDto,
  LLMKeyDto,
  UpdateUserStatusDto,
} from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../auth/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── /users/me ────────────────────────────────────────────────────────────

  @Get('users/me')
  getMe(@CurrentUser() user: RequestUser) {
    return this.usersService.getMe(user.userId);
  }

  @Put('users/me')
  updateMe(@CurrentUser() user: RequestUser, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.userId, dto);
  }

  // ── /users/me/binance-keys ────────────────────────────────────────────────

  @Post('users/me/binance-keys')
  setBinanceKeys(@CurrentUser() user: RequestUser, @Body() dto: BinanceKeyDto) {
    return this.usersService.setBinanceKeys(user.userId, dto);
  }

  @Delete('users/me/binance-keys')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBinanceKeys(@CurrentUser() user: RequestUser) {
    return this.usersService.deleteBinanceKeys(user.userId);
  }

  @Get('users/me/binance-keys/status')
  getBinanceKeyStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getBinanceKeyStatus(user.userId);
  }

  // ── /users/me/llm-keys ────────────────────────────────────────────────────

  @Post('users/me/llm-keys')
  setLLMKey(@CurrentUser() user: RequestUser, @Body() dto: LLMKeyDto) {
    return this.usersService.setLLMKey(user.userId, dto);
  }

  @Delete('users/me/llm-keys/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLLMKey(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
  ) {
    return this.usersService.deleteLLMKey(user.userId, provider);
  }

  @Get('users/me/llm-keys/status')
  getLLMKeyStatus(@CurrentUser() user: RequestUser) {
    return this.usersService.getLLMKeyStatus(user.userId);
  }

  // ── /admin/users ──────────────────────────────────────────────────────────

  @Get('admin/users')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  getAllUsers(@CurrentUser() user: RequestUser) {
    return this.usersService.getAllUsers(user.userId);
  }

  @Patch('admin/users/:id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  setUserStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setUserStatus(user.userId, targetUserId, dto.isActive);
  }
}
