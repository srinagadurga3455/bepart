import { Injectable } from '@nestjs/common';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export const WITHDRAWAL_OPEN_STATUSES: WithdrawalStatus[] = [
  WithdrawalStatus.REQUESTED,
  WithdrawalStatus.PROCESSING,
];

/** Minimal surface of Prisma client / transaction client used by withdrawals. */
export type WithdrawalDb = Prisma.TransactionClient;

const withdrawalDetailInclude = {
  event: { select: { id: true, eventName: true, date: true, status: true } },
  organizer: { select: { id: true, name: true, email: true, phone: true, upiId: true } },
} satisfies Prisma.WithdrawalInclude;

export type WithdrawalDetail = Prisma.WithdrawalGetPayload<{
  include: typeof withdrawalDetailInclude;
}>;

const withdrawalCreateInclude = {
  event: { select: { id: true, eventName: true } },
  organizer: { select: { id: true, name: true } },
} satisfies Prisma.WithdrawalInclude;

export type WithdrawalCreated = Prisma.WithdrawalGetPayload<{
  include: typeof withdrawalCreateInclude;
}>;

@Injectable()
export class WithdrawalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Non-transactional client for single-statement reads/writes. */
  get db(): WithdrawalDb {
    return this.prisma;
  }

  /** Interactive transaction. Serializable callers use it for create (balance check + insert). */
  transaction<T>(
    fn: (tx: WithdrawalDb) => Promise<T>,
    isolationLevel?: Prisma.TransactionIsolationLevel,
  ): Promise<T> {
    return isolationLevel
      ? this.prisma.$transaction(fn, { isolationLevel })
      : this.prisma.$transaction(fn);
  }

  findOrganizerByUserId(db: WithdrawalDb, userId: string) {
    return db.organizer.findUnique({ where: { userId } });
  }

  findEventById(db: WithdrawalDb, id: string) {
    return db.event.findUnique({ where: { id } });
  }

  /** Source of truth for collected revenue: sum of PAID payment amounts (Int paise). */
  async paidRevenueForEvent(db: WithdrawalDb, eventId: string): Promise<number> {
    const agg = await db.payment.aggregate({
      _sum: { amount: true },
      where: {
        status: 'PAID',
        OR: [{ eventId }, { registration: { eventId } }],
      },
    });
    return agg._sum.amount ?? 0;
  }

  findWithdrawalsForEvent(db: WithdrawalDb, eventId: string) {
    return db.withdrawal.findMany({
      where: { eventId },
      select: { id: true, amount: true, status: true },
    });
  }

  create(
    db: WithdrawalDb,
    data: { amount: number; upiId: string; organizerId: string; eventId: string },
  ): Promise<WithdrawalCreated> {
    return db.withdrawal.create({
      data,
      include: {
        event: { select: { id: true, eventName: true } },
        organizer: { select: { id: true, name: true } },
      },
    });
  }

  findManyByOrganizerId(organizerId: string): Promise<WithdrawalDetail[]> {
    return this.prisma.withdrawal.findMany({
      where: { organizerId },
      include: withdrawalDetailInclude,
      orderBy: { requestedAt: 'desc' },
    });
  }

  findManyByEventId(eventId: string): Promise<WithdrawalDetail[]> {
    return this.prisma.withdrawal.findMany({
      where: { eventId },
      include: withdrawalDetailInclude,
      orderBy: { requestedAt: 'desc' },
    });
  }

  findAll(): Promise<WithdrawalDetail[]> {
    return this.prisma.withdrawal.findMany({
      include: withdrawalDetailInclude,
      orderBy: { requestedAt: 'desc' },
    });
  }

  findById(id: string): Promise<WithdrawalDetail | null> {
    return this.prisma.withdrawal.findUnique({
      where: { id },
      include: withdrawalDetailInclude,
    });
  }

  /** Atomic state transition: updates only when the row is in an expected state. Returns rows touched. */
  transitionState(
    db: WithdrawalDb,
    id: string,
    from: WithdrawalStatus[],
    data: Prisma.WithdrawalUpdateInput,
  ) {
    return db.withdrawal.updateMany({
      where: { id, status: { in: from } },
      data,
    });
  }

  findTransactionIdDuplicate(db: WithdrawalDb, transactionId: string, excludeId: string) {
    return db.withdrawal.findFirst({
      where: { transactionId, status: WithdrawalStatus.PAID, id: { not: excludeId } },
      select: { id: true },
    });
  }
}
