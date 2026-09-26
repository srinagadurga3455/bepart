import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RegistrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Generic transaction wrapper — preserves existing $transaction behavior (business logic stays in service)
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  findAll() {
    return this.prisma.registration.findMany({ include: { event: true }, orderBy: { createdAt: 'desc' } });
  }

  findByOrganizerId(organizerId: string) {
    return this.prisma.registration.findMany({
      where: { event: { organizerId } },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByPhone(phone: string) {
    return this.prisma.registration.findMany({ where: { phone }, include: { event: true }, orderBy: { createdAt: 'desc' } });
  }

  findByRegistrationId(registrationId: string) {
    return this.prisma.registration.findUnique({ where: { registrationId }, include: { event: true } });
  }

  // Public ticket lookup: one registration + its event, without the top-level phone.
  findTicketWithEvent(registrationId: string) {
    return this.prisma.registration.findUnique({
      where: { registrationId },
      select: {
        registrationId: true,
        eventId: true,
        formData: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            eventName: true,
            description: true,
            date: true,
            slots: true,
            closingTime: true,
            status: true,
            formStructure: true,
            organizer: { select: { name: true } },
          },
        },
      },
    });
  }

  findOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId } });
  }

  findEventById(id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  deleteByRegistrationId(registrationId: string) {
    return this.prisma.registration.delete({ where: { registrationId } });
  }
}
