import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repo';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { Role } from '../common/constants/roles';
import { CouponsRepository } from '../coupons/coupons.repo';

const mockPaymentsRepo: any = {
  findRegistrationWithEvent: jest.fn(),
  findPaymentById: jest.fn(),
  findPaymentByRegistrationId: jest.fn(),
  createPayment: jest.fn(),
  updatePaymentStatusAtomic: jest.fn(),
  findUserById: jest.fn(),
  findOrganizerByUserId: jest.fn(),
  findEventById: jest.fn(),
  findPendingPaymentByPhoneAndEvent: jest.fn(),
  findRegistrationByPhoneAndEvent: jest.fn(),
  createPendingPayment: jest.fn(),
};

const mockCouponsRepo: any = {
  findByCode: jest.fn(),
};

const mockCouponsService: any = {
  priceQuote: jest.fn(),
  validateForRedemption: jest.fn(),
};

const studentUser: any = { userId: 'user1', id: 'user1', email: 'student@example.com', role: Role.STUDENT };
const otherStudentUser: any = { userId: 'user2', id: 'user2', email: 'other@example.com', role: Role.STUDENT };
const adminUser: any = { userId: 'admin1', id: 'admin1', email: 'admin@pravesh.local', role: Role.ADMIN };
const organizerUser: any = { userId: 'orgUser1', id: 'orgUser1', email: 'org@example.com', role: Role.ORGANIZER };
const otherOrganizerUser: any = { userId: 'orgUser2', id: 'orgUser2', email: 'other-org@example.com', role: Role.ORGANIZER };

// Helper: payment owned by org1's event via pending-payment eventId lookup.
const ownPendingPayment = (overrides: any = {}) => ({
  id: 'pay1',
  status: PaymentStatus.PENDING,
  eventId: '550e8400-e29b-41d4-a716-446655440020',
  registrationId: null,
  ...overrides,
});
const mockOwnEventOwnership = () => {
  mockPaymentsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', userId: 'orgUser1' });
  mockPaymentsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', organizerId: 'org1' });
};

