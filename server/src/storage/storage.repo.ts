import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class StorageRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Event — R2 square/rectangle only
  findEventById(id: string) {
  return this.prisma.event.findUnique({ where: { id: Number(id) } });
}

  findOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId } });
  }

  updateEventPosterSquare(id: string, posterSquareUrl: string) {
  return this.prisma.event.update({
    where: { id: Number(id) },
    data: { posterSquareUrl },
  });
}
  updateEventPosterRectangle(id: string, posterRectangleUrl: string) {
  return this.prisma.event.update({
    where: { id: Number(id) },
    data: { posterRectangleUrl },
  });
}
}