import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsRepository } from './payments.repo';
import { PaymentStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { RequestUser } from '../common/types/jwt-payload';
import { canonicalPhone } from '../common/utils/phone';
import { CouponsRepository } from '../coupons/coupons.repo';
import { CouponsService } from '../coupons/coupons.service';
import * as crypto from 'crypto';
// Razorpay SDK has no bundled types; require keeps build green without @types.
 // eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpay: any;

  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly couponsRepo: CouponsRepository,
    private readonly couponsService: CouponsService,
    @Optional() private readonly configService?: ConfigService,
  ) {
    const keyId = this.configService?.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.getRazorpayKeySecret();
    if (keyId && keySecret) {
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    }
  }

  private getRazorpayKeySecret(): string | undefined {
    return (
      this.configService?.get<string>('RAZORPAY_KEY_SECRET') ||
      this.configService?.get<string>('RAZORPAY_SECRET') ||
      undefined
    );
  }

  private getRazorpayClient(): any {
    if (this.razorpay) return this.razorpay;
    const keyId = this.configService?.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.getRazorpayKeySecret();
    if (!keyId || !keySecret) return null;
    this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    return this.razorpay;
  }

  private isRazorpayConfigured(): boolean {
    return !!this.getRazorpayClient();
  }

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
      // Pending answers ride along so organizer PAID confirmation creates the
      // Registration atomically (see updatePaymentStatusAtomic).
      // Accept both `pendingFormData` (canonical DB/API name) and `formData`
      // (frontend alias) to preserve both flows.
      pendingFormData: (dto as any).pendingFormData ?? (dto as any).formData ?? null,
    } as any);

    // Razorpay order creation (only when Razorpay is configured).
    // Offline/coupon flows without Razorpay keep working and return the
    // payment without Razorpay fields, preserving existing main behavior.
    const razorpay = this.getRazorpayClient();
    if (!razorpay) {
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

    try {
      const razorpayOrder = await razorpay.orders.create({
        amount: finalAmount, // paise
        currency: 'INR',
        receipt: payment.id, // BePart payment ID as receipt for reconciliation
        notes: {
          paymentId: payment.id,
          eventId: dto.eventId.toString(),
          phone,
        },
      });

      await this.paymentsRepo.updatePaymentRazorpayOrderId(payment.id, razorpayOrder.id);

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
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: this.configService?.get<string>('RAZORPAY_KEY_ID'),
        createdAt: payment.createdAt,
      };
    } catch (error) {
      // Keep DB consistent: no orphan PENDING payment if the gateway call fails.
      await this.paymentsRepo.deletePayment(payment.id);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to create Razorpay order: ${errorMessage}`);
    }
  }

  /**
   * Verify a Razorpay checkout payment signature:
   * HMAC_SHA256(`${razorpay_order_id}|${razorpay_payment_id}`, key_secret).
   * On success the linked payment is marked PAID (webhook remains the
   * source of truth for registration fulfillment; this is idempotent).
   */
  async verifyPayment(dto: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = dto || ({} as any);
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new BadRequestException('razorpay_order_id, razorpay_payment_id and razorpay_signature are required');
    }
    const keySecret = this.getRazorpayKeySecret();
    if (!keySecret) throw new BadRequestException('Razorpay is not configured');

    const expected = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (
      razorpay_signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(razorpay_signature), Buffer.from(expected))
    ) {
      throw new BadRequestException('Transaction is not legit: invalid Razorpay signature');
    }

    const payment = await this.paymentsRepo.findPaymentByRazorpayOrderId(razorpay_order_id);
    if (!payment) throw new NotFoundException(`Payment not found for Razorpay Order ID: ${razorpay_order_id}`);

    if ((payment as any).status === PaymentStatus.PAID) {
      return { success: true, paymentId: (payment as any).id, alreadyPaid: true };
    }

    await this.paymentsRepo.updatePaymentStatusAtomic((payment as any).id, PaymentStatus.PAID, razorpay_payment_id);
    return { success: true, paymentId: (payment as any).id, orderId: razorpay_order_id, paymentIdRazorpay: razorpay_payment_id };
  }

  /**
   * Public Razorpay webhook handler (signature verified against the RAW body).
   * Handles order.paid / payment.captured / payment.failed and updates payment
   * status atomically (registration is fulfilled on PAID via the repo transaction).
   */
  async handleWebhook(rawBody: Buffer | any, signature: string) {
    if (!signature) throw new BadRequestException('Missing webhook signature');
    const webhookSecret = this.configService?.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) throw new BadRequestException('RAZORPAY_WEBHOOK_SECRET is not configured');

    let bodyString: string;
    if (Buffer.isBuffer(rawBody)) {
      bodyString = rawBody.toString('utf8');
    } else if (typeof rawBody === 'string') {
      bodyString = rawBody;
    } else if (typeof rawBody === 'object') {
      // Already parsed: signature cannot be verified reliably without the raw bytes.
      bodyString = JSON.stringify(rawBody);
    } else {
      throw new BadRequestException('Invalid request body format');
    }

    const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(bodyString).digest('hex');
    if (signature.length !== expectedSignature.length) {
      this.logger.warn('Rejected webhook: signature length mismatch');
      throw new BadRequestException('Invalid webhook signature');
    }
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      this.logger.warn('Rejected webhook: invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    let event: any;
    try {
      event = typeof rawBody === 'object' && !Buffer.isBuffer(rawBody) ? rawBody : JSON.parse(bodyString);
    } catch {
      throw new BadRequestException('Invalid JSON in webhook payload');
    }

    const eventType = event.event;
    const paymentEntity = event.payload?.payment?.entity;
    this.logger.log(
      `Razorpay webhook: event=${eventType} payment=${paymentEntity?.id ?? 'n/a'} ` +
        `order=${event.payload?.order?.entity?.id ?? paymentEntity?.order_id ?? 'n/a'} ` +
        `status=${paymentEntity?.status ?? 'n/a'}`,
    );

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      return this.handleSuccessfulWebhookPayment(event);
    }
    if (eventType === 'payment.failed') {
      return this.handleFailedWebhookPayment(event);
    }

    // Acknowledge unhandled events so Razorpay does not retry.
    this.logger.log(`Ignoring unsupported webhook event: ${eventType}`);
    return { received: true, processed: false, event: eventType };
  }

  private async handleSuccessfulWebhookPayment(event: any) {
    const orderEntity = event.payload?.order?.entity;
    const paymentEntity = event.payload?.payment?.entity;
    const razorpayOrderId = orderEntity?.id ?? paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;
    if (!razorpayOrderId) throw new BadRequestException('Missing order ID in webhook payload');

    const payment = await this.paymentsRepo.findPaymentByRazorpayOrderId(razorpayOrderId);
    if (!payment) throw new NotFoundException(`Payment not found for Razorpay Order ID: ${razorpayOrderId}`);
    if ((payment as any).status === PaymentStatus.PAID) {
      return { received: true, processed: false, message: 'Payment already marked as PAID' };
    }

    await this.paymentsRepo.updatePaymentStatusAtomic((payment as any).id, PaymentStatus.PAID, razorpayPaymentId ?? undefined);
    return { received: true, processed: true, paymentId: (payment as any).id };
  }

  private async handleFailedWebhookPayment(event: any) {
    const razorpayOrderId = event.payload?.payment?.entity?.order_id;
    const razorpayPaymentId = event.payload?.payment?.entity?.id;
    if (!razorpayOrderId) return { received: true, processed: false, message: 'No order ID in failed payment' };

    const payment = await this.paymentsRepo.findPaymentByRazorpayOrderId(razorpayOrderId);
    if (!payment) return { received: true, processed: false, message: 'Payment not found' };
    if ((payment as any).status === PaymentStatus.FAILED) {
      return { received: true, processed: false, message: 'Payment already marked as FAILED' };
    }
    // Never move a completed payment backwards.
    if ((payment as any).status === PaymentStatus.PAID) {
      return { received: true, processed: false, message: 'Payment already marked as PAID' };
    }

    await this.paymentsRepo.updatePaymentStatusAtomic((payment as any).id, PaymentStatus.FAILED, razorpayPaymentId ?? undefined);
    return { received: true, processed: true, paymentId: (payment as any).id, status: 'FAILED' };
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

  // Transaction listing: ADMIN sees all, ORGANIZER sees own events' payments.
  async findMine(userId: string, role: string) {
    if (role === 'ADMIN') return this.paymentsRepo.findAllPayments();
    const organizer = await this.paymentsRepo.findOrganizerByUserId(userId);
    if (!organizer) return [];
    return this.paymentsRepo.findByOrganizerId(organizer.id);
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
