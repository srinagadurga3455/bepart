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

  /**
   * Normalize the optional WhatsApp group link: trim, treat empty as null
   * (link removed), leave undefined untouched (field not being changed).
   * Format validation stays in the DTO (@IsUrl); this only normalizes.
   */
  private normalizeGroupLink(value: unknown): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed ? trimmed : null;
  }

  private validateDates(date: string, closingTime: string) {
    const d = new Date(date);
    const c = new Date(closingTime);
    if (isNaN(d.getTime()) || isNaN(c.getTime())) throw new BadRequestException('Invalid date format');
    // Epoch-ms comparisons (timezone-safe): both instants must lie ahead of
    // "now", and registration must close before the event starts.
    const now = Date.now();
    if (d.getTime() <= now) throw new BadRequestException('Event date must be in the future.');
    if (c.getTime() <= now) throw new BadRequestException('Registration deadline must be in the future.');
    if (c.getTime() >= d.getTime()) throw new BadRequestException('Registration deadline must be before the event starts.');
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
      // Fail fast on a duplicate custom code BEFORE creating the event, so a
      // conflicting code can never leave behind a coupon-less orphan event.
      if (cfg.code) {
        const normalized = CouponsService.normalizeCode(cfg.code);
        const clash = await this.couponsRepo.findByCode(normalized);
        if (clash) throw new ConflictException('Coupon code already exists');
        cfg.code = normalized;
      }
    }
    const organizer = await this.eventsRepo.findOrganizerByUserId(userId);
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    if (organizer.status !== 'APPROVED') throw new ForbiddenException(`Only APPROVED organizers can create events (current: ${organizer.status})`);
    if ((organizer as any).isActive === false) throw new ForbiddenException('Organizer account is deactivated. Contact support to reactivate.');
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
      whatsappGroupLink: this.normalizeGroupLink((dto as any).whatsappGroupLink) ?? null,
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
        ...(cfg.code ? { code: cfg.code } : {}),
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
    // Completed/past events stay visible in Explore: completion is a display
    // concern handled client-side via the event `date` field (see
    // frontend `isEventCompleted`). Only registration closing uses
    // `closingTime`, which is separate and always earlier than `date`.
    const where: any = { status: EventStatus.PUBLISHED, isActive: true, organizer: { isActive: true } };
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
    if ((event as any).isActive === false || (event as any).organizer?.isActive === false) {
      throw new NotFoundException('Event not found');
    }
    return { ...event, hasCoupon: await this.couponsRepo.hasActiveCouponForEvent(id) };
  }

  async getRegistrationForm(id: string) {
    const event = await this.eventsRepo.findEventFormStructure(id);
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) throw new NotFoundException('Event not found');
    if ((event as any).isActive === false) throw new NotFoundException('Event not found');
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
    // PUBLISHED events stay editable by their owning organizer. updateEvent
    // never touches status, so the event remains PUBLISHED after editing.
    // All other guards below (dates, form structure) apply unchanged.
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
      // Only touch the group link when the organizer supplied it: a value
      // sets/replaces it, null/empty clears it, absent leaves it unchanged.
      ...((dto as any).whatsappGroupLink !== undefined
        ? { whatsappGroupLink: this.normalizeGroupLink((dto as any).whatsappGroupLink) }
        : {}),
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
    if ((organizer as any).isActive === false) throw new ForbiddenException('Organizer account is deactivated');
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
