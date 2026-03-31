import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppGateway } from '../gateway/app.gateway';
import { NotificationType } from '../../generated/prisma/enums';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: AppGateway,
  ) {}

  async create(userId: string, type: NotificationType, message: string) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, message },
      select: { id: true, type: true, message: true, createdAt: true },
    });
    this.gateway.emitToUser(userId, 'notification:new', notification);
    return notification;
  }

  async getAll(userId: string, take = 50) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        type: true,
        message: true,
        read: true,
        createdAt: true,
      },
    });
  }

  async getUnread(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId, read: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, message: true, createdAt: true },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }
}
