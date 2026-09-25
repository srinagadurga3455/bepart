import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StorageRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Event — R2 posters (generic + square/rectangle)
  findEventById(id: number) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  findOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId } });
  }

  updateEventPoster(id: number, posterUrl: string) {
    return this.prisma.event.update({ where: { id }, data: { posterUrl } });
  }

  updateEventPosterSquare(id: number, posterSquareUrl: string) {
    return this.prisma.event.update({ where: { id }, data: { posterSquareUrl } });
  }

  updateEventPosterRectangle(id: number, posterRectangleUrl: string) {
    return this.prisma.event.update({ where: { id }, data: { posterRectangleUrl } });
  }
}
