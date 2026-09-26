import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponsRepository } from './coupons.repo';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { PrismaService } from '../database/prisma.service';
import { isCouponExpired } from './coupon-expiry.util';
import { Role } from '../common/constants/roles';

export interface CouponActor {
  userId: string;
  role: string;
}

export interface PriceQuote {
  originalAmount: number;
  discountAmount: number;
  totalAmount: number;
  coupon: { id: string; code: string };
}

const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

@Injectable()
export class CouponsService {
  constructor(
    private readonly couponsRepo: CouponsRepository,
    private readonly prisma: PrismaService,
  ) {}

  /** Normalize user-supplied code: trim + uppercase (case-insensitive lookup). */
  static normalizeCode(input: unknown): string {
    const code = typeof input === 'string' ? input.trim().toUpperCase() : '';
    if (!CODE_PATTERN.test(code)) {
      throw new BadRequestException('Invalid coupon code format. Use 3-32 chars: letters, digits, - or _ (e.g. AICLUB20)');
    }
    return code;
  }

  /** Validate discount values. Percentage 1-100, FIXED > 0 (paise). */
  static assertValidDiscount(discountType: string, discountValue: number) {
    if (!Number.isInteger(discountValue) || discountValue < 1) {
      throw new BadRequestException('discountValue must be an integer >= 1');
    }
    if (discountType === 'PERCENTAGE' && discountValue > 100) {
      throw new BadRequestException('Percentage discount must be between 1 and 100');
    }
  }