describe('PaymentsService - Auth ownership & payment flow', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: mockPaymentsRepo },
        { provide: require('../coupons/coupons.repo').CouponsRepository, useValue: mockCouponsRepo },
        { provide: require('../coupons/coupons.service').CouponsService, useValue: mockCouponsService },
      ],
    }).compile();
    service = mod.get(PaymentsService);
  });

  it('should allow authenticated student to create payment for own registration', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1', phone: '+919876543210', event: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    mockPaymentsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+919876543210' });
    mockPaymentsRepo.findPaymentByRegistrationId.mockResolvedValue(null);
    mockPaymentsRepo.createPayment.mockResolvedValue({
      id: 'pay1',
      registrationId: 'reg1',
      amount: 50000,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await service.create('reg1', { amount: 50000 } as any, studentUser);
    expect(res.status).toBe(PaymentStatus.PENDING);
    expect(res.amount).toBe(50000);
    expect(mockPaymentsRepo.createPayment).toHaveBeenCalledWith(expect.objectContaining({ registrationId: 'reg1', amount: 50000 }));
  });

  it('should reject invalid registration', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue(null);
    await expect(service.create('invalid', { amount: 50000 } as any, studentUser)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should reject amount <=0', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1' });
    await expect(service.create('reg1', { amount: 0 } as any, studentUser)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('reg1', { amount: -100 } as any, studentUser)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.create('reg1', {} as any, studentUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject duplicate payment', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1', phone: '+919876543210' });
    mockPaymentsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+919876543210' });
    mockPaymentsRepo.findPaymentByRegistrationId.mockResolvedValue({ id: 'pay1' });
    await expect(service.create('reg1', { amount: 50000 } as any, studentUser)).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return 403 when student tries to use another student registration', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1', phone: '+919999999999', event: { id: '550e8400-e29b-41d4-a716-446655440000' } });
    mockPaymentsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+919876543210' });
    await expect(service.create('reg1', { amount: 50000 } as any, studentUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow ADMIN to create payment for any registration', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1', phone: '+919999999999' });
    mockPaymentsRepo.findPaymentByRegistrationId.mockResolvedValue(null);
    mockPaymentsRepo.createPayment.mockResolvedValue({
      id: 'pay1',
      registrationId: 'reg1',
      amount: 50000,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await service.create('reg1', { amount: 50000 } as any, adminUser);
    expect(res.status).toBe(PaymentStatus.PENDING);
  });

  it('should get payment by ID', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'pay1',
      registrationId: 'reg1',
      amount: 50000,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await service.getById('pay1');
    expect(res.id).toBe('pay1');
  });

  it('should throw NotFound for unknown payment id', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(null);
    await expect(service.getById('unknown')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should get payment by registrationId', async () => {
    mockPaymentsRepo.findPaymentByRegistrationId.mockResolvedValue({
      id: 'pay1',
      registrationId: 'reg1',
      amount: 50000,
      status: PaymentStatus.PENDING,
    });
    const res = await service.getByRegistrationId('reg1');
    expect(res.registrationId).toBe('reg1');
  });

  it('should let ORGANIZER change own-event payment to PAID', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'pay1',
      status: PaymentStatus.PAID,
    });
    const res: any = await service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, organizerUser);
    expect(res.status).toBe(PaymentStatus.PAID);
  });

  it('should let ORGANIZER change own-event payment to FAILED', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'pay1',
      status: PaymentStatus.FAILED,
    });
    const res: any = await service.updateStatus('pay1', { status: PaymentStatus.FAILED } as any, organizerUser);
    expect(res.status).toBe(PaymentStatus.FAILED);
  });

  it('should synchronize Registration.paymentStatus atomically via repo transaction', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockImplementation(async (id: string, status: PaymentStatus) => {
      return { id, status, registrationId: 'reg1', registration: { paymentStatus: status } };
    });
    const res: any = await service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, organizerUser);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay1', PaymentStatus.PAID);
    expect(res.status).toBe(PaymentStatus.PAID);
  });

  it('should ensure PATCH /:id/status is ORGANIZER-only via Roles guard (not ADMIN)', async () => {
    const { PaymentsController } = await import('./payments.controller');
    const roles = Reflect.getMetadata('roles', PaymentsController.prototype.updateStatus);
    expect(roles).toBeDefined();
    expect(roles).toContain(Role.ORGANIZER);
    expect(roles).not.toContain(Role.ADMIN);
  });

  it('should 403 when another organizer updates a payment for an event they do not own', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockPaymentsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2', userId: 'orgUser2' });
    mockPaymentsRepo.findEventById.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440020', organizerId: 'org1' });
    await expect(service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, otherOrganizerUser))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).not.toHaveBeenCalled();
  });

  it('should 403 when updater has no organizer profile', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockPaymentsRepo.findOrganizerByUserId.mockResolvedValue(null);
    await expect(service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, organizerUser))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).not.toHaveBeenCalled();
  });

  it('should resolve ownership via linked registration event when payment has no eventId', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'pay1',
      status: PaymentStatus.PENDING,
      eventId: null,
      registrationId: 'reg1',
      registration: { registrationId: 'reg1', eventId: 'ev1', event: { id: 'ev1', organizerId: 'org1' } },
    });
    mockPaymentsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', userId: 'orgUser1' });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PAID });
    const res: any = await service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, organizerUser);
    expect(res.status).toBe(PaymentStatus.PAID);
    expect(mockPaymentsRepo.findEventById).not.toHaveBeenCalled();
  });

  it('should ensure POST create is NOT public and requires JWT', async () => {
    const { PaymentsController } = await import('./payments.controller');
    const isPublic = Reflect.getMetadata('isPublic', PaymentsController.prototype.create);
    expect(isPublic).toBeUndefined();
    expect(PaymentsController.prototype.create).toBeDefined();
  });

  it('should NOT check Event.paymentRequired (left for later)', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'regFree', phone: '+919876543210', event: { paymentRequired: false } });
    mockPaymentsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+919876543210' });
    mockPaymentsRepo.findPaymentByRegistrationId.mockResolvedValue(null);
    mockPaymentsRepo.createPayment.mockResolvedValue({
      id: 'payFree',
      registrationId: 'regFree',
      amount: 50000,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const res = await service.create('regFree', { amount: 50000 } as any, studentUser);
    expect(res.status).toBe(PaymentStatus.PENDING);
  });

  it('should keep PENDING payment without creating Registration (paid flow)', async () => {
    // Simulate pending payment flow: payment has pendingFormData, no registration yet, status PENDING
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'payPending',
      status: PaymentStatus.PENDING,
      pendingFormData: { name: 'Test' },
      phone: '+91 9999999999',
      eventId: '550e8400-e29b-41d4-a716-446655440020',
      registrationId: null,
    });
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'payPending',
      status: PaymentStatus.PENDING,
      registrationId: null,
      pendingFormData: { name: 'Test' },
    });
    const res: any = await service.updateStatus('payPending', { status: PaymentStatus.PENDING } as any, organizerUser);
    expect(res.status).toBe(PaymentStatus.PENDING);
    expect(res.registrationId).toBeNull();
  });

  it('should keep FAILED payment without creating Registration', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'payFail',
      status: PaymentStatus.PENDING,
      pendingFormData: { name: 'Test' },
      phone: '+91 9999999999',
      eventId: '550e8400-e29b-41d4-a716-446655440020',
      registrationId: null,
    });
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'payFail',
      status: PaymentStatus.FAILED,
      registrationId: null,
    });
    const res: any = await service.updateStatus('payFail', { status: PaymentStatus.FAILED } as any, organizerUser);
    expect(res.status).toBe(PaymentStatus.FAILED);
    expect(res.registrationId).toBeNull();
  });

  it('should create exactly one Registration on PAID via atomic transaction', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'payPaid',
      status: PaymentStatus.PENDING,
      pendingFormData: { branch: 'CSE' },
      phone: '+91 9999999999',
      eventId: '550e8400-e29b-41d4-a716-446655440020',
      registrationId: null,
    });
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'payPaid',
      status: PaymentStatus.PAID,
      registrationId: 'rNew',
      registration: { registrationId: 'rNew', phone: '+91 9999999999', eventId: '550e8400-e29b-41d4-a716-446655440020', formData: { branch: 'CSE' }, paymentStatus: 'PAID' },
    });
    const res: any = await service.updateStatus('payPaid', { status: PaymentStatus.PAID } as any, organizerUser);
    expect(res.status).toBe(PaymentStatus.PAID);
    expect(res.registrationId).toBe('rNew');
    expect(res.registration.formData).toEqual({ branch: 'CSE' });
  });

  it('should rollback transaction if registration creation fails (duplicate)', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockRejectedValue(new ConflictException('Phone already registered for this event'));
    await expect(service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, organizerUser)).rejects.toBeInstanceOf(ConflictException);
  });

  it('should rollback if event slots full during PAID', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue(ownPendingPayment());
    mockOwnEventOwnership();
    mockPaymentsRepo.updatePaymentStatusAtomic.mockRejectedValue(new BadRequestException('Event slots full'));
    await expect(service.updateStatus('pay1', { status: PaymentStatus.PAID } as any, organizerUser)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should normalize phone variations for pending payment lookup', async () => {    const { canonicalPhone } = await import('../common/utils/phone');
    expect(canonicalPhone('+91 9123456789')).toBe('9123456789');
    expect(canonicalPhone('+919123456789')).toBe('9123456789');
    expect(canonicalPhone('9123456789')).toBe('9123456789');
    expect(canonicalPhone('+91-9123456789')).toBe('9123456789');
  });

  it('should allow PAID registration with any phone format if canonical matches', async () => {
    // Simulate that payment was created with canonical 9123456789, but lookup with +91 9123456789 should find it
    // This is tested via registrations service, but also verify payments service stores canonical
    const { canonicalPhone } = await import('../common/utils/phone');
    const canonical = canonicalPhone('+91 9123456789');
    expect(canonical).toBe('9123456789');
    // Mock for createPending should store canonical
    mockPaymentsRepo.findEventById = jest.fn().mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440017', paymentRequired: true, status: 'PUBLISHED' });
    mockPaymentsRepo.findPendingPaymentByPhoneAndEvent = jest.fn().mockResolvedValue(null);
    mockPaymentsRepo.findRegistrationByPhoneAndEvent = jest.fn().mockResolvedValue(null);
    mockPaymentsRepo.createPendingPayment = jest.fn().mockResolvedValue({ id: 'pay1', phone: '9123456789', eventId: '550e8400-e29b-41d4-a716-446655440017', amount: 50000, status: 'PENDING' });
    // Add the methods to mock if not present
    mockPaymentsRepo.createPendingPayment.mockClear();
    // Test via service
    const res = await service.createPending({ eventId: '550e8400-e29b-41d4-a716-446655440017', phone: '+91 9123456789', amount: 50000 } as any);
    expect(res.phone).toBe('9123456789');
    expect(mockPaymentsRepo.createPendingPayment).toHaveBeenCalledWith(expect.objectContaining({ phone: '9123456789' }));
  });

  const pendingEvent = (eventId: string) => {
    mockPaymentsRepo.findEventById = jest.fn().mockResolvedValue({ id: eventId, paymentRequired: true, status: 'PUBLISHED' });
    mockPaymentsRepo.findPendingPaymentByPhoneAndEvent = jest.fn().mockResolvedValue(null);
    mockPaymentsRepo.findRegistrationByPhoneAndEvent = jest.fn().mockResolvedValue(null);
    mockPaymentsRepo.createPendingPayment = jest.fn().mockImplementation(async (data: any) => ({
      id: 'pay1', phone: data.phone, eventId: data.eventId, amount: data.amount,
      originalAmount: data.originalAmount, discountAmount: data.discountAmount,
      couponCode: data.couponCode, status: 'PENDING', couponId: data.couponId,
    }));
  };

  it('REGRESSION: Rs500 with 10% coupon => exactly Rs450 (45000 paise), never Rs405', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440099';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockResolvedValue({
      originalAmount: 50000, discountAmount: 5000, totalAmount: 45000,
      coupon: { id: 'coupon1', code: 'AICLUB20' },
    });
    // Client sends ORIGINAL ticket amount: Rs500 = 50000 paise
    const res: any = await service.createPending(
      { eventId, phone: '9123456789', amount: 50000, couponCode: 'AICLUB20' } as any,
    );
    // Discount applied exactly once: stored amount is the final 45000, never 40500.
    expect(mockCouponsService.priceQuote).toHaveBeenCalledWith('AICLUB20', eventId, 50000);
    expect(mockPaymentsRepo.createPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 45000, originalAmount: 50000, discountAmount: 5000, couponId: 'coupon1', couponCode: 'AICLUB20' }),
    );
    expect(res.amount).toBe(45000);
    expect(res.originalAmount).toBe(50000);
    expect(res.discountAmount).toBe(5000);
    expect(res.amount).not.toBe(40500);
  });

  it('should accept coupon with future expiresAt (UTC)', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440098';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockResolvedValue({
      originalAmount: 50000, discountAmount: 5000, totalAmount: 45000,
      coupon: { id: 'couponFuture', code: 'AICLUB20' },
    });
    const res: any = await service.createPending(
      { eventId, phone: '9123456789', amount: 50000, couponCode: 'AICLUB20' } as any,
    );
    expect(res.amount).toBe(45000);
  });

  it('should reject coupon with past expiresAt as "Coupon expired"', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440097';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockRejectedValue(new BadRequestException('Coupon expired'));
    await expect(
      service.createPending({ eventId, phone: '9123456789', amount: 50000, couponCode: 'AICLUB20' } as any),
    ).rejects.toThrow('Coupon expired');
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });

  it('should accept coupon with future expiresAt as ISO string (UTC)', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440096';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockResolvedValue({
      originalAmount: 50000, discountAmount: 5000, totalAmount: 45000,
      coupon: { id: 'couponFutureStr', code: 'QT1930672' },
    });
    const res: any = await service.createPending(
      { eventId, phone: '9123456789', amount: 50000, couponCode: 'QT1930672' } as any,
    );
    expect(res.amount).toBe(45000);
  });

  it('should reject genuinely expired coupon ISO string (e.g. 2025-12-31) as "Coupon expired"', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440095';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockRejectedValue(new BadRequestException('Coupon expired'));
    await expect(
      service.createPending({ eventId, phone: '9123456789', amount: 50000, couponCode: 'QT1930672' } as any),
    ).rejects.toThrow('Coupon expired');
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });

  it('should reject unknown coupon code without creating a payment', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440094';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockRejectedValue(new BadRequestException('Invalid coupon code'));
    await expect(
      service.createPending({ eventId, phone: '9123456789', amount: 50000, couponCode: 'NOPE123' } as any),
    ).rejects.toThrow('Invalid coupon code');
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });

  it('should reject inactive coupon without creating a payment', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440093';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockRejectedValue(new BadRequestException('Coupon is inactive'));
    await expect(
      service.createPending({ eventId, phone: '9123456789', amount: 50000, couponCode: 'AICLUB20' } as any),
    ).rejects.toThrow('Coupon is inactive');
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });

  it('should reject coupon with exhausted usage limit without creating a payment', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440092';
    pendingEvent(eventId);
    mockCouponsService.priceQuote.mockRejectedValue(new BadRequestException('Coupon usage limit reached'));
    await expect(
      service.createPending({ eventId, phone: '9123456789', amount: 50000, couponCode: 'AICLUB20' } as any),
    ).rejects.toThrow('Coupon usage limit reached');
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });

  it('should charge full price with zero discount when no coupon is provided', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440091';
    pendingEvent(eventId);
    const res: any = await service.createPending({ eventId, phone: '9123456789', amount: 100000 } as any);
    expect(mockCouponsService.priceQuote).not.toHaveBeenCalled();
    expect(mockPaymentsRepo.createPendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100000, originalAmount: 100000, discountAmount: 0 }),
    );
    expect(res.amount).toBe(100000);
  });
});
