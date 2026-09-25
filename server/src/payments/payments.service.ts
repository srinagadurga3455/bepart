import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repo';
import { PaymentStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePendingPaymentDto } from './dto/create-pending-payment.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { RequestUser } from '../common/types/jwt-payload';
import { canonicalPhone } from '../common/utils/phone';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepo: PaymentsRepository) {}

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

    const payment = await this.paymentsRepo.createPendingPayment({
      phone,
      eventId: dto.eventId,
      amount: dto.amount,
      status: PaymentStatus.PENDING,
    });

    return {
      id: payment.id,
      phone: payment.phone,
      eventId: payment.eventId,
      amount: payment.amount,
      status: payment.status,
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

  async updateStatus(id: string, dto: UpdatePaymentStatusDto) {
    const existing = await this.paymentsRepo.findPaymentById(id);
    if (!existing) throw new NotFoundException('Payment not found');
    if (!Object.values(PaymentStatus).includes(dto.status as PaymentStatus)) {
      throw new BadRequestException(`Invalid status: ${dto.status}. Allowed: PENDING, PAID, FAILED`);
    }
    const updated = await this.paymentsRepo.updatePaymentStatusAtomic(id, dto.status as PaymentStatus);
    return updated;
  }
}
