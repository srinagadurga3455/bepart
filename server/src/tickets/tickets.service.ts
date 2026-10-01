import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TicketsRepository, frontendBaseUrl } from './tickets.repo';
import { canonicalPhone } from '../common/utils/phone';

export interface TicketActor {
  userId: string;
  role: string;
}

function extractCode(input: string): string {
  const clean = String(input || '').trim();
  if (!clean) return '';
  const m = /\/ticket\/([A-Za-z0-9-]+)\/?(?:\?.*)?$/.exec(clean);
  return m?.[1] || clean;
}

function registrantName(formData: any): string {
  const fd = formData && typeof formData === 'object' ? formData : {};
  return fd.teamName || fd.member1Name || fd.fullName || '—';
}

function publicEventView(event: any) {
  if (!event) return null;
  return {
    id: event.id,
    eventName: event.eventName,
    date: event.date,
    closingTime: event.closingTime,
    status: event.status,
    formStructure: event.formStructure ?? null,
    organizer: event.organizer ? { id: event.organizer.id, name: event.organizer.name } : null,
  };
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepo: TicketsRepository,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private base(): string {
    return frontendBaseUrl(this.configService?.get<string>('FRONTEND_URL'));
  }

  /** Resolve a ticket by code, QR token, full URL, or legacy registrationId. */
  async resolveTicket(input: string) {
    const key = extractCode(input);
    if (!key) throw new BadRequestException('Ticket ID, URL or QR token is required');
    return (
      (await this.ticketsRepo.findByCode(key)) ||
      (await this.ticketsRepo.findByQrToken(key)) ||
      (await this.ticketsRepo.findByRegistrationId(key))
    );
  }

  private assertCompleted(ticket: any) {
    const event = (ticket as any).event;
    const registration = (ticket as any).registration;
    if (!registration) throw new BadRequestException('Ticket registration is missing');
    if (!event) throw new BadRequestException('Ticket event is missing');
    if ((ticket as any).status === 'CANCELLED') {
      throw new BadRequestException('Ticket is cancelled');
    }
    // Only completed registrations hold valid tickets: paid events require PAID.
    if ((event as any).paymentRequired === true && (registration as any).paymentStatus !== 'PAID') {
      throw new BadRequestException('Registration payment is not completed');
    }
  }

  private async assertOwnership(ticket: any, actor: TicketActor) {
    if (actor.role === 'ADMIN') return;
    const organizer = await this.ticketsRepo.findOrganizerByUserId(actor.userId);
    const ownerId = (ticket as any).event?.organizerId;
    // Ownership derives from the ticket -> event relation, never from client input.
    if (!organizer || !ownerId || ownerId !== organizer.id) {
      throw new ForbiddenException('You can only validate tickets for your own events');
    }
  }

  private organizerView(ticket: any) {
    const registration = (ticket as any).registration || {};
    const event = (ticket as any).event;
    return {
      ticket: {
        id: (ticket as any).id,
        code: (ticket as any).code,
        status: (ticket as any).status,
        checkedInAt: (ticket as any).checkedInAt,
        ticketUrl: (ticket as any).ticketUrl,
        createdAt: (ticket as any).createdAt,
      },
      registration: {
        registrationId: registration.registrationId,
        phone: registration.phone,
        formData: registration.formData ?? null,
        paymentStatus: registration.paymentStatus,
        participantName: registrantName(registration.formData),
      },
      event: publicEventView(event),
      checkedIn: (ticket as any).status === 'CHECKED_IN',
    };
  }

  /** Validate without checking in. ORGANIZER (own events) / ADMIN. */
  async validate(input: string, actor: TicketActor) {
    const ticket = await this.resolveTicket(input);
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.assertOwnership(ticket, actor);
    this.assertCompleted(ticket);
    return this.organizerView(ticket);
  }

  /** Check in. Duplicate scans return 409 with the original check-in time. */
  async checkIn(input: string, actor: TicketActor) {
    const ticket = await this.resolveTicket(input);
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.assertOwnership(ticket, actor);
    this.assertCompleted(ticket);
    const res = await this.ticketsRepo.checkInAtomic((ticket as any).id);
    if (!res) throw new NotFoundException('Ticket not found');
    const fresh = await this.ticketsRepo.findTicketWithRelations((ticket as any).id);
    if (res.already) {
      throw new ConflictException(
        `Ticket already checked in${(fresh as any)?.checkedInAt ? ` at ${new Date((fresh as any).checkedInAt).toISOString()}` : ''}`,
      );
    }
    const registration = (fresh as any)?.registration || {};
    const event = (fresh as any)?.event;
    return {
      ticketId: (fresh as any)?.code,
      participantName: registrantName(registration.formData),
      phone: registration.phone,
      event: event ? { id: event.id, eventName: event.eventName, date: event.date } : null,
      checkedInAt: (fresh as any)?.checkedInAt,
      status: (fresh as any)?.status,
    };
  }

  /** Authenticated student's own tickets (matched by account phone). */
  async findMine(userId: string) {
    const user = await this.ticketsRepo.findUserById(userId);
    const phone = user?.phone ? canonicalPhone(user.phone) : null;
    if (!phone || !user?.phone) return [];
    // Registrations store canonical phones; match raw + canonical defensively.
    const rows = await this.ticketsRepo.findTicketsByPhones([user.phone, phone]);
    return rows.map((t: any) => ({
      ticket: {
        code: t.code,
        status: t.status,
        checkedInAt: t.checkedInAt,
        ticketUrl: t.ticketUrl,
        createdAt: t.createdAt,
      },
      registration: t.registration,
      event: t.event,
    }));
  }

  /** Public ticket lookup (student ticket page / QR scan landing). No sensitive data. */
  async findPublicTicket(input: string) {
    const ticket = await this.resolveTicket(input);
    if (!ticket) throw new NotFoundException('Ticket not found');
    const registration = (ticket as any).registration || {};
    const event = (ticket as any).event;
    return {
      ticket: {
        code: (ticket as any).code,
        status: (ticket as any).status,
        checkedInAt: (ticket as any).checkedInAt,
        ticketUrl: (ticket as any).ticketUrl,
        createdAt: (ticket as any).createdAt,
      },
      // Public payload: no phone and no payment status. The student already
      // knows what they paid; the payment records are internal.
      registration: {
        registrationId: registration.registrationId,
        formData: registration.formData ?? null,
        participantName: registrantName(registration.formData),
      },
      event: publicEventView(event),
      checkedIn: (ticket as any).status === 'CHECKED_IN',
    };
  }

  /** Shared issuer used by registration + payment fulfillment (same tx). */
  async issueTicketTx(tx: any, registrationId: string, eventId: string) {
    return this.ticketsRepo.issueTicket(tx, {
      registrationId,
      eventId,
      frontendBase: this.base(),
    });
  }

  /** Ticket attached to a registration (legacy lookup enrichment). */
  async findTicketForRegistration(registrationId: string) {
    return this.ticketsRepo.findByRegistrationId(registrationId);
  }

  /** Cancelling a registration invalidates its ticket. */
  async cancelForRegistration(registrationId: string) {
    return this.ticketsRepo.cancelForRegistration(registrationId);
  }

  /** Revert a check-in (organizer correction at the gate). */
  async undoCheckIn(input: string, actor: TicketActor) {
    const ticket = await this.resolveTicket(input);
    if (!ticket) throw new NotFoundException('Ticket not found');
    await this.assertOwnership(ticket, actor);
    const res = await this.ticketsRepo.undoCheckInAtomic((ticket as any).id);
    if (!res) throw new NotFoundException('Ticket not found');
    const fresh = await this.ticketsRepo.findTicketWithRelations((ticket as any).id);
    const registration = (fresh as any)?.registration || {};
    const event = (fresh as any)?.event;
    return {
      ticketId: (fresh as any)?.code,
      participantName: registrantName(registration.formData),
      phone: registration.phone,
      event: event ? { id: event.id, eventName: event.eventName, date: event.date } : null,
      checkedInAt: (fresh as any)?.checkedInAt ?? null,
      status: (fresh as any)?.status,
    };
  }
}
