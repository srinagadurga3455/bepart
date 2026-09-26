import { Test, TestingModule } from '@nestjs/testing';
import { CouponsService } from './coupons.service';
import { CouponsRepository } from './coupons.repo';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { CouponDiscountType } from '@prisma/client';

const mockCouponsRepo: any = {
  generateCode: jest.fn().mockReturnValue('PV7K2M9XQ4T8'),
  createUnique: jest.fn(),
  createFull: jest.fn(),
  findByCode: jest.fn(),
  findById: jest.fn(),
  findByEvent: jest.fn(),
  updateById: jest.fn(),
  deleteById: jest.fn(),
  markUsed: jest.fn(),
  findByStudentAndEvent: jest.fn(),
};

const mockPrisma: any = {
  event: { findUnique: jest.fn() },
  organizer: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  coupon: { findFirst: jest.fn() },
};

const adminActor: any = { userId: 'admin1', role: 'ADMIN' };
const orgActor: any = { userId: 'orgUser1', role: 'ORGANIZER' };

describe('CouponsService', () => {
  let service: CouponsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: CouponsRepository, useValue: mockCouponsRepo },
        { provide: require('../database/prisma.service').PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(CouponsService);
  });

  it('should generate secure unpredictable coupon code (PV + 10 chars)', async () => {
    const code = mockCouponsRepo.generateCode();
    expect(code).toMatch(/^PV[A-HJ-NP-Z2-9]{10}$/);
  });

  it('real generator should produce unique unpredictable codes within max length', async () => {
    const { CouponsRepository } = require('./coupons.repo');
    const repo = new CouponsRepository(null as any);
    const codes = new Set(Array.from({ length: 50 }, () => repo.generateCode()));
    expect(codes.size).toBe(50);
    for (const code of codes) {
      expect(code).toMatch(/^PV[A-HJ-NP-Z2-9]{10}$/);
      expect(code.length).toBeLessThanOrEqual(32);
    }
  });

  it('should create coupon for YES+ Club event (no student required)', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event1' });
    mockPrisma.coupon.findFirst.mockResolvedValue(null);
    mockCouponsRepo.createFull.mockResolvedValue({
      id: 'c1',
      code: 'AB1234567',
      eventId: 'event1',
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
      isUsed: false,
    });
    const res = await service.create({
      eventId: 'event1',
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
    });
    expect(res.code).toBe('AB1234567');
    expect(mockCouponsRepo.createFull).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'event1' }));
  });

  it('should create coupon with expiry', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event1' });
    mockCouponsRepo.createFull.mockResolvedValue({
      id: 'c2',
      code: 'CD7654321',
      eventId: 'event1',
      discountType: CouponDiscountType.FIXED,
      discountValue: 5000,
      isUsed: false,
      expiresAt: new Date('2025-12-31'),
    });
    const res = await service.create({
      eventId: 'event1',
      discountType: CouponDiscountType.FIXED,
      discountValue: 5000,
      expiresAt: '2025-12-31T23:59:59.000Z',
    });
    expect(res.code).toBe('CD7654321');
  });

  it('should validate coupon correctly for valid coupon', async () => {
    const coupon = {
      id: 'c1',
      code: 'AB1234567',
      eventId: 'event1',
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
      isUsed: false,
      expiresAt: new Date(Date.now() + 3600000),
    };
    mockCouponsRepo.findByCode.mockResolvedValue(coupon);
    const res = await service.validateCoupon('AB1234567', 'event1', '9123456789', true);
    expect(res.code).toBe('AB1234567');
  });

  it('should reject invalid coupon code', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue(null);
    await expect(service.validateCoupon('INVALID', 'event1', '9123456789', true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject wrong event', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1',
      code: 'AB1234567',
      eventId: 'event1',
      isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
    });
    await expect(service.validateCoupon('AB1234567', 'event2', '9123456789', true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject already used coupon', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1',
      code: 'AB1234567',
      eventId: 'event1',
      isUsed: true,
    });
    await expect(service.validateCoupon('AB1234567', 'eventId', '9123456789', true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject expired coupon', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1',
      code: 'AB1234567',
      eventId: 'event1',
      isUsed: false,
      expiresAt: new Date(Date.now() - 3600000),
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
    });
    await expect(service.validateCoupon('AB1234567', 'event1', '9123456789', true)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should allow any student for generic coupon (no student lock)', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1',
      code: 'AB1234567',
      eventId: 'event1',
      isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE,
      discountValue: 10,
    });
    const res = await service.validateCoupon('AB1234567', 'event1', '9999999999', true);
    expect(res.code).toBe('AB1234567');
  });

  it('should calculate discount correctly for PERCENTAGE', async () => {
    const coupon = { discountType: CouponDiscountType.PERCENTAGE, discountValue: 10 };
    const final = service.calculateDiscountedAmount(10000, coupon);
    expect(final).toBe(9000); // 10% off 10000
  });

  it('should calculate discount correctly for FIXED', async () => {
    const coupon = { discountType: CouponDiscountType.FIXED, discountValue: 5000 };
    const final = service.calculateDiscountedAmount(10000, coupon);
    expect(final).toBe(5000);
  });

  it('should not allow negative final amount', async () => {
    const coupon = { discountType: CouponDiscountType.FIXED, discountValue: 20000 };
    const final = service.calculateDiscountedAmount(10000, coupon);
    expect(final).toBe(0);
  });
});