  /**
   * ONE authoritative backend calculation (integer paise, no floats).
   * Final amount is clamped at 0 so a discount can never make the total negative.
   */
  static quote(originalAmount: number, coupon: { discountType: string; discountValue: number }): Omit<PriceQuote, 'coupon'> {
    if (!Number.isInteger(originalAmount) || originalAmount < 1) {
      throw new BadRequestException('originalAmount must be an integer >= 1 (in paise)');
    }
    let discount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discount = Math.floor((originalAmount * coupon.discountValue) / 100);
    } else {
      discount = coupon.discountValue;
    }
    const totalAmount = Math.max(0, originalAmount - discount);
    return { originalAmount, discountAmount: originalAmount - totalAmount, totalAmount };
  }

  /** Validate an optional startsAt/expiresAt window. Throws 400 on invalid dates or inverted range. */
  static assertValidWindow(startsAt?: string | null, expiresAt?: string | null): { startsAt: Date | null; expiresAt: Date | null } {
    let start: Date | null = null;
    let end: Date | null = null;
    if (startsAt) {
      start = new Date(startsAt);
      if (isNaN(start.getTime())) throw new BadRequestException('Invalid startsAt');
    }
    if (expiresAt) {
      end = new Date(expiresAt);
      if (isNaN(end.getTime())) throw new BadRequestException('Invalid expiresAt');
    }
    if (start && end && end < start) {
      throw new BadRequestException('expiresAt must not be before startsAt');
    }
    return { startsAt: start, expiresAt: end };
  }

  /** Organizer ownership: the actor's organizer profile must own the event. ADMIN bypasses. */
  private async assertEventOwnership(eventId: string, actor?: CouponActor) {
    if (!actor || actor.role === Role.ADMIN || (actor.role as string) === 'ADMIN') return;
    if (actor.role !== Role.ORGANIZER && (actor.role as string) !== 'ORGANIZER') {
      throw new ForbiddenException('Only organizers can manage coupons');
    }
    const organizer = await this.prisma.organizer.findUnique({ where: { userId: actor.userId } });
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (!organizer || event.organizerId !== organizer.id) {
      throw new ForbiddenException('You can only manage coupons for your own events');
    }
  }

  async create(dto: CreateCouponDto, actor?: CouponActor) {
    const event = await this.prisma.event.findUnique({ where: { id: dto.eventId } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertEventOwnership(dto.eventId, actor);
    CouponsService.assertValidDiscount(dto.discountType, dto.discountValue);

    let startsAt: Date | null = null;
    let expiresAt: Date | null = null;
    if (dto.startsAt) {
      startsAt = new Date(dto.startsAt);
      if (isNaN(startsAt.getTime())) throw new BadRequestException('Invalid startsAt');
    }
    if (dto.expiresAt) {
      expiresAt = new Date(dto.expiresAt);
      if (isNaN(expiresAt.getTime())) throw new BadRequestException('Invalid expiresAt');
    }
    if (startsAt && expiresAt && expiresAt < startsAt) {
      throw new BadRequestException('expiresAt must not be before startsAt');
    }

    const code = dto.code ? CouponsService.normalizeCode(dto.code) : this.couponsRepo.generateCode();
    const payload = {
      eventId: dto.eventId,
      discountType: dto.discountType as any,
      discountValue: dto.discountValue,
      isActive: dto.isActive ?? true,
      startsAt,
      expiresAt,
      usageLimit: dto.usageLimit ?? null,
    };
    try {
      return await this.couponsRepo.createFull({ ...payload, code });
    } catch (e: any) {
      if (e?.code !== 'P2002' || dto.code) throw e?.code === 'P2002' ? new ConflictException('Coupon code already exists') : e;
      // Auto-generated code collided (astronomically rare): retry with fresh codes.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          return await this.couponsRepo.createFull({ ...payload, code: this.couponsRepo.generateCode() });
        } catch (retryErr: any) {
          if (retryErr?.code !== 'P2002') throw retryErr;
        }
      }
      throw new ConflictException('Coupon code already exists');
    }
  }

  async listForEvent(eventId: string, actor?: CouponActor) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    await this.assertEventOwnership(eventId, actor);
    return this.couponsRepo.findByEvent(eventId);
  }

  async update(couponId: string, dto: UpdateCouponDto, actor?: CouponActor) {
    const existing = await this.couponsRepo.findById(couponId);
    if (!existing) throw new NotFoundException('Coupon not found');
    await this.assertEventOwnership(existing.eventId, actor);

    const discountType = dto.discountType ?? existing.discountType;
    const discountValue = dto.discountValue ?? existing.discountValue;
    CouponsService.assertValidDiscount(discountType as string, discountValue);

    const startsAt = dto.startsAt === undefined ? undefined : dto.startsAt ? new Date(dto.startsAt) : null;
    const expiresAt = dto.expiresAt === undefined ? undefined : dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (startsAt instanceof Date && isNaN(startsAt.getTime())) throw new BadRequestException('Invalid startsAt');
    if (expiresAt instanceof Date && isNaN(expiresAt.getTime())) throw new BadRequestException('Invalid expiresAt');
    const finalStarts = startsAt === undefined ? existing.startsAt : startsAt;
    const finalExpires = expiresAt === undefined ? existing.expiresAt : expiresAt;
    if (finalStarts && finalExpires && finalExpires < finalStarts) {
      throw new BadRequestException('expiresAt must not be before startsAt');
    }
    return this.couponsRepo.updateById(couponId, {
      discountType: dto.discountType as any,
      discountValue: dto.discountValue,
      isActive: dto.isActive,
      startsAt,
      expiresAt,
      usageLimit: dto.usageLimit === undefined ? undefined : dto.usageLimit,
    });
  }

  async remove(couponId: string, actor?: CouponActor) {
    const existing = await this.couponsRepo.findById(couponId);
    if (!existing) throw new NotFoundException('Coupon not found');
    await this.assertEventOwnership(existing.eventId, actor);
    // Payments/registrations reference the coupon with SetNull, and registrations
    // keep a couponCode/amount snapshot, so history survives deletion.
    return this.couponsRepo.deleteById(couponId);
  }

  /**
   * Full redemption validation for an event. The coupon CODE is the eligibility
   * mechanism (organizers share it privately with intended members). No club,
   * phone, or WhatsApp checks are performed here by design.
   */
  async validateForRedemption(rawCode: string, eventId: string) {
    const code = CouponsService.normalizeCode(rawCode);
    const coupon = await this.couponsRepo.findByCode(code);
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (coupon.eventId !== eventId) throw new BadRequestException('Coupon not valid for this event');
    if (coupon.isActive === false) throw new BadRequestException('Coupon is inactive');
    if ((coupon as any).startsAt && Date.now() < new Date((coupon as any).startsAt).getTime()) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (isCouponExpired(coupon.expiresAt as any)) throw new BadRequestException('Coupon expired');
    const usageLimit = (coupon as any).usageLimit as number | null;
    const usedCount = ((coupon as any).usedCount as number) ?? 0;
    if (usageLimit != null && usedCount >= usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (usageLimit == null && coupon.isUsed) throw new BadRequestException('Coupon already used');
    return coupon;
  }

  /** Validate + price in one step. Used by payments and registration preview. */
  async priceQuote(rawCode: string, eventId: string, originalAmount: number): Promise<PriceQuote> {
    const coupon = await this.validateForRedemption(rawCode, eventId);
    const amounts = CouponsService.quote(originalAmount, coupon as any);
    return { ...amounts, coupon: { id: coupon.id, code: coupon.code } };
  }

  /**
   * Atomically consume one redemption inside the caller's Prisma transaction.
   * Uses an atomic guarded increment so concurrent registrations cannot exceed
   * usageLimit. Legacy single-use coupons (no usageLimit) flip isUsed once.
   */
  async consumeAtomic(tx: any, couponId: string, opts?: { phone?: string; studentId?: string }) {
    const coupon = await tx.coupon.findUnique({ where: { id: couponId } });
    if (!coupon) throw new BadRequestException('Invalid coupon code');
    if (coupon.isActive === false) throw new BadRequestException('Coupon is inactive');
    if (coupon.startsAt && Date.now() < new Date(coupon.startsAt).getTime()) {
      throw new BadRequestException('Coupon is not active yet');
    }
    if (isCouponExpired(coupon.expiresAt)) throw new BadRequestException('Coupon expired');

    if (coupon.usageLimit != null) {
      const updated = await tx.coupon.updateMany({
        where: { id: couponId, usedCount: { lt: coupon.usageLimit } },
        data: { usedCount: { increment: 1 } },
      });
      if (updated.count === 0) throw new ConflictException('Coupon usage limit reached');
      const fresh = await tx.coupon.findUnique({ where: { id: couponId } });
      if (fresh && fresh.usedCount >= (fresh.usageLimit ?? Number.MAX_SAFE_INTEGER) && !fresh.isUsed) {
        await tx.coupon.update({ where: { id: couponId }, data: { isUsed: true, usedAt: new Date() } });
      }
      return fresh ?? coupon;
    }

    if (coupon.isUsed) throw new ConflictException('Coupon already used');
    return tx.coupon.update({
      where: { id: couponId },
      data: {
        isUsed: true,
        usedAt: new Date(),
        phone: opts?.phone ?? coupon.phone,
        studentId: opts?.studentId ?? coupon.studentId,
      },
    });
  }

  // ---- Legacy methods (kept for backward compatibility) ----

  async validateCoupon(code: string, eventId: string, phoneOrStudentId?: string, isPhone: boolean = true) {
    void phoneOrStudentId;
    void isPhone;
    return this.validateForRedemption(code, eventId);
  }

  calculateDiscountedAmount(originalAmount: number, coupon: any): number {
    return CouponsService.quote(originalAmount, coupon).totalAmount;
  }

  async markUsed(couponId: string) {
    return this.couponsRepo.markUsed(couponId);
  }

  async findByCode(code: string) {
    return this.couponsRepo.findByCode(code);
  }
}
