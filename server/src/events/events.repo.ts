import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EventStatus } from '@prisma/client';

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId } });
  }

  createEvent(data: { eventName: string; description?: string; date: Date; slots: number; closingTime: Date; formStructure?: any; status: EventStatus; organizerId: string; paymentRequired?: boolean }) {
    return this.prisma.event.create({
      data: {
        eventName: data.eventName,
        description: data.description,
        date: data.date,
        slots: data.slots,
        closingTime: data.closingTime,
        formStructure: data.formStructure,
        status: data.status,
        organizerId: data.organizerId,
        paymentRequired: data.paymentRequired,
      },
      include: { organizer: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
  }

  findEvents(where: any, skip: number, take: number, orderBy: any, include?: any) {
    const args: any = { where, skip, take, orderBy };
    if (include) args.include = include;
    return this.prisma.event.findMany(args);
  }

  countEvents(where: any) {
    return this.prisma.event.count({ where });
  }

  findEventById(id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  findEventByIdWithOrganizer(id: string) {
    return this.prisma.event.findUnique({ where: { id }, include: { organizer: { select: { id: true, name: true } } } });
  }

  findEventByIdWithOrganizerFull(id: string) {
    return this.prisma.event.findUnique({ where: { id }, include: { organizer: true } });
  }

  findEventByIdWithRegistrations(id: string) {
    return this.prisma.event.findUnique({ where: { id }, include: { registrations: { take: 5 } } });
  }

  findEventFormStructure(id: string) {
    return this.prisma.event.findUnique({ where: { id }, select: { formStructure: true, eventName: true, status: true } });
  }

  updateEvent(id: string, data: any) {
    return this.prisma.event.update({ where: { id }, data });
  }

  updateEventStatus(id: string, status: EventStatus) {
    return this.prisma.event.update({ where: { id }, data: { status } });
  }
}
