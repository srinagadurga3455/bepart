import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { validateFormData } from '../common/validators/form-structure.validator';

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRegistrationDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if ((event as any).status !== 'PUBLISHED') throw new BadRequestException('Event is not published / registration closed');
      const now = new Date();
      if (event.closingTime && now > event.closingTime) throw new BadRequestException('Registration closed (closingTime passed)');
      // Validate formData against event's formStructure (Google Form style)
      if (event.formStructure) validateFormData(event.formStructure, dto.formData);
      // Slots capacity: count registrations for event
      const count = await tx.registration.count({ where: { eventId: event.id } });
      if (count >= event.slots) throw new BadRequestException(`Event slots full (${event.slots} slots, ${count} taken)`);
      // Duplicate phone per event
      const existing = await tx.registration.findFirst({ where: { eventId: dto.eventId, phone: dto.phone } });
      if (existing) throw new ConflictException('Phone already registered for this event');
      const registration = await tx.registration.create({
        data: {
          phone: dto.phone.trim(),
          eventId: dto.eventId,
          formData: dto.formData as any,
        },
        include: { event: true },
      });
      return registration;
    });
  }

  async findAllForUser(userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.prisma.registration.findMany({ include: { event: true }, orderBy: { createdAt: 'desc' } });
    }
    if (role === 'ORGANIZER') {
      const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
      if (!organizer) return [];
      return this.prisma.registration.findMany({
        where: { event: { organizerId: organizer.id } },
        include: { event: true },
        orderBy: { createdAt: 'desc' },
      });
    }
    // STUDENT: try to match by user's phone
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.phone) {
      return this.prisma.registration.findMany({ where: { phone: user.phone }, include: { event: true }, orderBy: { createdAt: 'desc' } });
    }
    return [];
  }

  async findOne(registrationId: string, userId: string, role: string) {
    const reg = await this.prisma.registration.findUnique({ where: { registrationId }, include: { event: true } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (role === 'STUDENT') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.phone && reg.phone !== user.phone) throw new ForbiddenException('Not your registration');
      if (!user?.phone && reg.phone) throw new ForbiddenException('Not your registration');
    }
    if (role === 'ORGANIZER') {
      const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
      const ev = await this.prisma.event.findUnique({ where: { id: reg.eventId } });
      if (!organizer || !ev || ev.organizerId !== organizer.id) throw new ForbiddenException('You can only view registrations for your events');
    }
    return reg;
  }

  async cancel(registrationId: string, userId: string, role: string) {
    const reg = await this.prisma.registration.findUnique({ where: { registrationId }, include: { event: true } });
    if (!reg) throw new NotFoundException('Registration not found');
    if (role === 'STUDENT') {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user?.phone !== reg.phone) throw new ForbiddenException('You can only cancel your own registration');
    }
    if (role === 'ORGANIZER') {
      const org = await this.prisma.organizer.findUnique({ where: { userId } });
      const ev = await this.prisma.event.findUnique({ where: { id: reg.eventId } });
      if (!org || !ev || ev.organizerId !== org.id) throw new ForbiddenException('Cannot cancel others events');
    }
    await this.prisma.registration.delete({ where: { registrationId } });
    return { message: 'Registration cancelled', registrationId };
  }
}
