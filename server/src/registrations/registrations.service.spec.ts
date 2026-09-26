import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { RegistrationsRepository } from './registrations.repo';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('RegistrationsService - Updated Schema Int EventId', () => {
  let service: RegistrationsService;
  let mockTx: any;

  const mockRegistrationsRepo: any = {
    transaction: jest.fn((cb) => cb(mockTx)),
    findAll: jest.fn(),
    findByOrganizerId: jest.fn(),
    findByPhone: jest.fn(),
    findByRegistrationId: jest.fn(),
    findOrganizerByUserId: jest.fn(),
    findEventById: jest.fn(),
    findUserById: jest.fn(),
    deleteByRegistrationId: jest.fn(),
  };

  const mockCouponsService: any = {
    consumeAtomic: jest.fn().mockImplementation(async (tx: any, couponId: string) => ({ id: couponId })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx = {
      event: { findUnique: jest.fn() },
      registration: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
      payment: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      coupon: { findUnique: jest.fn() },
      user: { findFirst: jest.fn() },
    };
    mockRegistrationsRepo.findByRegistrationId = jest.fn();
    mockRegistrationsRepo.findOrganizerByUserId = jest.fn();
    mockRegistrationsRepo.findEventById = jest.fn();
    mockRegistrationsRepo.findUserById = jest.fn();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        { provide: RegistrationsRepository, useValue: mockRegistrationsRepo },
        { provide: require('../coupons/coupons.service').CouponsService, useValue: mockCouponsService },
      ],
    }).compile();
    service = mod.get(RegistrationsService);
  });

  it('should reject registration for unpublished event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'DRAFT', slots: 100, closingTime: new Date(Date.now() + 1000000) });
    await expect(service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject when closingTime passed', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() - 1000000) });
    await expect(service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject when slots full', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'PUBLISHED', slots: 5, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(5);
    await expect(service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should prevent duplicate phone per event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue({ registrationId: 'existing', phone: '+91 9999999999' });
    await expect(service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000' } as any)).rejects.toThrow(ConflictException);
  });

  it('should create registration with phone/formData and int eventId', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: false });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.registration.create.mockResolvedValue({ registrationId: 'r1', phone: '9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000', formData: { branch: 'CSE' } });
    const res = await service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000', formData: { branch: 'CSE' } } as any);
    expect(mockTx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: '9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000' }) }));
    expect(res.registrationId).toBe('r1');
  });

  it('should create registration directly for free event (paymentRequired=false)', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440010', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: false });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.registration.create.mockResolvedValue({ registrationId: 'rFree', phone: '8888888888', eventId: '550e8400-e29b-41d4-a716-446655440010', formData: { name: 'Free' } });
    const res = await service.create({ phone: '+91 8888888888', eventId: '550e8400-e29b-41d4-a716-446655440010', formData: { name: 'Free' } } as any);
    expect(mockTx.payment.create).not.toHaveBeenCalled();
    expect(mockTx.registration.create).toHaveBeenCalled();
    expect(res.registrationId).toBe('rFree');
  });

  it('should normalize phone variations to same canonical value', async () => {
    const { canonicalPhone } = await import('../common/utils/phone');
    expect(canonicalPhone('+91 9123456789')).toBe('9123456789');
    expect(canonicalPhone('+919123456789')).toBe('9123456789');
    expect(canonicalPhone('9123456789')).toBe('9123456789');
    expect(canonicalPhone('+91-9123456789')).toBe('9123456789');
    expect(canonicalPhone('(912) 345-6789')).toBe('9123456789');
  });

  it('should allow paid registration with any phone format if PAID payment exists with canonical match', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440017', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    // Payment stored as canonical 9123456789, lookup with +91 9123456789 should find it
    mockTx.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'PAID', phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', registrationId: null });
    mockTx.registration.create.mockResolvedValue({ registrationId: 'rPaid', phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', formData: {}, paymentStatus: 'PAID' });
    mockTx.payment.update = jest.fn().mockResolvedValue({});
    const res1: any = await service.create({ phone: '+91 9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', formData: {} } as any);
    expect(res1.registrationId).toBe('rPaid');
    // Also test with +919123456789
    mockTx.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'PAID', phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', registrationId: null });
    const res2: any = await service.create({ phone: '+919123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', formData: {} } as any);
    expect(res2.registrationId).toBe('rPaid');
    // And with 9123456789
    mockTx.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'PAID', phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', registrationId: null });
    const res3: any = await service.create({ phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', formData: {} } as any);
    expect(res3.registrationId).toBe('rPaid');
  });

  it('should require PAID payment before creating registration for paid event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    // No PAID payment exists, only PENDING (canonical 9999999999)
    mockTx.payment.findFirst.mockResolvedValueOnce(null) // first call checks for PAID - none
      .mockResolvedValueOnce({ id: 'payPending', status: 'PENDING' }); // second call checks for pending/failed
    await expect(service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: { branch: 'CSE' } } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should reject PENDING payment from creating registration', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'payPending', status: 'PENDING' });
    await expect(service.create({ phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: {} } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should reject FAILED payment from creating registration', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'payFailed', status: 'FAILED' });
    await expect(service.create({ phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: {} } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should create registration for paid event only after PAID payment exists', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValue({ id: 'payPaid', status: 'PAID', phone: '9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', registrationId: null });
    mockTx.registration.create.mockResolvedValue({ registrationId: 'rPaid', phone: '9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: { branch: 'CSE' }, paymentStatus: 'PAID' });
    mockTx.payment.findFirst.mockResolvedValueOnce({ id: 'payPaid', status: 'PAID' }); // for successfulPayment check
    // Mock update for linking payment
    mockTx.payment.update = jest.fn().mockResolvedValue({ id: 'payPaid', status: 'PAID', registrationId: 'rPaid' });
    const res: any = await service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: { branch: 'CSE' } } as any);
    expect(mockTx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: '9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: { branch: 'CSE' }, paymentStatus: 'PAID' }) }));
    expect(res.registrationId).toBe('rPaid');
  });

  it('should reject duplicate registration even for paid event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue({ registrationId: 'rExist' });
    await expect(service.create({ phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: {}, amount: 50000 } as any)).rejects.toThrow(ConflictException);
  });

  it('should restrict student to own phone', async () => {
    mockRegistrationsRepo.findByRegistrationId.mockResolvedValue({ registrationId: 'r1', phone: '+91 1111111111', eventId: '550e8400-e29b-41d4-a716-446655440000' });
    mockRegistrationsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+91 9999999999' });
    await expect(service.findOne('r1', 'user1', 'STUDENT')).rejects.toThrow(ForbiddenException);
  });

  it('should restrict organizer to own event', async () => {
    mockRegistrationsRepo.findByRegistrationId.mockResolvedValue({ registrationId: 'r1', phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440000' });
    mockRegistrationsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', organizerId: 'org1' });
    mockRegistrationsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
    await expect(service.findOne('r1', 'user1', 'ORGANIZER')).rejects.toThrow(ForbiddenException);
  });

  it('should snapshot coupon pricing from the PAID payment (100000 -> 80000 with CLUB20)', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440030';
    mockTx.event.findUnique.mockResolvedValue({ id: eventId, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValue({
      id: 'payDisc', status: 'PAID', phone: '9999999999', eventId, registrationId: null,
      amount: 80000, originalAmount: 100000, discountAmount: 20000, couponId: 'c20', couponCode: 'CLUB20',
    });
    mockTx.coupon.findUnique.mockResolvedValue({ id: 'c20', code: 'CLUB20', eventId });
    mockTx.user.findFirst.mockResolvedValue(null);
    mockTx.registration.create.mockResolvedValue({
      registrationId: 'rDisc', phone: '9999999999', eventId, formData: {}, paymentStatus: 'PAID',
      couponId: 'c20', couponCode: 'CLUB20', originalAmount: 100000, discountAmount: 20000, totalAmount: 80000,
    });
    const res: any = await service.create({ phone: '+91 9999999999', eventId, formData: {}, couponCode: 'CLUB20' } as any);
    expect(mockTx.registration.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ couponCode: 'CLUB20', originalAmount: 100000, discountAmount: 20000, totalAmount: 80000 }),
    }));
    expect(res.pricing).toEqual({ originalAmount: 100000, discountAmount: 20000, totalAmount: 80000, coupon: { code: 'CLUB20' } });
  });

  it('should reject when requested coupon does not match the payment coupon (no silent full price)', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440031';
    mockTx.event.findUnique.mockResolvedValue({ id: eventId, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValue({
      id: 'payFull', status: 'PAID', phone: '9999999999', eventId, registrationId: null,
      amount: 100000, originalAmount: 100000, discountAmount: 0, couponId: null, couponCode: null,
    });
    await expect(service.create({ phone: '+91 9999999999', eventId, formData: {}, couponCode: 'CLUB20' } as any))
      .rejects.toThrow(/does not use coupon CLUB20/);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should reject coupon on a free event', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440032';
    mockTx.event.findUnique.mockResolvedValue({ id: eventId, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: false });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    await expect(service.create({ phone: '+91 9999999999', eventId, formData: {}, couponCode: 'CLUB20' } as any))
      .rejects.toThrow(/free event/);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });
});
