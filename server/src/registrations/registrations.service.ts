import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegistrationsRepository } from './registrations.repo';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { validateFormData } from '../common/validators/form-structure.validator';

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly registrationsRepo: RegistrationsRepository,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async create(dto: CreateRegistrationDto, userId?: string) {
    const registration = await this.registrationsRepo.transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if ((event as any).status !== 'PUBLISHED') throw new BadRequestException('Event is not published / registration closed');
      const now = new Date();
      if (event.closingTime && now > event.closingTime) throw new BadRequestException('Registration closed (closingTime passed)');
      if (event.formStructure) validateFormData(event.formStructure, dto.formData);
      const count = await tx.registration.count({ where: { eventId: event.id } });
      if (count >= event.slots) throw new BadRequestException(`Event slots full (${event.slots} slots, ${count} taken)`);
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

    // Post-registration ticket flow: console confirmation + ticket URL (no new model).
    this.logRegistrationConfirmation(registration, (registration as any)?.event, dto.formData);
    return { ...registration, ticketUrl: this.ticketUrl((registration as any)?.registrationId) };
  }

  // Public ticket lookup by registration ID (shareable /ticket/:id page, no auth, no listing).
  async findTicketById(registrationId: string) {
    const reg = await this.registrationsRepo.findTicketWithEvent(registrationId);
    if (!reg) throw new NotFoundException('Ticket not found');
    return { ...reg, ticketUrl: this.ticketUrl(reg.registrationId) };
  }

  private ticketUrl(registrationId: string): string {
    const base = (this.configService?.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    return `${base}/ticket/${registrationId}`;
  }

  private isEmptyValue(v: any): boolean {
    return v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
  }

  private formatValue(v: any): string {
    if (Array.isArray(v)) return v.join(', ');
    return String(v ?? '—');
  }

  private formatTicketDate(d: any): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return `${dt.getDate()} ${dt.toLocaleString('en-US', { month: 'long' })} ${dt.getFullYear()}`;
  }

  private formatTicketTime(d: any): string {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    const h24 = dt.getHours();
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h = h24 % 12 || 12;
    return `${h}:${String(dt.getMinutes()).padStart(2, '0')} ${ampm}`;
  }

  // Prints a clean, fully dynamic confirmation built from the actual event + submitted formData.
  private logRegistrationConfirmation(registration: any, event: any, formData: any): void {
    try {
      const bar = '='.repeat(40);
      const fd = (formData && typeof formData === 'object' && !Array.isArray(formData) ? formData : {}) as Record<string, any>;
      const lines: string[] = [bar, 'REGISTRATION CONFIRMED', bar];
      lines.push(`Event: ${event?.eventName ?? '—'}`);
      lines.push(`Registration ID / Ticket ID: ${registration?.registrationId ?? '—'}`);
      lines.push(`Registrant: ${fd.teamName || fd.member1Name || fd.fullName || registration?.phone || '—'}`);
      lines.push('', `Date: ${this.formatTicketDate(event?.date)}`, `Time: ${this.formatTicketTime(event?.date)}`, '');
      lines.push('Submitted Details:');
      const sections = (event?.formStructure as any)?.sections;
      if (Array.isArray(sections) && sections.length > 0) {
        for (const section of sections) {
          const fields = (section?.fields || []).filter((f: any) => f?.name && !this.isEmptyValue(fd[f.name]));
          if (fields.length === 0) continue;
          let currentMember = 0;
          for (const f of fields) {
            const m = /^member(\d+)(.*)$/i.exec(String(f.name));
            if (m) {
              const n = parseInt(m[1] ?? '', 10);
              if (n !== currentMember) {
                currentMember = n;
                lines.push('', `Member ${n}:`);
              }
              const sub = String(f.label || f.name).replace(new RegExp(`^member\\s*${n}\\s*`, 'i'), '');
              lines.push(`  ${sub}: ${this.formatValue(fd[f.name])}`);
            } else {
              lines.push(`${f.label || f.name}: ${this.formatValue(fd[f.name])}`);
            }
          }
          lines.push('');
        }
      } else {
        for (const [k, v] of Object.entries(fd)) {
          if (!this.isEmptyValue(v)) lines.push(`${k}: ${this.formatValue(v)}`);
        }
        lines.push('');
      }
      lines.push(`Ticket:\n${this.ticketUrl(registration?.registrationId)}`, bar);
      this.logger.log(`\n${lines.join('\n')}`);
    } catch (err) {
      // Logging must never break registration.
      this.logger.warn(`Could not print registration confirmation: ${(err as Error)?.message}`);
    }
  }

  async findAllForUser(userId: string, role: string) {
    if (role === 'ADMIN') {
      return this.registrationsRepo.findAll();
    }
    if (role === 'ORGANIZER') {
      const organizer = await this.registrationsRepo.findOrganizerByUserId(userId);
      if (!organizer) return [];
      return this.registrationsRepo.findByOrganizerId(organizer.id);
    }
    const user = await this.registrationsRepo.findUserById(userId);
    if (user?.phone) {
      return this.registrationsRepo.findByPhone(user.phone);
    }
    return [];
  }

  async findOne(registrationId: string, userId: string, role: string) {
    const reg = await this.registrationsRepo.findByRegistrationId(registrationId);
    if (!reg) throw new NotFoundException('Registration not found');
    if (role === 'STUDENT') {
      const user = await this.registrationsRepo.findUserById(userId);
      if (user?.phone && reg.phone !== user.phone) throw new ForbiddenException('Not your registration');
      if (!user?.phone && reg.phone) throw new ForbiddenException('Not your registration');
    }
    if (role === 'ORGANIZER') {
      const organizer = await this.registrationsRepo.findOrganizerByUserId(userId);
      const ev = await this.registrationsRepo.findEventById(reg.eventId);
      if (!organizer || !ev || ev.organizerId !== organizer.id) throw new ForbiddenException('You can only view registrations for your events');
    }
    return reg;
  }

  async cancel(registrationId: string, userId: string, role: string) {
    const reg = await this.registrationsRepo.findByRegistrationId(registrationId);
    if (!reg) throw new NotFoundException('Registration not found');
    if (role === 'STUDENT') {
      const user = await this.registrationsRepo.findUserById(userId);
      if (user?.phone !== reg.phone) throw new ForbiddenException('You can only cancel your own registration');
    }
    if (role === 'ORGANIZER') {
      const org = await this.registrationsRepo.findOrganizerByUserId(userId);
      const ev = await this.registrationsRepo.findEventById(reg.eventId);
      if (!org || !ev || ev.organizerId !== org.id) throw new ForbiddenException('Cannot cancel others events');
    }
    await this.registrationsRepo.deleteByRegistrationId(registrationId);
    return { message: 'Registration cancelled', registrationId };
  }
}
