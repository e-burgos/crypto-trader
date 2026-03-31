import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: { id: user.id, email: user.email, role: user.role },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (!user || !user.isActive) throw new Error('User not found');
      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      } as any),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      } as any),
    ]);
    return { accessToken, refreshToken };
  }
}
