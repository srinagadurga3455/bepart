import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RegistrationsRepository } from './registrations.repo';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { validateFormData } from '../common/validators/form-structure.validator';
import { canonicalPhone } from '../common/utils/phone';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class RegistrationsService {
  private readonly logger = new Logger(RegistrationsService.name);

  constructor(
    private readonly registrationsRepo: RegistrationsRepository,
    private readonly couponsService: CouponsService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  async create(dto: CreateRegistrationDto, userId?: string) {
    // Normalize an explicitly supplied coupon early: bad format is a 4xx,
    // never silently ignored.
    const requestedCouponCode = (dto as any).couponCode
      ? CouponsService.normalizeCode((dto as any).couponCode)
      : null;

    const registration = await this.registrationsRepo.transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Event not found');
      if ((event as any).status !== 'PUBLISHED') throw new BadRequestException('Event is not published / registration closed');
      const now = new Date();
      if (event.closingTime && now > event.closingTime) throw new BadRequestException('Registration closed (closingTime passed)');
      if (event.formStructure) validateFormData(event.formStructure, dto.formData);
      const canonical = canonicalPhone(dto.phone);
      const count = await tx.registration.count({ where: { eventId: event.id } });
      if (count >= event.slots) throw new BadRequestException(`Event slots full (${event.slots} slots, ${count} taken)`);
      const existing = await tx.registration.findFirst({ where: { eventId: dto.eventId, phone: canonical } });
      if (existing) throw new ConflictException('Phone already registered for this event');

      const isPaidEvent = (event as any).paymentRequired === true;

      if (!isPaidEvent) {
        if (requestedCouponCode) {
          throw new BadRequestException('Coupon cannot be applied to a free event');
        }
        const registration = await tx.registration.create({
          data: {
            phone: canonical,
            eventId: dto.eventId,
            formData: dto.formData as any,
          },
          include: { event: true },
        });
        return registration;
      }

      // Paid event: Registration only after PAID payment. Check for successful payment first (canonical).
      const successfulPayment = await tx.payment.findFirst({
        where: {
          eventId: dto.eventId,
          phone: canonical,
          status: 'PAID' as any,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!successfulPayment) {
        const pendingOrFailed = await tx.payment.findFirst({
          where: { eventId: dto.eventId, phone: canonical, status: { in: ['PENDING', 'FAILED'] as any } },
        });
        if (pendingOrFailed) {
          throw new BadRequestException(`Payment status is ${pendingOrFailed.status} - registration not allowed until payment is PAID. Please complete payment first.`);
        }
        throw new BadRequestException('Payment required for this event. Please create a payment with status PENDING and complete it to PAID before registering.');
      }

      // Prevent duplicate registration (should already be checked by existing, but double-check)
      // Also ensure the successful payment is not already linked to a registration
      if ((successfulPayment as any).registrationId) {
        // Check if that registration still exists
        const linkedReg = await tx.registration.findUnique({ where: { registrationId: (successfulPayment as any).registrationId } });
        if (linkedReg) throw new ConflictException('Phone already registered for this event (via previous payment)');
      }

      // Also check if a registration already exists for this phone+event (in case payment was not linked)
      // This is already checked above as `existing`, but we already checked existing at top for all events.
      // For paid events, the existing check above already covers it, but we keep it for safety.

      // --- Coupon snapshot (pricing is sourced ONLY from the PAID payment) ---
      // The discount was calculated exactly once at payment init. Here we copy
      // the persisted payment amounts onto the registration so history survives
      // later coupon edits/deactivation/deletion. An explicitly requested coupon
      // that the payment does not carry is a 4xx, never silently full-priced.
      let snapshot: { couponId: string | null; couponCode: string | null; originalAmount: number; discountAmount: number; totalAmount: number } = {
        couponId: null,
        couponCode: null,
        originalAmount: (successfulPayment as any).originalAmount ?? (successfulPayment as any).amount,
        discountAmount: (successfulPayment as any).discountAmount ?? 0,
        totalAmount: (successfulPayment as any).amount,
      };
      if ((successfulPayment as any).couponId) {
        const paymentCoupon = await tx.coupon.findUnique({ where: { id: (successfulPayment as any).couponId } });
        const paymentCode = (successfulPayment as any).couponCode ?? paymentCoupon?.code ?? null;
        if (requestedCouponCode && paymentCode !== requestedCouponCode) {
          throw new BadRequestException(
            `Payment does not use coupon ${requestedCouponCode}. Complete a discounted payment with that coupon first.`,
          );
        }
        if (paymentCoupon && paymentCoupon.eventId !== dto.eventId) {
          throw new BadRequestException('Coupon not valid for this event');
        }
        // Atomically consume one redemption (re-validates active/dates/usage
        // inside the same transaction, so races cannot overshoot usageLimit).
        // Coupon deleted after payment: keep the payment's persisted amounts.
        if (paymentCoupon) {
          await this.couponsService.consumeAtomic(tx, paymentCoupon.id, {
            phone: canonical,
            studentId: (await tx.user.findFirst({ where: { phone: canonical } }))?.id || undefined,
          });
        }
        snapshot = {
          couponId: (successfulPayment as any).couponId,
          couponCode: paymentCode,
          originalAmount: snapshot.originalAmount,
          discountAmount: snapshot.discountAmount,
          totalAmount: snapshot.totalAmount,
        };
      } else if (requestedCouponCode) {
        throw new BadRequestException(
          `Payment does not use coupon ${requestedCouponCode}. Complete a discounted payment with that coupon first.`,
        );
      }

      // Create Registration with paymentStatus PAID and link to the successful Payment atomically (canonical)
      const registration = await tx.registration.create({
        data: {
          phone: canonical,
          eventId: dto.eventId,
          formData: dto.formData as any,
          paymentStatus: 'PAID' as any,
          couponId: snapshot.couponId,
          couponCode: snapshot.couponCode,
          originalAmount: snapshot.originalAmount,
          discountAmount: snapshot.discountAmount,
          totalAmount: snapshot.totalAmount,
        },
        include: { event: true },
      });

      // Link the successful payment to this registration
      await tx.payment.update({
        where: { id: successfulPayment.id },
        data: { registrationId: registration.registrationId },
      });

      return registration;
    });

    // Post-registration ticket flow: console confirmation + ticket URL (no new model).
    this.logRegistrationConfirmation(registration, (registration as any)?.event, dto.formData);
    const pricing = {
      originalAmount: (registration as any)?.originalAmount ?? 0,
      discountAmount: (registration as any)?.discountAmount ?? 0,
      totalAmount: (registration as any)?.totalAmount ?? 0,
      coupon: (registration as any)?.couponCode ? { code: (registration as any).couponCode } : null,
    };
    return { ...registration, pricing, ticketUrl: this.ticketUrl((registration as any)?.registrationId) };
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
      return this.registrationsRepo.findByPhone(canonicalPhone(user.phone));
    }
    return [];
  }

  async findOne(registrationId: string, userId: string, role: string) {
    const reg = await this.registrationsRepo.findByRegistrationId(registrationId);
    if (!reg) throw new NotFoundException('Registration not found');
    if (role === 'STUDENT') {
      const user = await this.registrationsRepo.findUserById(userId);
      const regPhoneCan = canonicalPhone(reg.phone);
      const userPhoneCan = user?.phone ? canonicalPhone(user.phone) : null;
      if (userPhoneCan && regPhoneCan !== userPhoneCan) throw new ForbiddenException('Not your registration');
      if (!userPhoneCan && reg.phone) throw new ForbiddenException('Not your registration');
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
      const regCan = canonicalPhone(reg.phone);
      const userCan = user?.phone ? canonicalPhone(user.phone) : null;
      if (userCan !== regCan) throw new ForbiddenException('You can only cancel your own registration');
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
