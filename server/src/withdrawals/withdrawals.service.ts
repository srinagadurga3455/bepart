import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { NotificationsService, NotificationTypes } from '../notifications/notifications.service';
import { NotificationChannel } from '@prisma/client';
import { CreateWithdrawalDto, UPI_ID_PATTERN } from './dto/create-withdrawal.dto';
import {
  assertRupees,
  paiseToRupees,
  rupeesToPaise,
  toRupeesBalance,
} from '../common/utils/money';
import {
  WITHDRAWAL_OPEN_STATUSES,
  WithdrawalDb,
  WithdrawalsRepository,
} from './withdrawals.repo';

export interface WithdrawalBalance {
  /**
   * INTERNAL math is paise (matches stored Int columns). The API-facing
   * `findByEvent` balance is mapped to rupees via toRupeesBalance.
   */
  /** Collected PAID revenue for the event. */
  revenue: number;
  /** Amount locked by REQUESTED/PROCESSING withdrawals. */
  reserved: number;
  /** Amount already paid out. */
  paidOut: number;
  /** revenue - reserved - paidOut. */
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
  reviewedBy: string | null;
  reviewedAt: Date | null;
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
  reviewedBy: string | null;
  reviewedAt: Date | null;
  requestedAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizerId: string;
}

function formatRupees(rupees: number): string {
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Display paise storage as ₹ string for notification payloads. */
function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly repo: WithdrawalsRepository,
    private readonly storageService: StorageService,
    @Optional() private readonly emailService?: EmailService,
    @Optional() private readonly whatsappService?: WhatsappService,
    @Optional() private readonly notifications?: NotificationsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  /** Fire-and-forget safe: notification methods never throw; failures are audited, never rolled back. */
  private async notifySafely(kind: 'request' | 'success' | 'rejected', withdrawalId: string): Promise<void> {
    if (!this.whatsappService) return;
    try {
      if (kind === 'request') await this.whatsappService.notifyPayoutRequest(withdrawalId);
      else if (kind === 'success') await this.whatsappService.notifyPayoutSuccess(withdrawalId);
      else await this.whatsappService.notifyPayoutRejected(withdrawalId);
    } catch (e) {
      this.logger.warn(`Payout ${kind} notification failed for ${withdrawalId} (withdrawal kept): ${(e as Error)?.message}`);
    }
  }

  private toResponse(w: WithdrawalView): WithdrawalResponse {
    return {
      id: w.id,
      eventId: w.eventId,
      eventName: w.event?.eventName ?? null,
      // Stored paise -> API rupees.
      amount: paiseToRupees(w.amount),
      upiId: w.upiId,
      status: w.status,
      transactionId: w.transactionId,
      proofUrl: w.proofUrl,
      rejectionReason: w.rejectionReason,
      reviewedBy: (w as any).reviewedBy ?? null,
      reviewedAt: (w as any).reviewedAt ?? null,
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

  private adminWhatsappNumber(): string | null {
    const n = this.config?.get<string>('ADMIN_WHATSAPP_NUMBER')?.trim();
    return n || null;
  }

  private adminEmail(): string | null {
    const e = this.config?.get<string>('ADMIN_EMAIL')?.trim();
    return e && e.includes('@') ? e : null;
  }

  private adminReviewUrl(withdrawalId: string): string {
    const base = (this.config?.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    return `${base}/admin/withdrawals/${withdrawalId}`;
  }

  /** Full detail row (organizer contact + event) for notifications. Never throws. */
  private async notifyDetail(id: string): Promise<any | null> {
    try {
      return await this.repo.findById(id);
    } catch (err) {
      this.logger.warn(`Could not load withdrawal ${id} for notification: ${(err as Error)?.message}`);
      return null;
    }
  }

  private async notifyAdminOfRequest(id: string): Promise<void> {
    if (!this.notifications) return;
    try {
      const detail = await this.notifyDetail(id);
      if (!detail) return;
      const balance = await this.computeBalance(this.repo.db, detail.eventId);
      const reviewUrl = this.adminReviewUrl(id);
      const payload = {
        organizer: detail.organizer?.name ?? 'Organizer',
        event: detail.event?.eventName ?? 'Event',
        amount: formatPaise(detail.amount),
        availableBalance: formatPaise(balance.available),
        settlementId: id,
        reviewUrl,
      };
      const adminNumber = this.adminWhatsappNumber();
      if (adminNumber && this.whatsappService) {
        await this.notifications.sendOnce({
          type: NotificationTypes.SETTLEMENT_REQUEST_WHATSAPP,
          channel: NotificationChannel.WHATSAPP,
          recipient: adminNumber,
          entityType: 'withdrawal',
          entityId: id,
          sender: () => this.whatsappService!.sendSettlementRequestNotification({ to: adminNumber, ...payload }),
        });
      }
      const adminMail = this.adminEmail();
      if (adminMail && this.emailService) {
        await this.notifications.sendOnce({
          type: NotificationTypes.SETTLEMENT_REQUEST_EMAIL,
          channel: NotificationChannel.EMAIL,
          recipient: adminMail,
          entityType: 'withdrawal',
          entityId: id,
          sender: () =>
            this.emailService!.sendSettlementRequestedEmail({
              to: adminMail,
              organizerName: payload.organizer,
              eventName: payload.event,
              amount: payload.amount,
              availableBalance: payload.availableBalance,
              settlementId: id,
              reviewUrl,
            }),
        });
      }
    } catch (err) {
      this.logger.warn(`Admin settlement-request notification failed: ${(err as Error)?.message}`);
    }
  }

  private async notifyOrganizer(
    id: string,
    kind: 'approved' | 'rejected' | 'paid',
    extra?: { reason?: string; transactionId?: string; paidAt?: Date | null },
  ): Promise<void> {
    if (!this.notifications) return;
    try {
      const detail = await this.notifyDetail(id);
      if (!detail) return;
      const phone = detail.organizer?.phone?.trim() || null;
      const email = detail.organizer?.email?.trim() || null;
      const base = {
        organizer: detail.organizer?.name ?? 'Organizer',
        event: detail.event?.eventName ?? 'Event',
        amount: formatPaise(detail.amount),
        settlementId: id,
      };
      const typeBase =
        kind === 'approved'
          ? 'SETTLEMENT_APPROVED'
          : kind === 'rejected'
            ? 'SETTLEMENT_REJECTED'
            : 'SETTLEMENT_PAID';
      if (phone && this.whatsappService) {
        await this.notifications.sendOnce({
          type: NotificationTypes[`${typeBase}_WHATSAPP` as keyof typeof NotificationTypes],
          channel: NotificationChannel.WHATSAPP,
          recipient: phone,
          entityType: 'withdrawal',
          entityId: id,
          sender: () => {
            if (kind === 'approved') {
              return this.whatsappService!.sendSettlementApprovedNotification({ to: phone, ...base });
            }
            if (kind === 'rejected') {
              return this.whatsappService!.sendSettlementRejectedNotification({
                to: phone,
                ...base,
                reason: extra?.reason ?? '',
              });
            }
            return this.whatsappService!.sendSettlementPaidNotification({
              to: phone,
              amount: base.amount,
              utr: extra?.transactionId ?? '',
              paidAt: extra?.paidAt ? extra.paidAt.toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
              settlementId: id,
            });
          },
        });
      }
      if (email && email.includes('@') && this.emailService) {
        await this.notifications.sendOnce({
          type: NotificationTypes[`${typeBase}_EMAIL` as keyof typeof NotificationTypes],
          channel: NotificationChannel.EMAIL,
          recipient: email,
          entityType: 'withdrawal',
          entityId: id,
          sender: () => {
            const mailBase = { to: email, organizerName: base.organizer, eventName: base.event, amount: base.amount, settlementId: id };
            if (kind === 'approved') return this.emailService!.sendSettlementApprovedEmail(mailBase);
            if (kind === 'rejected') {
              return this.emailService!.sendSettlementRejectedEmail({ ...mailBase, reason: extra?.reason ?? '' });
            }
            return this.emailService!.sendSettlementPaidEmail({
              ...mailBase,
              utr: extra?.transactionId ?? '',
              paidAt: extra?.paidAt ? extra.paidAt.toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
            });
          },
        });
      }
    } catch (err) {
      this.logger.warn(`Organizer settlement notification failed: ${(err as Error)?.message}`);
    }
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
    // API speaks rupees (25000 = ₹25,000); storage + balance math speak paise.
    const amountPaise = rupeesToPaise(assertRupees(dto.amount));

    // Serializable transaction: balance check + insert are atomic, so two
    // concurrent requests cannot both spend the same available balance.
    // Prisma surfaces serialization failures as P2034.
    let created: WithdrawalResponse;
    try {
      created = await this.repo.transaction(async (tx) => {
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
        if (amountPaise > balance.available) {
          throw new BadRequestException(
            `Amount exceeds available balance (${formatRupees(paiseToRupees(balance.available))} available)`,
          );
        }
        const created = await this.repo.create(tx, {
          amount: amountPaise,
          upiId,
          organizerId: organizer.id,
          eventId: event.id,
        });
        return this.toResponse(created);
      }, 'Serializable');
      // Persisted first — the admin WhatsApp notification is a side effect
      // that must never roll back the request.
      await this.notifySafely('request', created.id);
      // Admin notification AFTER the settlement is saved (never blocks creation).
      await this.notifyAdminOfRequest(created.id);
      return created;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException(
          'Concurrent withdrawal request detected. Please retry.',
        );
      }
      throw err;
    }
    // Admin notification AFTER the settlement is saved (never blocks creation).
    await this.notifyAdminOfRequest(created.id);
    return created;
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

  async findAllPaged(page: number, limit: number) {
    const { data, meta } = await this.repo.findAllPaged(page, limit);
    return { data: data.map((w) => this.toResponse(w)), meta };
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
      // Internal paise balance -> API rupees.
      balance: toRupeesBalance(balance),
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

  async process(id: string, adminId?: string): Promise<WithdrawalResponse> {
    const res = await this.transitionOrThrow(
      id,
      [WithdrawalStatus.REQUESTED],
      { status: WithdrawalStatus.PROCESSING, reviewedBy: adminId ?? null, reviewedAt: new Date() },
      'process',
    );
    // REQUESTED -> PROCESSING is the admin approval: notify the organizer.
    await this.notifyOrganizer(id, 'approved');
    return res;
  }

  async reject(id: string, reason: string, adminId?: string): Promise<WithdrawalResponse> {
    const rejectionReason = reason?.trim() || '';
    if (!rejectionReason) {
      throw new BadRequestException('Rejection reason is required');
    }
    if (rejectionReason.length > 500) {
      throw new BadRequestException('Rejection reason must be at most 500 characters');
    }
    // REJECTED rows are excluded from reserved balance, so the organizer can
    // request the released amount again.
    const res = await this.transitionOrThrow(
      id,
      [WithdrawalStatus.REQUESTED, WithdrawalStatus.PROCESSING],
      { status: WithdrawalStatus.REJECTED, rejectionReason, reviewedBy: adminId ?? null, reviewedAt: new Date() },
      'reject',
    );
    await this.notifyOrganizer(id, 'rejected', { reason: rejectionReason });
    // Persisted first — the organizer WhatsApp notification is a side effect.
    await this.notifySafely('rejected', res.id);
    return res;
  }

  async pay(id: string, transactionId: string, proofUrl?: string, adminId?: string): Promise<WithdrawalResponse> {
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
    const paidAt = new Date();
    const res = await this.transitionOrThrow(
      id,
      [WithdrawalStatus.PROCESSING],
      { status: WithdrawalStatus.PAID, transactionId: txn, proofUrl: proof, paidAt, reviewedBy: adminId ?? null, reviewedAt: new Date() },
      'mark as paid',
    );
    await this.notifyOrganizer(id, 'paid', { transactionId: txn, paidAt });
    // Persisted first — the organizer WhatsApp notification is a side effect.
    await this.notifySafely('success', res.id);
    return res;
  }

  async confirmPaid(
    id: string,
    transactionId: string,
    screenshot?: Express.Multer.File,
    adminId?: string,
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
    const paidAt = new Date();
    const res = await this.transitionOrThrow(
      id,
      [WithdrawalStatus.PROCESSING],
      { status: WithdrawalStatus.PAID, transactionId: txn, proofUrl: url, paidAt, reviewedBy: adminId ?? null, reviewedAt: new Date() },
      'mark as paid',
    );
    await this.notifyOrganizer(id, 'paid', { transactionId: txn, paidAt });
    // Persisted first — the organizer WhatsApp notification (with the proof
    // image header when the URL is public) is a side effect.
    await this.notifySafely('success', res.id);
    return res;
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
