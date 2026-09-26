import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsRepository } from './payments.repo';
import { PaymentStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { RequestUser } from '../common/types/jwt-payload';
import { canonicalPhone } from '../common/utils/phone';
const Razorpay = require('razorpay');

@Injectable()
export class PaymentsService {
  private razorpay: any;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly configService: ConfigService,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>('RAZORPAY_KEY_ID'),
      key_secret: this.configService.get<string>('RAZORPAY_SECRET'),
    });
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

    // Create Payment record in database first
    const payment = await this.paymentsRepo.createPendingPayment({
      phone,
      eventId: dto.eventId,
      amount: dto.amount,
      status: PaymentStatus.PENDING,
      pendingFormData: (dto as any).pendingFormData || null,
    });

    // Create Razorpay Order
    try {
      const razorpayOrder = await this.razorpay.orders.create({
        amount: dto.amount, // Amount in paise
        currency: 'INR',
        receipt: payment.id, // Use Bepart Payment ID as receipt
        notes: {
          paymentId: payment.id,
          eventId: dto.eventId.toString(),
          phone: phone,
        },
      });

      // Update Payment record with Razorpay Order ID
      await this.paymentsRepo.updatePaymentRazorpayOrderId(payment.id, razorpayOrder.id);

      return {
        id: payment.id,
        phone: payment.phone,
        eventId: payment.eventId,
        amount: payment.amount,
        status: payment.status,
        razorpayOrderId: razorpayOrder.id,
        razorpayKeyId: this.configService.get<string>('RAZORPAY_KEY_ID'),
        createdAt: payment.createdAt,
      };
    } catch (error) {
      // If Razorpay order creation fails, delete the Payment record to maintain consistency
      await this.paymentsRepo.deletePayment(payment.id);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Failed to create Razorpay order: ${errorMessage}`);
    }
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

  async updateStatus(id: string, dto: UpdatePaymentStatusDto) {
    const existing = await this.paymentsRepo.findPaymentById(id);
    if (!existing) throw new NotFoundException('Payment not found');
    if (!Object.values(PaymentStatus).includes(dto.status as PaymentStatus)) {
      throw new BadRequestException(`Invalid status: ${dto.status}. Allowed: PENDING, PAID, FAILED`);
    }
    const updated = await this.paymentsRepo.updatePaymentStatusAtomic(id, dto.status as PaymentStatus);
    return updated;
  }

  async handleWebhook(rawBody: Buffer | any, signature: string) {
    // Validate required parameters
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }

    const webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
    }
    
    // Get raw body as string for signature verification
    let bodyString: string;
    if (Buffer.isBuffer(rawBody)) {
      bodyString = rawBody.toString('utf8');
    } else if (typeof rawBody === 'string') {
      bodyString = rawBody;
    } else if (typeof rawBody === 'object') {
      // If body was already parsed, we cannot verify signature properly
      // This should not happen with rawBody: true configuration
      bodyString = JSON.stringify(rawBody);
    } else {
      throw new BadRequestException('Invalid request body format');
    }

    // Verify webhook signature using raw body
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyString)
      .digest('hex');

    // Timing-safe comparison - ensure both are same length to prevent timing attacks
    if (signature.length !== expectedSignature.length) {
      this.logger.warn('Rejected webhook: signature length mismatch');
      throw new BadRequestException('Invalid webhook signature');
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      this.logger.warn('Rejected webhook: invalid signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // Parse the body after signature verification
    let event: any;
    try {
      event = typeof rawBody === 'object' && !Buffer.isBuffer(rawBody) 
        ? rawBody 
        : JSON.parse(bodyString);
    } catch (error) {
      throw new BadRequestException('Invalid JSON in webhook payload');
    }

    const eventType = event.event;

    // Safe observability only: event type plus Razorpay object IDs.
    // Never log secrets, signatures, raw bodies, or customer form data.
    const paymentEntity = event.payload?.payment?.entity;
    this.logger.log(
      '========================================\n' +
      'RAZORPAY WEBHOOK RECEIVED\n' +
      '========================================\n' +
      `Event: ${eventType}\n` +
      `Payment ID: ${paymentEntity?.id ?? 'n/a'}\n` +
      `Order ID: ${event.payload?.order?.entity?.id ?? paymentEntity?.order_id ?? 'n/a'}\n` +
      `Payment Status: ${paymentEntity?.status ?? 'n/a'}\n` +
      'Processing webhook...',
    );

    if (eventType === 'order.paid' || eventType === 'payment.captured') {
      const result = await this.handleSuccessfulPayment(event);
      this.logger.log(`Webhook processed successfully: ${JSON.stringify(result)}`);
      return result;
    } else if (eventType === 'payment.failed') {
      const result = await this.handlePaymentFailed(event);
      this.logger.log(`Webhook processed successfully: ${JSON.stringify(result)}`);
      return result;
    }

    // Return success for unhandled events to prevent Razorpay retries
    this.logger.log(`Ignoring unsupported webhook event: ${eventType}`);
    return { received: true, processed: false, event: eventType };
  }

  private async handleSuccessfulPayment(event: any) {
    const orderEntity = event.payload?.order?.entity;
    const paymentEntity = event.payload?.payment?.entity;
    const razorpayOrderId = orderEntity?.id ?? paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;

    if (!razorpayOrderId) {
      throw new BadRequestException('Missing order ID in webhook payload');
    }

    // Find payment by Razorpay Order ID
    const payment = await this.paymentsRepo.findPaymentByRazorpayOrderId(razorpayOrderId);
    if (!payment) {
      throw new NotFoundException(`Payment not found for Razorpay Order ID: ${razorpayOrderId}`);
    }

    // Idempotency check: if already paid, skip
    if (payment.status === PaymentStatus.PAID) {
      return { received: true, processed: false, message: 'Payment already marked as PAID' };
    }

    // Update the payment and create/link its registration in one transaction.
    await this.paymentsRepo.updatePaymentStatusAtomic(
      payment.id,
      PaymentStatus.PAID,
      razorpayPaymentId ?? undefined,
    );

    return { received: true, processed: true, paymentId: payment.id };
  }

  private async handlePaymentFailed(event: any) {
    const razorpayOrderId = event.payload?.payment?.entity?.order_id;
    const razorpayPaymentId = event.payload?.payment?.entity?.id;

    if (!razorpayOrderId) {
      // Some payment failures might not have order_id
      return { received: true, processed: false, message: 'No order ID in failed payment' };
    }

    // Find payment by Razorpay Order ID
    const payment = await this.paymentsRepo.findPaymentByRazorpayOrderId(razorpayOrderId);
    if (!payment) {
      // Payment not found, but don't throw error to prevent webhook retries
      return { received: true, processed: false, message: 'Payment not found' };
    }

    // Idempotency check: if already failed, skip
    if (payment.status === PaymentStatus.FAILED) {
      return { received: true, processed: false, message: 'Payment already marked as FAILED' };
    }

    // A completed payment must not be moved back to FAILED by a later failure event.
    if (payment.status === PaymentStatus.PAID) {
      return { received: true, processed: false, message: 'Payment already marked as PAID' };
    }

    // Update payment status to FAILED and store the Razorpay payment ID when available.
    await this.paymentsRepo.updatePaymentStatusAtomic(
      payment.id,
      PaymentStatus.FAILED,
      razorpayPaymentId ?? undefined,
    );

    return { received: true, processed: true, paymentId: payment.id, status: 'FAILED' };
  }
}
