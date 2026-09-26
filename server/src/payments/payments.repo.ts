import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentStatus } from '@prisma/client';

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
      include: {
        registration: {
          include: { event: true },
        },
      },
    });
  }

  findPaymentByRegistrationId(registrationId: string) {
    return this.prisma.payment.findUnique({
      where: { registrationId },
      include: { registration: true },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  findEventById(id: number) {
    return this.prisma.event.findUnique({
      where: { id },
    });
  }

  findPendingPaymentByPhoneAndEvent(
    phone: string,
    eventId: number,
  ) {
    return this.prisma.payment.findFirst({
      where: {
        phone,
        eventId,
        status: PaymentStatus.PENDING,
      },
    });
  }

  findRegistrationByPhoneAndEvent(
    phone: string,
    eventId: number,
  ) {
    return this.prisma.registration.findFirst({
      where: {
        phone,
        eventId,
      },
    });
  }

  createPendingPayment(data: {
    phone: string;
    eventId: number;
    amount: number;
    status?: PaymentStatus;
    pendingFormData?: any;
  }) {
    return this.prisma.payment.create({
      data: {
        phone: data.phone,
        eventId: data.eventId,
        amount: data.amount,
        status: data.status ?? PaymentStatus.PENDING,
        pendingFormData: data.pendingFormData ?? null,
      },
    });
  }

  updatePaymentRazorpayOrderId(
    paymentId: string,
    razorpayOrderId: string,
  ) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        razorpayOrderId,
      },
    });
  }

  findPaymentByRazorpayOrderId(
    razorpayOrderId: string,
  ) {
    return this.prisma.payment.findFirst({
      where: {
        razorpayOrderId,
      },
      include: {
        registration: true,
      },
    });
  }

  updatePaymentWithRazorpayPayment(
    paymentId: string,
    razorpayPaymentId: string | null,
    status: PaymentStatus,
  ) {
    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        razorpayPaymentId,
        status,
      },
    });
  }

  deletePayment(paymentId: string) {
    return this.prisma.payment.delete({
      where: { id: paymentId },
    });
  }

  createPayment(data: {
    registrationId: string;
    amount: number;
    status?: PaymentStatus;
  }) {
    return this.prisma.payment.create({
      data: {
        registrationId: data.registrationId,
        amount: data.amount,
        status:
          data.status ?? PaymentStatus.PENDING,
      },
      include: {
        registration: true,
      },
    });
  }

  updatePaymentStatusAtomic(
    id: string,
    status: PaymentStatus,
    razorpayPaymentId?: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      /*
       * Serialize concurrent deliveries for the same payment.
       * Razorpay sends order.paid and payment.captured almost
       * simultaneously; without this row lock both transactions can
       * observe PENDING and create duplicate registrations.
       * The second transaction blocks here until the first commits,
       * then observes the updated status below.
       */
      await tx.$queryRaw`SELECT id FROM payments WHERE id = ${id} FOR UPDATE`;

      const existing = await tx.payment.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new NotFoundException(
          'Payment not found',
        );
      }

      const paymentStatusUpdate = {
        status,
        ...(razorpayPaymentId === undefined
          ? {}
          : { razorpayPaymentId }),
      };

      /*
       * Pending payment flow:
       * Payment has no registration yet,
       * but contains phone, eventId and form data.
       * A previously FAILED payment may still be completed by a later
       * successful attempt on the same Razorpay order, so it must also
       * fulfill the registration when it transitions to PAID.
       */
      const hasPendingData =
        existing.pendingFormData != null;

      const isPendingPaymentFlow =
        existing.registrationId == null &&
        hasPendingData &&
        existing.eventId != null &&
        existing.phone != null &&
        (existing.status === PaymentStatus.PENDING ||
          existing.status === PaymentStatus.FAILED);

      /*
       * Successful payment:
       * create the registration.
       */
      if (
        isPendingPaymentFlow &&
        status === PaymentStatus.PAID
      ) {
        const eventId = existing.eventId!;
        const phone = existing.phone!;

        /*
         * Prevent duplicate registration.
         */
        const duplicate =
          await tx.registration.findFirst({
            where: {
              eventId,
              phone,
            },
          });

        if (duplicate) {
          await tx.payment.update({
            where: { id },
            data: {
              ...paymentStatusUpdate,
              registrationId:
                duplicate.registrationId,
            },
          });

          return tx.payment.findUnique({
            where: { id },
            include: {
              registration: true,
            },
          });
        }

        /*
         * Get event.
         */
        const event =
          await tx.event.findUnique({
            where: {
              id: eventId,
            },
          });

        if (!event) {
          throw new NotFoundException(
            'Event not found',
          );
        }

        if (event.status !== 'PUBLISHED') {
          throw new BadRequestException(
            'Event is not published',
          );
        }

        /*
         * Check closing time.
         */
        if (
          event.closingTime &&
          new Date() > event.closingTime
        ) {
          throw new BadRequestException(
            'Registration closed',
          );
        }

        /*
         * Check slots.
         */
        const registrationCount =
          await tx.registration.count({
            where: {
              eventId,
            },
          });

        if (
          registrationCount >= event.slots
        ) {
          throw new BadRequestException(
            'Event slots full',
          );
        }

        /*
         * Create registration.
         *
         * `as any` is intentional here because
         * pendingFormData is stored as Prisma Json.
         */
        const registration =
          await tx.registration.create({
            data: {
              phone,
              eventId,
              formData:
                existing.pendingFormData as any,

              // Keep this compatible with the
              // existing generated Prisma types.
              paymentStatus:
                PaymentStatus.PAID as any,
            },
          });

        /*
         * Link payment to registration.
         */
        await tx.payment.update({
          where: { id },
          data: {
            ...paymentStatusUpdate,
            registrationId:
              registration.registrationId,
          },
        });

        return tx.payment.findUnique({
          where: { id },
          include: {
            registration: true,
          },
        });
      }

      /*
       * Normal payment flow.
       */
      const payment =
        await tx.payment.update({
          where: { id },
          data: {
            ...paymentStatusUpdate,
          },
        });

      /*
       * Update linked registration.
       */
      if (payment.registrationId) {
        await tx.registration.update({
          where: {
            registrationId:
              payment.registrationId,
          },
          data: {
            paymentStatus:
              status as any,
          },
        });
      }

      return tx.payment.findUnique({
        where: { id },
        include: {
          registration: true,
        },
      });
    });
  }
}