describe('CouponsService - organizer coupons & redemption rules', () => {
  let service: CouponsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        { provide: CouponsRepository, useValue: mockCouponsRepo },
        { provide: require('../database/prisma.service').PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = mod.get(CouponsService);
  });

  const ownEvent = { id: 'event1', organizerId: 'org1' };

  it('organizer creates coupon for their own event (custom code normalized)', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(ownEvent);
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', userId: 'orgUser1' });
    mockCouponsRepo.createFull.mockResolvedValue({ id: 'c1', code: 'AICLUB20', eventId: 'event1' });
    const res = await service.create(
      { eventId: 'event1', code: 'aiclub20', discountType: CouponDiscountType.PERCENTAGE, discountValue: 20 } as any,
      orgActor,
    );
    expect(mockCouponsRepo.createFull).toHaveBeenCalledWith(expect.objectContaining({ code: 'AICLUB20', eventId: 'event1' }));
    expect(res.code).toBe('AICLUB20');
  });

  it('organizer cannot create coupon for another organizer event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event2', organizerId: 'org2' });
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', userId: 'orgUser1' });
    await expect(service.create(
      { eventId: 'event2', discountType: CouponDiscountType.PERCENTAGE, discountValue: 10 } as any, orgActor,
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockCouponsRepo.createFull).not.toHaveBeenCalled();
  });

  it('duplicate coupon code is rejected with 409', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(ownEvent);
    mockCouponsRepo.createFull.mockRejectedValue({ code: 'P2002' });
    await expect(service.create(
      { eventId: 'event1', code: 'AICLUB20', discountType: CouponDiscountType.PERCENTAGE, discountValue: 10 } as any, adminActor,
    )).rejects.toBeInstanceOf(ConflictException);
  });

  it('percentage greater than 100 is rejected', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(ownEvent);
    await expect(service.create(
      { eventId: 'event1', discountType: CouponDiscountType.PERCENTAGE, discountValue: 101 } as any, adminActor,
    )).rejects.toThrow(/between 1 and 100/);
  });

  it('invalid fixed discount (zero) is rejected', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(ownEvent);
    await expect(service.create(
      { eventId: 'event1', discountType: CouponDiscountType.FIXED, discountValue: 0 } as any, adminActor,
    )).rejects.toThrow(/>= 1/);
  });

  it('expiresAt before startsAt is rejected', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(ownEvent);
    await expect(service.create({
      eventId: 'event1', discountType: CouponDiscountType.PERCENTAGE, discountValue: 10,
      startsAt: '2026-12-31T00:00:00.000Z', expiresAt: '2026-01-01T00:00:00.000Z',
    } as any, adminActor)).rejects.toThrow(/before startsAt/);
  });

  it('lookup is case-insensitive (aiclub20 == AICLUB20)', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'AICLUB20', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 20, expiresAt: null, startsAt: null, usageLimit: null, usedCount: 0,
    });
    const res = await service.validateForRedemption('aiclub20', 'event1');
    expect(mockCouponsRepo.findByCode).toHaveBeenCalledWith('AICLUB20');
    expect(res.code).toBe('AICLUB20');
  });

  it('20% on Rs1000 quotes 100000 -> 20000 -> 80000', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'CLUB20', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 20, expiresAt: null, startsAt: null, usageLimit: null, usedCount: 0,
    });
    const q = await service.priceQuote('CLUB20', 'event1', 100000);
    expect(q).toEqual({ originalAmount: 100000, discountAmount: 20000, totalAmount: 80000, coupon: { id: 'c1', code: 'CLUB20' } });
  });

  it('100% percentage zeroes the total without going negative', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'FREE100', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 100, expiresAt: null, startsAt: null, usageLimit: null, usedCount: 0,
    });
    const q = await service.priceQuote('FREE100', 'event1', 100000);
    expect(q.totalAmount).toBe(0);
  });

  it('fixed discount larger than price clamps total to 0', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'BIGOFF', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.FIXED, discountValue: 200000, expiresAt: null, startsAt: null, usageLimit: null, usedCount: 0,
    });
    const q = await service.priceQuote('BIGOFF', 'event1', 100000);
    expect(q.totalAmount).toBe(0);
    expect(q.discountAmount).toBe(100000);
  });

  it('coupon for another event is rejected', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'CLUB20', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 20, expiresAt: null, startsAt: null, usageLimit: null, usedCount: 0,
    });
    await expect(service.priceQuote('CLUB20', 'event2', 100000)).rejects.toThrow('Coupon not valid for this event');
  });

  it('inactive coupon is rejected', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'CLUB20', eventId: 'event1', isActive: false, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 20, expiresAt: null, startsAt: null, usageLimit: null, usedCount: 0,
    });
    await expect(service.priceQuote('CLUB20', 'event1', 100000)).rejects.toThrow('Coupon is inactive');
  });

  it('coupon before startsAt is rejected', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'CLUB20', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 20, expiresAt: null,
      startsAt: new Date(Date.now() + 3600000), usageLimit: null, usedCount: 0,
    });
    await expect(service.priceQuote('CLUB20', 'event1', 100000)).rejects.toThrow('not active yet');
  });

  it('exhausted usage limit is rejected', async () => {
    mockCouponsRepo.findByCode.mockResolvedValue({
      id: 'c1', code: 'CLUB20', eventId: 'event1', isActive: true, isUsed: false,
      discountType: CouponDiscountType.PERCENTAGE, discountValue: 20, expiresAt: null, startsAt: null, usageLimit: 10, usedCount: 10,
    });
    await expect(service.priceQuote('CLUB20', 'event1', 100000)).rejects.toThrow('usage limit reached');
  });

  it('consumeAtomic increments usage atomically and rejects when exhausted', async () => {
    const tx: any = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', isActive: true, startsAt: null, expiresAt: null, usageLimit: 2, usedCount: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    tx.coupon.findUnique.mockResolvedValueOnce({ id: 'c1', isActive: true, startsAt: null, expiresAt: null, usageLimit: 2, usedCount: 1 })
      .mockResolvedValueOnce({ id: 'c1', usageLimit: 2, usedCount: 2, isUsed: false });
    await service.consumeAtomic(tx, 'c1');
    expect(tx.coupon.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', usedCount: { lt: 2 } },
      data: { usedCount: { increment: 1 } },
    });

    const txFull: any = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue({ id: 'c1', isActive: true, startsAt: null, expiresAt: null, usageLimit: 2, usedCount: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn(),
      },
    };
    await expect(service.consumeAtomic(txFull, 'c1')).rejects.toThrow('usage limit reached');
  });
});
