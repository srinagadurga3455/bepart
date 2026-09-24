import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventsRepository } from './events.repo';
import { StorageService } from '../storage/storage.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { EventPolicy } from './policies/event-policy';
import { EventStatus } from '@prisma/client';
import { validateFormStructure } from '../common/validators/form-structure.validator';

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepo: EventsRepository,
    private readonly storageService: StorageService,
  ) {}

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
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    if (organizer.status !== 'APPROVED') throw new ForbiddenException(`Only APPROVED organizers can create events (current: ${organizer.status})`);
    const event = await this.eventsRepo.createEvent({
      eventName: dto.eventName.trim(),
      description: dto.description?.trim(),
      date: new Date(dto.date),
      slots: dto.slots,
      closingTime: new Date(dto.closingTime),
      formStructure: dto.formStructure as any,
      status: EventStatus.DRAFT,
      organizerId: organizer.id,
      paymentRequired: dto.paymentRequired,
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
      this.eventsRepo.findEvents(where, skip, limit, { date: 'asc' }, { organizer: { select: { id: true, name: true } }, _count: { select: { registrations: true } } }),
      this.eventsRepo.countEvents(where),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findMyEvents(userId: string, query: QueryEventDto) {
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;
    const where: any = { organizerId: organizer.id };
    if (query.status) where.status = query.status as EventStatus;
    if (query.search) where.eventName = { contains: query.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.eventsRepo.findEvents(where, skip, limit, { createdAt: 'desc' }),
      this.eventsRepo.countEvents(where),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOnePublic(id: number) {
    const event = await this.eventsRepo.findEventByIdWithOrganizer(id);
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new NotFoundException('Event not found');
    return event;
  }

  async findOneForOrganizer(id: number, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    return this.eventsRepo.findEventByIdWithRegistrations(id);
  }

  async findOneForAdmin(id: number) {
    const event = await this.eventsRepo.findEventByIdWithOrganizerFull(id);
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async update(id: number, dto: UpdateEventDto, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    if (event.status === EventStatus.PUBLISHED || event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
      if (event.status === EventStatus.PUBLISHED) throw new ForbiddenException('Cannot update published event directly. Cancel if needed.');
    }
    if (dto.date && dto.closingTime) this.validateDates(dto.date, dto.closingTime);
    if (dto.date && !dto.closingTime) this.validateDates(dto.date, event.closingTime.toISOString());
    if (!dto.date && dto.closingTime) this.validateDates(event.date.toISOString(), dto.closingTime);
    if (dto.formStructure !== undefined) validateFormStructure(dto.formStructure);
    return this.eventsRepo.updateEvent(id, {
      eventName: dto.eventName?.trim(),
      description: dto.description?.trim(),
      date: dto.date ? new Date(dto.date) : undefined,
      slots: dto.slots,
      closingTime: dto.closingTime ? new Date(dto.closingTime) : undefined,
      formStructure: dto.formStructure as any,
      paymentRequired: dto.paymentRequired,
    });
  }

  async preview(id: number, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    EventPolicy.assertOwner(organizer.id, event.organizerId);
    EventPolicy.assertTransition(event.status, EventStatus.PREVIEW);
    return this.eventsRepo.updateEventStatus(id, EventStatus.PREVIEW);
  }

  async publish(id: number, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    if (organizer.status !== 'APPROVED') throw new ForbiddenException('Organizer not approved');
    EventPolicy.assertTransition(event.status, EventStatus.PUBLISHED);
    return this.eventsRepo.updateEventStatus(id, EventStatus.PUBLISHED);
  }

  async cancel(id: number, userId: string, role: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    if (role !== 'ADMIN') {
      const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
      if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    }
    EventPolicy.assertTransition(event.status, EventStatus.CANCELLED);
    return this.eventsRepo.updateEventStatus(id, EventStatus.CANCELLED);
  }

  async uploadPoster(eventId: number, file: Express.Multer.File, userId: string) {
    if (!file) throw new BadRequestException('Poster file is required');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type ${file.mimetype}. Allowed: jpeg, png, webp`);
    }
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File too large: ${file.size} bytes. Maximum 5 MB`);
    }
    const event = await this.eventsRepo.findEventById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer || event.organizerId !== organizer.id) {
      throw new ForbiddenException('You do not own this event');
    }
    const oldUrl: string | null = (event as any).posterUrl || null;
    const { url } = await this.storageService.uploadPoster(file, eventId);
    const updated = await this.eventsRepo.updatePosterUrl(eventId, url);
    if (oldUrl && oldUrl !== url) {
      // Best-effort cleanup — don't fail request if delete fails
      await this.storageService.deleteByUrl(oldUrl).catch(() => {});
    }
    return { message: 'Event poster uploaded successfully', posterUrl: updated.posterUrl };
  }
}
