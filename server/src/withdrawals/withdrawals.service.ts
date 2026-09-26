import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { CreateWithdrawalDto, UPI_ID_PATTERN } from './dto/create-withdrawal.dto';
import {
  WITHDRAWAL_OPEN_STATUSES,
  WithdrawalDb,
  WithdrawalsRepository,
} from './withdrawals.repo';

export interface WithdrawalBalance {
  /** Collected PAID revenue for the event, Int paise. */
  revenue: number;
  /** Amount locked by REQUESTED/PROCESSING withdrawals, Int paise. */
  reserved: number;
  /** Amount already paid out, Int paise. */
  paidOut: number;
  /** revenue - reserved - paidOut, Int paise. */
  available: number;
  openCount: number;
}

interface WithdrawalView {
  id: string;
  eventId: string;
  amount: number;
  upiId: string;
  status: WithdrawalStatus;
  transactionId: string | null;
  proofUrl: string | null;
  rejectionReason: string | null;
  requestedAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizerId: string;
  event?: { eventName?: string | null } | null;
}

export interface WithdrawalResponse {
  id: string;
  eventId: string;
  eventName: string | null;
  amount: number;
  upiId: string;
  status: WithdrawalStatus;
  transactionId: string | null;
  proofUrl: string | null;
  rejectionReason: string | null;
  requestedAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizerId: string;
}

