import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CouponDiscountType } from '@prisma/client';

const GENERATED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

@Injectable()
export class CouponsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Secure unpredictable code (e.g. PV7K2M9XQ4T8): `PV` prefix + 10
   * crypto-random unambiguous chars (no 0/O/1/I). Uniqueness is enforced by
   * the DB unique constraint with caller-side retry on collision.
   */
  generateCode(): string {
    let suffix = '';
    for (let i = 0; i < 10; i++) {
      suffix += GENERATED_ALPHABET.charAt(randomInt(GENERATED_ALPHABET.length));
    }
    return `PV${suffix}`;
  }

  /** Legacy format generator (kept for backward-compatible tests/tools). */
  generateLegacyCode(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < 2; i++) {
      code += letters.charAt(randomInt(letters.length));
    }
    for (let i = 0; i < 7; i++) {
      code += digits.charAt(randomInt(digits.length));
    }
    return code;
  }

  async createUnique(data: {
    eventId: string;
    studentId?: string | null;
    phone?: string | null;
    discountType: CouponDiscountType;
    discountValue: number;
    expiresAt?: Date | null;
  }) {
    // Ensure unique code with retry
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode();
      try {
        return await this.prisma.coupon.create({
          data: {
            code,
            eventId: data.eventId,
            studentId: data.studentId || null,
            phone: data.phone || null,
            discountType: data.discountType,
            discountValue: data.discountValue,
            expiresAt: data.expiresAt,
          },
        });
      } catch (e: any) {
        if (e.code === 'P2002') continue; // unique violation, retry
        throw e;
      }
    }
    throw new Error('Failed to generate unique coupon code');
  }

  createFull(data: {
    code: string;
    eventId: string;
    discountType: CouponDiscountType;
    discountValue: number;
    isActive?: boolean;
    startsAt?: Date | null;
    expiresAt?: Date | null;
    usageLimit?: number | null;
  }) {
    return this.prisma.coupon.create({
      data: {
        code: data.code,
        eventId: data.eventId,
        discountType: data.discountType,
        discountValue: data.discountValue,
        isActive: data.isActive ?? true,
        startsAt: data.startsAt ?? null,
        expiresAt: data.expiresAt ?? null,
        usageLimit: data.usageLimit ?? null,
      },
    });
  }

  findByEvent(eventId: string) {
    return this.prisma.coupon.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } });
  }

  /** Lightweight flag for event responses: does the event have an active coupon? */
  async hasActiveCouponForEvent(eventId: string): Promise<boolean> {
    const row = await this.prisma.coupon.findFirst({
      where: { eventId, isActive: true },
      select: { id: true },
    });
    return row !== null;
  }

  updateById(id: string, data: any) {
    const clean: any = {};
    for (const [k, v] of Object.entries(data)) if (v !== undefined) clean[k] = v;
    return this.prisma.coupon.update({ where: { id }, data: clean });
  }

  deleteById(id: string) {
    return this.prisma.coupon.delete({ where: { id } });
  }

  findByCode(code: string) {
    return this.prisma.coupon.findUnique({ where: { code }, include: { event: true, student: true } });
  }

  findById(id: string) {
    return this.prisma.coupon.findUnique({ where: { id } });
  }

  markUsed(id: string) {
    return this.prisma.coupon.update({
      where: { id },
      data: { isUsed: true, usedAt: new Date() },
    });
  }

  findByStudentAndEvent(studentId: string, eventId: string) {
    return this.prisma.coupon.findFirst({ where: { studentId, eventId } });
  }
}
