import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { EventPolicy } from './policies/event-policy';
import { EventStatus } from '@prisma/client';
import { validateFormStructure } from '../common/validators/form-structure.validator';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDates(date: string, closingTime: string) {
    const d = new Date(date);
    const c = new Date(closingTime);
    if (c >= d) throw new BadRequestException('closingTime must be before date');
    if (isNaN(d.getTime()) || isNaN(c.getTime())) throw new BadRequestException('Invalid date format');
  }

  async create(dto: CreateEventDto, userId: string) {
    this.validateDates(dto.date, dto.closingTime);
    if (dto.slots < 1) throw new BadRequestException('slots must be >= 1');
    if (dto.formStructure !== undefined) validateFormStructure(dto.formStructure);
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    if (organizer.status !== 'APPROVED') throw new ForbiddenException(`Only APPROVED organizers can create events (current: ${organizer.status})`);
    const event = await this.prisma.event.create({
      data: {
        eventName: dto.eventName.trim(),
        description: dto.description?.trim(),
        date: new Date(dto.date),
        slots: dto.slots,
        closingTime: new Date(dto.closingTime),
        formStructure: dto.formStructure as any,
        status: EventStatus.DRAFT,
        organizerId: organizer.id,
      },
      include: { organizer: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    return event;
  }

  async findPublished(query: QueryEventDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;
    const where: any = { status: EventStatus.PUBLISHED };
    if (query.search) where.eventName = { contains: query.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'asc' },
        include: { organizer: { select: { id: true, name: true } }, _count: { select: { registrations: true } } },
      }),
      this.prisma.event.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findMyEvents(userId: string, query: QueryEventDto) {
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;
    const where: any = { organizerId: organizer.id };
    if (query.status) where.status = query.status as EventStatus;
    if (query.search) where.eventName = { contains: query.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.prisma.event.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.event.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOnePublic(id: number) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: { organizer: { select: { id: true, name: true } } } });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new NotFoundException('Event not found');
    return event;
  }

  async findOneForOrganizer(id: number, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    return this.prisma.event.findUnique({ where: { id }, include: { registrations: { take: 5 } } });
  }

  async findOneForAdmin(id: number) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: { organizer: true } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(id: number, dto: UpdateEventDto, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    if (event.status === EventStatus.PUBLISHED || event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
      if (event.status === EventStatus.PUBLISHED) throw new ForbiddenException('Cannot update published event directly. Cancel if needed.');
    }
    if (dto.date && dto.closingTime) this.validateDates(dto.date, dto.closingTime);
    if (dto.date && !dto.closingTime) this.validateDates(dto.date, event.closingTime.toISOString());
    if (!dto.date && dto.closingTime) this.validateDates(event.date.toISOString(), dto.closingTime);
    if (dto.formStructure !== undefined) validateFormStructure(dto.formStructure);
    return this.prisma.event.update({
      where: { id },
      data: {
        eventName: dto.eventName?.trim(),
        description: dto.description?.trim(),
        date: dto.date ? new Date(dto.date) : undefined,
        slots: dto.slots,
        closingTime: dto.closingTime ? new Date(dto.closingTime) : undefined,
        formStructure: dto.formStructure as any,
      },
    });
  }

  async preview(id: number, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    EventPolicy.assertOwner(organizer.id, event.organizerId);
    EventPolicy.assertTransition(event.status, EventStatus.PREVIEW);
    return this.prisma.event.update({ where: { id }, data: { status: EventStatus.PREVIEW } });
  }

  async publish(id: number, userId: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    if (organizer.status !== 'APPROVED') throw new ForbiddenException('Organizer not approved');
    EventPolicy.assertTransition(event.status, EventStatus.PUBLISHED);
    return this.prisma.event.update({ where: { id }, data: { status: EventStatus.PUBLISHED } });
  }

  async cancel(id: number, userId: string, role: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    if (role !== 'ADMIN') {
      const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
      if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    }
    EventPolicy.assertTransition(event.status, EventStatus.CANCELLED);
    return this.prisma.event.update({ where: { id }, data: { status: EventStatus.CANCELLED } });
  }
}
