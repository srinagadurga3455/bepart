import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repo';
import { PaymentStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { RequestUser } from '../common/types/jwt-payload';
import { canonicalPhone } from '../common/utils/phone';
import { CouponsRepository } from '../coupons/coupons.repo';
import { CouponsService } from '../coupons/coupons.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly couponsRepo: CouponsRepository,
    private readonly couponsService: CouponsService,
  ) {}

  async create(registrationId: string, dto: CreatePaymentDto, user: RequestUser) {
    if (!dto || dto.amount === undefined || dto.amount === null) throw new BadRequestException('amount is required');
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) throw new BadRequestException('amount must be an integer > 0 (in paise)');

    const registration = await this.paymentsRepo.findRegistrationWithEvent(registrationId);
    if (!registration) throw new NotFoundException('Registration not found');

    // Ownership check: registration must belong to authenticated user (via phone) unless ADMIN - use canonical
    const userId = user.userId || (user as any).id;
    const role = user.role;
    if (role !== 'ADMIN') {
      const dbUser = await this.paymentsRepo.findUserById(userId);
      if (!dbUser) throw new NotFoundException('User not found');
      // Student phone must match registration phone (canonical)
      if (!dbUser.phone || canonicalPhone(dbUser.phone) !== canonicalPhone(registration.phone)) {
        throw new ForbiddenException('You can only create payment for your own registration');
      }
    }

    const existing = await this.paymentsRepo.findPaymentByRegistrationId(registrationId);
    if (existing) throw new ConflictException('Payment already exists for this registration');

    const payment = await this.paymentsRepo.createPayment({
      registrationId,
      amount: dto.amount,
      status: PaymentStatus.PENDING,
    });

    return {
      id: payment.id,
      registrationId: payment.registrationId,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  async createPending(dto: CreatePendingPaymentDto, user?: RequestUser) {
    if (!dto || dto.amount === undefined || dto.amount === null) throw new BadRequestException('amount is required');
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) throw new BadRequestException('amount must be an integer > 0 (in paise)');
    if (!dto.phone || !dto.eventId) throw new BadRequestException('phone and eventId are required');

    // Verify event exists and is paid and published
    const event = await this.paymentsRepo.findEventById(dto.eventId);
    if (!event) throw new NotFoundException('Event not found');
    if ((event as any).paymentRequired !== true) throw new BadRequestException('Event does not require payment');
    if ((event as any).status !== 'PUBLISHED') throw new BadRequestException('Event is not published');

    const phone = canonicalPhone(dto.phone);
    // Prevent duplicate pending payment for same phone+event (canonical)
    const existingPending = await this.paymentsRepo.findPendingPaymentByPhoneAndEvent(phone, dto.eventId);
    if (existingPending) throw new ConflictException('Pending payment already exists for this phone and event');
    // Prevent duplicate registration (canonical)
    const existingReg = await this.paymentsRepo.findRegistrationByPhoneAndEvent(phone, dto.eventId);
    if (existingReg) throw new ConflictException('Phone already registered for this event');

    // SINGLE SOURCE OF TRUTH: `dto.amount` is always the ORIGINAL ticket amount
    // (in paise). The coupon discount is calculated EXACTLY ONCE here via
    // CouponsService (the one authoritative calculation). `Payment.amount`
    // stores only the final payable amount. Never recalculate the coupon in
    // registration, webhook (updateStatus), or any other flow.
    let finalAmount = dto.amount;
    let originalAmount: number | null = null;
    let discountAmount = 0;
    let couponId: string | null = null;
    let couponCode: string | null = null;

    // Validate coupon if provided (code itself is the eligibility mechanism)
    if ((dto as any).couponCode) {
      const rawCode = (dto as any).couponCode as string;
      this.logger.debug(`Coupon check code=${rawCode} event=${dto.eventId} now=${new Date(Date.now()).toISOString()}`);
      // Full validation (exists, event, active, dates, usage) + backend quote.
      const quote = await this.couponsService.priceQuote(rawCode, dto.eventId, dto.amount);
      originalAmount = quote.originalAmount;
      discountAmount = quote.discountAmount;
      finalAmount = quote.totalAmount;
      couponId = quote.coupon.id;
      couponCode = quote.coupon.code;
    }

    const payment = await this.paymentsRepo.createPendingPayment({
      phone,
      eventId: dto.eventId,
      amount: finalAmount,
      status: PaymentStatus.PENDING,
      couponId: couponId as any,
      couponCode: couponCode as any,
      originalAmount: originalAmount ?? dto.amount,
      discountAmount,
    } as any);

    return {
      id: payment.id,
      phone: payment.phone,
      eventId: payment.eventId,
      amount: payment.amount,
      originalAmount: (payment as any).originalAmount,
      discountAmount: (payment as any).discountAmount,
      couponCode: (payment as any).couponCode,
      status: payment.status,
      couponId: (payment as any).couponId,
      createdAt: payment.createdAt,
    };
  }

  async getById(id: string) {
    const payment = await this.paymentsRepo.findPaymentById(id);
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async getByRegistrationId(registrationId: string) {
    const payment = await this.paymentsRepo.findPaymentByRegistrationId(registrationId);
    if (!payment) throw new NotFoundException('Payment not found for registration');
    return payment;
  }

  async updateStatus(id: string, dto: UpdatePaymentStatusDto, actor: RequestUser) {
    const existing = await this.paymentsRepo.findPaymentById(id);
    if (!existing) throw new NotFoundException('Payment not found');
    if (!Object.values(PaymentStatus).includes(dto.status as PaymentStatus)) {
      throw new BadRequestException(`Invalid status: ${dto.status}. Allowed: PENDING, PAID, FAILED`);
    }
    // Ownership: only the organizer who owns the payment's event may change
    // its status (organizers collect offline payments for their own events).
    const organizer = await this.paymentsRepo.findOrganizerByUserId(actor.userId || (actor as any).id);
    if (!organizer) throw new ForbiddenException('Organizer profile not found');
    const organizerId =
      (existing as any).registration?.event?.organizerId ??
      ((existing as any).eventId
        ? (await this.paymentsRepo.findEventById((existing as any).eventId) as any)?.organizerId
        : null);
    if (!organizerId || organizerId !== organizer.id) {
      throw new ForbiddenException('You can only update payments for your own events');
    }
    const updated = await this.paymentsRepo.updatePaymentStatusAtomic(id, dto.status as PaymentStatus);
    return updated;
  }
}
