import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventsRepository } from './events.repo';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { QueryEventDto } from './dto/query-event.dto';
import { EventPolicy } from './policies/event-policy';
import { EventStatus } from '@prisma/client';
import { validateFormStructure } from '../common/validators/form-structure.validator';
import { CouponsService } from '../coupons/coupons.service';
import { CouponsRepository } from '../coupons/coupons.repo';

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepo: EventsRepository,
    private readonly couponsService: CouponsService,
    private readonly couponsRepo: CouponsRepository,
  ) {}

  private validateDates(date: string, closingTime: string) {
    const d = new Date(date);
    const c = new Date(closingTime);
    if (c >= d) throw new BadRequestException('closingTime must be before date');
    if (isNaN(d.getTime()) || isNaN(c.getTime())) throw new BadRequestException('Invalid date format');
  }

  async create(dto: CreateEventDto, userId: string, role: string = 'ORGANIZER') {
    this.validateDates(dto.date, dto.closingTime);
    if (dto.slots < 1) throw new BadRequestException('slots must be >= 1');
    if (dto.formStructure !== undefined) validateFormStructure(dto.formStructure);
    // Validate the optional coupon config BEFORE creating the event so an
    // invalid discount can never leave behind a coupon-less orphan event.
    const couponEnabled = (dto as any).coupon?.enabled === true;
    if (couponEnabled) {
      const cfg = (dto as any).coupon;
      if (!cfg.discountType || cfg.discountValue === undefined || cfg.discountValue === null) {
        throw new BadRequestException('discountType and discountValue are required when coupon.enabled=true');
      }
      CouponsService.assertValidDiscount(cfg.discountType, cfg.discountValue);
      CouponsService.assertValidWindow(cfg.startsAt, cfg.expiresAt);
    }
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
    // YES: backend auto-generates the code and links exactly one coupon.
    // NO (or omitted): normal event, no coupon row.
    if (!couponEnabled) {
      return { ...event, hasCoupon: false, coupon: null };
    }
    const cfg = (dto as any).coupon;
    const already = await this.couponsRepo.findByEvent(event.id);
    if (already.length > 0) throw new ConflictException('Event already has a coupon');
    const coupon = await this.couponsService.create(
      {
        eventId: event.id,
        discountType: cfg.discountType,
        discountValue: cfg.discountValue,
        isActive: cfg.isActive,
        startsAt: cfg.startsAt,
        expiresAt: cfg.expiresAt,
        usageLimit: cfg.usageLimit,
      } as any,
      { userId, role },
    );
    return { ...event, hasCoupon: true, coupon: { code: coupon.code } };
  }

  async findPublished(query: QueryEventDto) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;
    const where: any = { status: EventStatus.PUBLISHED };
    if (query.search) where.eventName = { contains: query.search, mode: 'insensitive' };
    const [data, total] = await Promise.all([
      this.eventsRepo.findEvents(where, skip, limit, { date: 'asc' }, { organizer: { select: { id: true, name: true } }, _count: { select: { registrations: true, coupons: { where: { isActive: true } } } } }),
      this.eventsRepo.countEvents(where),
    ]);
    return { data: data.map((e: any) => ({ ...e, hasCoupon: (e._count?.coupons ?? 0) > 0 })), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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
      this.eventsRepo.findEvents(where, skip, limit, { createdAt: 'desc' }, { _count: { select: { coupons: { where: { isActive: true } } } } }),
      this.eventsRepo.countEvents(where),
    ]);
    return { data: data.map((e: any) => ({ ...e, hasCoupon: (e._count?.coupons ?? 0) > 0 })), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOnePublic(id: string) {
    const event = await this.eventsRepo.findEventByIdWithOrganizer(id);
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new NotFoundException('Event not found');
    return { ...event, hasCoupon: await this.couponsRepo.hasActiveCouponForEvent(id) };
  }

  async getRegistrationForm(id: string) {
    const event = await this.eventsRepo.findEventFormStructure(id);
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new NotFoundException('Event not found');
    return event.formStructure || { title: 'Registration', description: '', sections: [] };
  }

  async findOneForOrganizer(id: string, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    const full = await this.eventsRepo.findEventByIdWithRegistrations(id);
    return { ...full, hasCoupon: await this.couponsRepo.hasActiveCouponForEvent(id) };
  }

  async findOneForAdmin(id: string) {
    const event = await this.eventsRepo.findEventByIdWithOrganizerFull(id);
    if (!event) throw new NotFoundException('Event not found');
    return { ...event, hasCoupon: await this.couponsRepo.hasActiveCouponForEvent(id) };
  }

  async update(id: string, dto: UpdateEventDto, userId: string) {
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

  async preview(id: string, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    EventPolicy.assertOwner(organizer.id, event.organizerId);
    EventPolicy.assertTransition(event.status, EventStatus.PREVIEW);
    return this.eventsRepo.updateEventStatus(id, EventStatus.PREVIEW);
  }

  async publish(id: string, userId: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    if (organizer.status !== 'APPROVED') throw new ForbiddenException('Organizer not approved');
    EventPolicy.assertTransition(event.status, EventStatus.PUBLISHED);
    return this.eventsRepo.updateEventStatus(id, EventStatus.PUBLISHED);
  }

  async cancel(id: string, userId: string, role: string) {
    const event = await this.eventsRepo.findEventById(id);
    if (!event) throw new NotFoundException('Event not found');
    if (role !== 'ADMIN') {
      const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
      if (!organizer || event.organizerId !== organizer.id) throw new ForbiddenException('You do not own this event');
    }
    EventPolicy.assertTransition(event.status, EventStatus.CANCELLED);
    return this.eventsRepo.updateEventStatus(id, EventStatus.CANCELLED);
  }
}
