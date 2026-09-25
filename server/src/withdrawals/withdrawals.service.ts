import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { WithdrawalStatus } from '@prisma/client';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

const OPEN_STATUSES: WithdrawalStatus[] = [WithdrawalStatus.REQUESTED, WithdrawalStatus.PROCESSING];

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  // Fee comes ONLY from the event's existing config (no invented pricing).
  private eventFee(event: any): number {
    if (!event?.paymentRequired) return 0;
    const amount = Number(event?.formStructure?.payment?.amount);
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  private async financeForEvent(eventId: number) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    const fee = this.eventFee(event);
    const regCount = await this.prisma.registration.count({ where: { eventId } });
    const collected = regCount * fee;
    const withdrawals = await this.prisma.withdrawal.findMany({ where: { eventId } });
    const open = withdrawals.filter((w) => OPEN_STATUSES.includes(w.status));
    const paidTotal = withdrawals.filter((w) => w.status === WithdrawalStatus.PAID).reduce((s, w) => s + w.amount, 0);
    const openTotal = open.reduce((s, w) => s + w.amount, 0);
    return { event, fee, regCount, collected, openTotal, paidTotal, available: collected - openTotal - paidTotal, open };
  }

  private async requireApprovedOrganizer(userId: string) {
    const organizer = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!organizer) throw new NotFoundException('Organizer profile not found');
    if (organizer.status !== 'APPROVED') {
      throw new ForbiddenException(`Only APPROVED organizers can manage withdrawals (current: ${organizer.status})`);
    }
    return organizer;
  }

  async create(dto: CreateWithdrawalDto, userId: string) {
    const organizer = await this.requireApprovedOrganizer(userId);
    const fin = await this.financeForEvent(dto.eventId);
    if ((fin.event as any).organizerId !== organizer.id) {
      throw new ForbiddenException('You do not own this event');
    }
    if (fin.fee <= 0) throw new BadRequestException('This event has no registration fee configured');
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Amount must be greater than zero');
    if (fin.open.length > 0) throw new ConflictException('A withdrawal request for this event is already open');
    if (amount - fin.available > 1e-9) {
      throw new BadRequestException(`Amount exceeds available balance (₹${fin.available})`);
    }
    if (!organizer.upiId) throw new BadRequestException('No UPI ID on file for this organizer');
    return this.prisma.withdrawal.create({
      data: {
        amount,
        upiId: organizer.upiId,
        organizerId: organizer.id,
        eventId: fin.event.id,
      },
      include: {
        event: { select: { id: true, eventName: true } },
        organizer: { select: { id: true, name: true } },
      },
    });
  }

  async findMine(userId: string) {
    const organizer = await this.requireApprovedOrganizer(userId);
    return this.prisma.withdrawal.findMany({
      where: { organizerId: organizer.id },
      include: { event: { select: { id: true, eventName: true, date: true, status: true } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.withdrawal.findMany({
      include: {
        organizer: { select: { id: true, name: true, email: true, phone: true, upiId: true } },
        event: { select: { id: true, eventName: true, date: true, status: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, role: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: {
        organizer: { select: { id: true, name: true, email: true, phone: true, upiId: true } },
        event: { select: { id: true, eventName: true, date: true, status: true } },
      },
    });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (role !== 'ADMIN') {
      const organizer = await this.requireApprovedOrganizer(userId);
      if (withdrawal.organizerId !== organizer.id) {
        throw new ForbiddenException('You can only view your own withdrawals');
      }
    }
    return withdrawal;
  }

  async process(id: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (withdrawal.status !== WithdrawalStatus.REQUESTED) {
      throw new BadRequestException(`Only REQUESTED withdrawals can be processed (current: ${withdrawal.status})`);
    }
    return this.prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.PROCESSING } });
  }

  async reject(id: string) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (!OPEN_STATUSES.includes(withdrawal.status)) {
      throw new BadRequestException(`Only open withdrawals can be rejected (current: ${withdrawal.status})`);
    }
    return this.prisma.withdrawal.update({ where: { id }, data: { status: WithdrawalStatus.REJECTED } });
  }

  async confirmPaid(id: string, transactionId: string, screenshot?: Express.Multer.File) {
    const withdrawal = await this.prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw new NotFoundException('Withdrawal not found');
    if (!OPEN_STATUSES.includes(withdrawal.status)) {
      throw new BadRequestException(`Only open withdrawals can be marked paid (current: ${withdrawal.status})`);
    }
    if (!transactionId || !transactionId.trim()) {
      throw new BadRequestException('Transaction ID is required before marking as paid');
    }
    if (!screenshot || !screenshot.buffer?.length) {
      throw new BadRequestException('Payment screenshot is required before marking as paid');
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(screenshot.mimetype)) {
      throw new BadRequestException(`Invalid screenshot type ${screenshot.mimetype}. Allowed: jpeg, png, webp`);
    }
    const maxBytes = 5 * 1024 * 1024;
    if (screenshot.size > maxBytes) {
      throw new BadRequestException(`Screenshot too large: ${screenshot.size} bytes. Maximum 5 MB`);
    }
    const { url } = await this.storageService.uploadProof(screenshot, withdrawal.id);
    return this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: WithdrawalStatus.PAID,
        transactionId: transactionId.trim(),
        proofUrl: url,
        paidAt: new Date(),
      },
    });
  }

  // Returns file bytes for local proofs (auth + ownership enforced by caller context).
  async proofContent(id: string, userId: string, role: string): Promise<{ buffer: Buffer; mimetype: string } | { redirectUrl: string }> {
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
