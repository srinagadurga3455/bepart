import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentStatus } from '@prisma/client';
import { buildTicketUrl, frontendBaseUrl } from '../tickets/tickets.repo';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRegistrationWithEvent(registrationId: string) {
    return this.prisma.registration.findUnique({
      where: { registrationId },
      include: { event: true },
    });
  }

  findPaymentById(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { registration: { include: { event: true } } },
    });
  }

  findPaymentByRegistrationId(registrationId: string) {
    return this.prisma.payment.findUnique({
      where: { registrationId },
      include: { registration: true },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId } });
  }

  findEventById(id: string) {
    return this.prisma.event.findUnique({ where: { id } });
  }

  findPendingPaymentByPhoneAndEvent(phone: string,  eventId: string) {
    return this.prisma.payment.findFirst({ where: { phone, eventId, status: PaymentStatus.PENDING } });
  }

  findRegistrationByPhoneAndEvent(phone: string,  eventId: string) {
    return this.prisma.registration.findFirst({ where: { phone, eventId } });
  }

  // Payment.eventId is a LOOSE scalar field (no Prisma relation), so event
  // details ride along via registration->event plus an explicit batch lookup
  // for pending payments that carry only eventId.
  // Preserved from product UX/registration improvements (transaction listing).
  private paymentListInclude() {
    return {
      registration: {
        select: {
          registrationId: true,
          phone: true,
          paymentStatus: true,
          event: { select: { id: true, eventName: true, date: true, organizerId: true } },
        },
      },
      coupon: { select: { id: true, code: true } },
    };
  }

  private async attachEvents(payments: any[]) {
    const ids = [...new Set(payments.map((p) => p.eventId).filter(Boolean))];
    const byId = new Map<string, any>();
    if (ids.length > 0) {
      const evts = await this.prisma.event.findMany({
        where: { id: { in: ids } },
        select: { id: true, eventName: true, date: true, organizerId: true },
      });
      for (const e of evts) byId.set(e.id, e);
    }
    return payments.map((p) => ({
      ...p,
      event: (p.eventId && byId.get(p.eventId)) || p.registration?.event || null,
    }));
  }

  // Organizer transaction listing: payments for events owned by the organizer.
  // Payment.eventId is a loose field (no Prisma relation), so scope by the
  // organizer's event IDs plus the registration->event ownership path.
  async findByOrganizerId(organizerId: string) {
    const events = await this.prisma.event.findMany({ where: { organizerId }, select: { id: true } });
    const ids = events.map((e) => e.id);
    if (ids.length === 0) return [];
    const payments = await this.prisma.payment.findMany({
      where: { OR: [{ eventId: { in: ids } }, { registration: { event: { organizerId } } }] },
      include: this.paymentListInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return this.attachEvents(payments);
  }

  async findAllPayments() {
    const payments = await this.prisma.payment.findMany({
      include: this.paymentListInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return this.attachEvents(payments);
  }

  createPendingPayment(data: { phone: string;  eventId: string; amount: number; status?: PaymentStatus; couponId?: string | null; couponCode?: string | null; originalAmount?: number | null; discountAmount?: number | null; pendingFormData?: any }) {
    return this.prisma.payment.create({
      data: {
        phone: data.phone,
        eventId: data.eventId,
        amount: data.amount,
        status: data.status ?? PaymentStatus.PENDING,
        couponId: (data as any).couponId || null,
        couponCode: (data as any).couponCode || null,
        originalAmount: (data as any).originalAmount ?? data.amount,
        discountAmount: (data as any).discountAmount ?? 0,
        pendingFormData: (data as any).pendingFormData ?? null,
      },
    });
  }

  createPayment(data: { registrationId: string; amount: number; status?: PaymentStatus }) {
    return this.prisma.payment.create({
      data: {
        registrationId: data.registrationId,
        amount: data.amount,
        status: data.status ?? PaymentStatus.PENDING,
      },
      include: { registration: true },
    });
  }

  findPaymentByRazorpayOrderId(razorpayOrderId: string) {
    return this.prisma.payment.findFirst({
      where: { razorpayOrderId },
      include: { registration: true },
    });
  }

  updatePaymentRazorpayOrderId(paymentId: string, razorpayOrderId: string) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { razorpayOrderId },
    });
  }

  deletePayment(paymentId: string) {
    return this.prisma.payment.delete({ where: { id: paymentId } });
  }

  updatePaymentStatusAtomic(id: string, status: PaymentStatus, razorpayPaymentId?: string | null) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize concurrent webhook deliveries for the same payment.
      // Razorpay sends order.paid and payment.captured almost simultaneously;
      // without this row lock both transactions could observe PENDING and
      // create duplicate registrations.
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`;

      const existing = await tx.payment.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Payment not found');

      const paymentStatusUpdate: any = {
        status,
        ...(razorpayPaymentId === undefined ? {} : { razorpayPaymentId }),
      };

      // If payment is pending and holds formData (paid event flow) and is becoming PAID.
      // A previously FAILED payment may still complete via a later successful
      // attempt on the same Razorpay order, so FAILED -> PAID must also fulfill
      // the registration. PAID payments are idempotent (handled by callers).
      const hasPendingData = (existing as any).pendingFormData !== null && (existing as any).pendingFormData !== undefined;
      const isPendingPaymentFlow =
        !existing.registrationId &&
        hasPendingData &&
        (existing as any).eventId &&
        (existing as any).phone &&
        (existing.status === 'PENDING' || (existing as any).status === 'FAILED');

      if (isPendingPaymentFlow && status === 'PAID') {
        // Prevent duplicate registration
        const duplicate = await tx.registration.findFirst({
          where: { eventId: (existing as any).eventId, phone: (existing as any).phone },
        });
        if (duplicate) throw new ConflictException('Phone already registered for this event');

        // Validate slots/closingTime before creating registration
        const event = await tx.event.findUnique({ where: { id: (existing as any).eventId } });
        if (!event) throw new NotFoundException('Event not found');
        if ((event as any).status !== 'PUBLISHED') throw new BadRequestException('Event is not published');
        const now = new Date();
        if (event.closingTime && now > event.closingTime) throw new BadRequestException('Registration closed');
        const count = await tx.registration.count({ where: { eventId: event.id } });
        if (count >= event.slots) throw new BadRequestException(`Event slots full`);

        const registration = await tx.registration.create({
          data: {
            phone: (existing as any).phone,
            eventId: (existing as any).eventId,
            formData: (existing as any).pendingFormData as any,
            paymentStatus: 'PAID' as any,
          },
        });

        // Paid fulfillment completes the registration, so it gets its ticket in
        // the SAME transaction. upsert keeps replays (webhook + manual
        // confirm) idempotent: never two tickets for one registration.
        const ticketCode = randomUUID();
        await tx.ticket.upsert({
          where: { registrationId: registration.registrationId },
          create: {
            code: ticketCode,
            registrationId: registration.registrationId,
            eventId: (existing as any).eventId,
            ticketUrl: buildTicketUrl(frontendBaseUrl(), ticketCode),
            qrToken: randomUUID(),
            status: 'VALID' as any,
          },
          update: {},
        });

        await tx.payment.update({
          where: { id },
          data: { ...paymentStatusUpdate, registrationId: registration.registrationId },
        });
        return tx.payment.findUnique({ where: { id }, include: { registration: true } });
      }

      // Normal flow: payment already linked to registration
      const payment = await tx.payment.update({
        where: { id },
        data: { ...paymentStatusUpdate },
      });
      if (payment.registrationId) {
        await tx.registration.update({
          where: { registrationId: payment.registrationId },
          data: { paymentStatus: status },
        });
      }
      return tx.payment.findUnique({
        where: { id },
        include: { registration: true },
      });
    });
  }
}