function formatPaise(paise: number): string {
  return `\u20B9${(paise / 100).toFixed(2)}`;
}

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly repo: WithdrawalsRepository,
    private readonly storageService: StorageService,
  ) {}

  private toResponse(w: WithdrawalView): WithdrawalResponse {
    return {
      id: w.id,
      eventId: w.eventId,
      eventName: w.event?.eventName ?? null,
      amount: w.amount,
      upiId: w.upiId,
      status: w.status,
      transactionId: w.transactionId,
      proofUrl: w.proofUrl,
      rejectionReason: w.rejectionReason,
      requestedAt: w.requestedAt,
      paidAt: w.paidAt,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      organizerId: w.organizerId,
    };
  }

  private async computeBalance(db: WithdrawalDb, eventId: string): Promise<WithdrawalBalance> {
    const [revenue, rows] = await Promise.all([
      this.repo.paidRevenueForEvent(db, eventId),
      this.repo.findWithdrawalsForEvent(db, eventId),
    ]);
    let reserved = 0;
    let paidOut = 0;
    let openCount = 0;
    for (const row of rows) {
      if (row.status === WithdrawalStatus.PAID) {
        paidOut += row.amount;
      } else if (WITHDRAWAL_OPEN_STATUSES.includes(row.status)) {
        reserved += row.amount;
        openCount += 1;
      }
      // REJECTED releases its reservation: excluded from both totals.
    }
    return { revenue, reserved, paidOut, available: revenue - reserved - paidOut, openCount };
  }

  private async requireApprovedOrganizer(userId: string) {
    const organizer = await this.repo.findOrganizerByUserId(this.repo.db, userId);
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    if (organizer.status !== 'APPROVED') {
      throw new ForbiddenException(
        `Only APPROVED organizers can manage withdrawals (current: ${organizer.status})`,
      );
    }
    return organizer;
  }

  async create(dto: CreateWithdrawalDto, userId: string): Promise<WithdrawalResponse> {
    const organizer = await this.requireApprovedOrganizer(userId);

    const upiId = dto.upiId?.trim() || organizer.upiId?.trim() || '';
    if (!upiId) {
      throw new BadRequestException('UPI ID is required to request a withdrawal');
    }
    if (!UPI_ID_PATTERN.test(upiId)) {
      throw new BadRequestException('Invalid UPI ID format (expected name@bank)');
    }
    if (!Number.isInteger(dto.amount) || dto.amount < 1) {
      throw new BadRequestException('Amount must be a positive integer in paise');
    }

    // Serializable transaction: balance check + insert are atomic, so two
    // concurrent requests cannot both spend the same available balance.
    // Prisma surfaces serialization failures as P2034.
    try {
      return await this.repo.transaction(async (tx) => {
        const event = await this.repo.findEventById(tx, dto.eventId);
        if (!event) throw new NotFoundException('Event not found');
        if (event.organizerId !== organizer.id) {
          throw new ForbiddenException('You do not own this event');
        }
        if (!event.paymentRequired) {
          throw new BadRequestException('Withdrawals are only allowed for paid events');
        }
        const balance = await this.computeBalance(tx, dto.eventId);
        if (balance.revenue <= 0) {
          throw new BadRequestException('No paid revenue collected for this event yet');
        }
        if (balance.openCount > 0) {
          throw new ConflictException('A withdrawal request for this event is already open');
        }
        if (dto.amount > balance.available) {
          throw new BadRequestException(
            `Amount exceeds available balance (${formatPaise(balance.available)} available)`,
          );
        }
        const created = await this.repo.create(tx, {
          amount: dto.amount,
          upiId,
          organizerId: organizer.id,
          eventId: event.id,
        });
        return this.toResponse(created);
      }, 'Serializable');
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException(
          'Concurrent withdrawal request detected. Please retry.',
        );
      }
      throw err;
    }
  }

  async findMine(userId: string): Promise<WithdrawalResponse[]> {
    const organizer = await this.requireApprovedOrganizer(userId);
    const rows = await this.repo.findManyByOrganizerId(organizer.id);
    return rows.map((w) => this.toResponse(w));
  }

  async findAll(): Promise<WithdrawalResponse[]> {
    const rows = await this.repo.findAll();
    return rows.map((w) => this.toResponse(w));
  }

  async findOne(id: string, userId: string, role: string): Promise<WithdrawalResponse> {
    const withdrawal = await this.repo.findById(id);
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (role !== 'ADMIN') {
      const organizer = await this.requireApprovedOrganizer(userId);
      if (withdrawal.organizerId !== organizer.id) {
        throw new ForbiddenException('You can only view your own withdrawals');
      }
    }
    return this.toResponse(withdrawal);
  }

  async findByEvent(
    eventId: string,
    userId: string,
    role: string,
  ): Promise<{ event: { id: string; eventName: string }; balance: WithdrawalBalance; withdrawals: WithdrawalResponse[] }> {
    const event = await this.repo.findEventById(this.repo.db, eventId);
    if (!event) throw new NotFoundException('Event not found');
    if (role !== 'ADMIN') {
      const organizer = await this.requireApprovedOrganizer(userId);
      if (event.organizerId !== organizer.id) {
        throw new ForbiddenException('You can only view withdrawals for your own events');
      }
    }
    const [balance, rows] = await Promise.all([
      this.computeBalance(this.repo.db, eventId),
      this.repo.findManyByEventId(eventId),
    ]);
    return {
      event: { id: event.id, eventName: event.eventName },
      balance,
      withdrawals: rows.map((w) => this.toResponse(w)),
    };
  }

  /** Atomic conditional transition; distinguishes "not found" from "wrong state". */
  private async transitionOrThrow(
    id: string,
    from: WithdrawalStatus[],
    data: Prisma.WithdrawalUpdateInput,
    action: string,
  ): Promise<WithdrawalResponse> {
    const res = await this.repo.transitionState(this.repo.db, id, from, data);
    if (res.count > 0) {
      const updated = await this.repo.findById(id);
      if (!updated) throw new NotFoundException('Withdrawal not found');
      return this.toResponse(updated);
    }
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Withdrawal not found');
    throw new BadRequestException(`Cannot ${action} withdrawal in status ${existing.status}`);
  }

  async process(id: string): Promise<WithdrawalResponse> {
    return this.transitionOrThrow(
      id,
      [WithdrawalStatus.REQUESTED],
      { status: WithdrawalStatus.PROCESSING },
      'process',
    );
  }

  async reject(id: string, reason: string): Promise<WithdrawalResponse> {
    const rejectionReason = reason?.trim() || '';
    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }
    if (rejectionReason.length > 500) {
      throw new BadRequestException('Rejection reason must be at most 500 characters');
    }
    // REJECTED rows are excluded from reserved balance, so the organizer can
    // request the released amount again.
    return this.transitionOrThrow(
      id,
      [WithdrawalStatus.REQUESTED, WithdrawalStatus.PROCESSING],
      { status: WithdrawalStatus.REJECTED, rejectionReason },
      'reject',
    );
  }

  async pay(id: string, transactionId: string, proofUrl?: string): Promise<WithdrawalResponse> {
    const txn = transactionId?.trim() || '';
    if (!txn) {
      throw new BadRequestException('Transaction ID is required before marking as paid');
    }
    const proof = proofUrl?.trim() || '';
    if (!proof) {
      throw new BadRequestException('Payment proof URL is required before marking as paid');
    }
    const duplicate = await this.repo.findTransactionIdDuplicate(this.repo.db, txn, id);
    if (duplicate) {
      throw new ConflictException('Transaction ID has already been used for another withdrawal');
    }
    return this.transitionOrThrow(
      id,
      [WithdrawalStatus.PROCESSING],
      { status: WithdrawalStatus.PAID, transactionId: txn, proofUrl: proof, paidAt: new Date() },
      'mark as paid',
    );
  }

  async confirmPaid(
    id: string,
    transactionId: string,
    screenshot?: Express.Multer.File,
  ): Promise<WithdrawalResponse> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException('Withdrawal not found');
    if (existing.status !== WithdrawalStatus.PROCESSING) {
      throw new BadRequestException(
        `Only PROCESSING withdrawals can be marked paid (current: ${existing.status})`,
      );
    }
    const txn = transactionId?.trim() || '';
    if (!txn) {
      throw new BadRequestException('Transaction ID is required before marking as paid');
    }
    if (!screenshot || !screenshot.buffer?.length) {
      throw new BadRequestException('Payment screenshot is required before marking as paid');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(screenshot.mimetype)) {
      throw new BadRequestException(
        `Invalid screenshot type ${screenshot.mimetype}. Allowed: jpeg, png, webp`,
      );
    }
    const maxBytes = 5 * 1024 * 1024;
    if (screenshot.size > maxBytes) {
      throw new BadRequestException(
        `Screenshot too large: ${screenshot.size} bytes. Maximum 5 MB`,
      );
    }
    const duplicate = await this.repo.findTransactionIdDuplicate(this.repo.db, txn, id);
    if (duplicate) {
      throw new ConflictException('Transaction ID has already been used for another withdrawal');
    }
    const { url } = await this.storageService.uploadProof(screenshot, existing.id);
    return this.transitionOrThrow(
      id,
      [WithdrawalStatus.PROCESSING],
      { status: WithdrawalStatus.PAID, transactionId: txn, proofUrl: url, paidAt: new Date() },
      'mark as paid',
    );
  }

  // Returns file bytes for local proofs (auth + ownership enforced by caller context).
  async proofContent(
    id: string,
    userId: string,
    role: string,
  ): Promise<{ buffer: Buffer; mimetype: string } | { redirectUrl: string }> {
    const withdrawal = await this.findOne(id, userId, role);
    if (role !== 'ADMIN' && withdrawal.status !== WithdrawalStatus.PAID) {
      throw new ForbiddenException('Payment proof is available after the withdrawal is paid');
    }
    if (!withdrawal.proofUrl) throw new NotFoundException('No payment proof for this withdrawal');
    if (withdrawal.proofUrl.startsWith('local://')) {
      return this.storageService.readLocalFile(withdrawal.proofUrl);
    }
    return { redirectUrl: withdrawal.proofUrl };
  }
}
