import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repo';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';
import { Role } from '../common/constants/roles';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'RAZORPAY_WEBHOOK_SECRET') return 'test-webhook-secret';
    if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_mock_key';
    if (key === 'RAZORPAY_SECRET') return 'test-mock-secret';
    return undefined;
  }),
};

const mockPaymentsRepo: any = {
  findRegistrationWithEvent: jest.fn(),
  findPaymentById: jest.fn(),
  findPaymentByRegistrationId: jest.fn(),
  findPaymentByRazorpayOrderId: jest.fn(),
  createPayment: jest.fn(),
  updatePaymentStatusAtomic: jest.fn(),
  findUserById: jest.fn(),
};

const studentUser: any = { userId: 'user1', id: 'user1', email: 'student@example.com', role: Role.STUDENT };
const otherStudentUser: any = { userId: 'user2', id: 'user2', email: 'other@example.com', role: Role.STUDENT };
const adminUser: any = { userId: 'admin1', id: 'admin1', email: 'admin@pravesh.local', role: Role.ADMIN };

describe('PaymentsService - Auth ownership & payment flow', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService, { provide: PaymentsRepository, useValue: mockPaymentsRepo }, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();
    service = mod.get(PaymentsService);
  });

  it('should allow authenticated student to create payment for own registration', async () => {
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1', phone: '+919876543210', event: { id: 1 } });
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
    mockPaymentsRepo.findRegistrationWithEvent.mockResolvedValue({ registrationId: 'reg1', phone: '+919999999999', event: { id: 1 } });
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

  it('should ADMIN change payment to PAID', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'pay1',
      status: PaymentStatus.PAID,
    });
    const res = await service.updateStatus('pay1', { status: PaymentStatus.PAID } as any);
    expect(res!.status).toBe(PaymentStatus.PAID);
  });

  it('should ADMIN change payment to FAILED', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'pay1',
      status: PaymentStatus.FAILED,
    });
    const res = await service.updateStatus('pay1', { status: PaymentStatus.FAILED } as any);
    expect(res!.status).toBe(PaymentStatus.FAILED);
  });

  it('should synchronize Registration.paymentStatus atomically via repo transaction', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockImplementation(async (id: string, status: PaymentStatus) => {
      return { id, status, registrationId: 'reg1', registration: { paymentStatus: status } };
    });
    const res = await service.updateStatus('pay1', { status: PaymentStatus.PAID } as any);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay1', PaymentStatus.PAID);
    expect(res!.status).toBe(PaymentStatus.PAID);
  });

  it('should ensure PATCH /:id/status is ADMIN-only via Roles guard', async () => {
    const { PaymentsController } = await import('./payments.controller');
    const roles = Reflect.getMetadata('roles', PaymentsController.prototype.updateStatus);
    expect(roles).toBeDefined();
    expect(roles).toContain(Role.ADMIN);
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
    expect(res!.status).toBe(PaymentStatus.PENDING);
  });

  it('should keep PENDING payment without creating Registration (paid flow)', async () => {
    // Simulate pending payment flow: payment has pendingFormData, no registration yet, status PENDING
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'payPending',
      status: PaymentStatus.PENDING,
      pendingFormData: { name: 'Test' },
      phone: '+91 9999999999',
      eventId: 20,
      registrationId: null,
    });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'payPending',
      status: PaymentStatus.PENDING,
      registrationId: null,
      pendingFormData: { name: 'Test' },
    });
    const res = await service.updateStatus('payPending', { status: PaymentStatus.PENDING } as any);
    expect(res!.status).toBe(PaymentStatus.PENDING);
    expect(res!.registrationId).toBeNull();
  });

  it('should keep FAILED payment without creating Registration', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'payFail',
      status: PaymentStatus.PENDING,
      pendingFormData: { name: 'Test' },
      phone: '+91 9999999999',
      eventId: 20,
      registrationId: null,
    });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'payFail',
      status: PaymentStatus.FAILED,
      registrationId: null,
    });
    const res = await service.updateStatus('payFail', { status: PaymentStatus.FAILED } as any);
    expect(res!.status).toBe(PaymentStatus.FAILED);
    expect(res!.registrationId).toBeNull();
  });

  it('should create exactly one Registration on PAID via atomic transaction', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({
      id: 'payPaid',
      status: PaymentStatus.PENDING,
      pendingFormData: { branch: 'CSE' },
      phone: '+91 9999999999',
      eventId: 20,
      registrationId: null,
    });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({
      id: 'payPaid',
      status: PaymentStatus.PAID,
      registrationId: 'rNew',
      registration: { registrationId: 'rNew', phone: '+91 9999999999', eventId: 20, formData: { branch: 'CSE' }, paymentStatus: 'PAID' },
    });
    const res: any = await service.updateStatus('payPaid', { status: PaymentStatus.PAID } as any);
    expect(res.status).toBe(PaymentStatus.PAID);
    expect(res.registrationId).toBe('rNew');
    expect(res.registration.formData).toEqual({ branch: 'CSE' });
  });

  it('should rollback transaction if registration creation fails (duplicate)', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockRejectedValue(new ConflictException('Phone already registered for this event'));
    await expect(service.updateStatus('pay1', { status: PaymentStatus.PAID } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('should rollback if event slots full during PAID', async () => {
    mockPaymentsRepo.findPaymentById.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockRejectedValue(new BadRequestException('Event slots full'));
    await expect(service.updateStatus('pay1', { status: PaymentStatus.PAID } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should normalize phone variations for pending payment lookup', async () => {
    const { canonicalPhone } = await import('../common/utils/phone');
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
    mockPaymentsRepo.findEventById = jest.fn().mockResolvedValue({ id: 17, paymentRequired: true, status: 'PUBLISHED' });
    mockPaymentsRepo.findPendingPaymentByPhoneAndEvent = jest.fn().mockResolvedValue(null);
    mockPaymentsRepo.findRegistrationByPhoneAndEvent = jest.fn().mockResolvedValue(null);
    mockPaymentsRepo.createPendingPayment = jest.fn().mockResolvedValue({ id: 'pay1', phone: '9123456789', eventId: 17, amount: 50000, status: 'PENDING' });
    mockPaymentsRepo.updatePaymentRazorpayOrderId = jest.fn().mockResolvedValue({ id: 'pay1', razorpayOrderId: 'order_test_pending' });
    (service as any).razorpay = {
      orders: {
        create: jest.fn().mockResolvedValue({ id: 'order_test_pending' }),
      },
    };
    // Add the methods to mock if not present
    mockPaymentsRepo.createPendingPayment.mockClear();
    // Test via service
    const res = await service.createPending({ eventId: 17, phone: '+91 9123456789', amount: 50000 } as any);
    expect(res.phone).toBe('9123456789');
    expect(mockPaymentsRepo.createPendingPayment).toHaveBeenCalledWith(expect.objectContaining({ phone: '9123456789' }));
  });

  it('should reject a webhook with an invalid signature before touching payments', async () => {
    const payload = { event: 'order.paid', payload: {} };
    const body = JSON.stringify(payload);

    await expect(service.handleWebhook(Buffer.from(body, 'utf8'), '0'.repeat(64))).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPaymentsRepo.findPaymentByRazorpayOrderId).not.toHaveBeenCalled();
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).not.toHaveBeenCalled();
  });

  it('should process a signed order.paid webhook through the atomic payment transaction', async () => {
    const payload = {
      event: 'order.paid',
      payload: {
        order: { entity: { id: 'order_test_success' } },
        payment: { entity: { id: 'pay_test_success' } },
      },
    };
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');

    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PAID });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), signature);

    expect(mockPaymentsRepo.findPaymentByRazorpayOrderId).toHaveBeenCalledWith('order_test_success');
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay1', PaymentStatus.PAID, 'pay_test_success');
    expect(res).toEqual({ received: true, processed: true, paymentId: 'pay1' });
  });

  it('should process a signed payment.captured webhook using the payment order reference', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: { entity: { id: 'pay_test_captured', order_id: 'order_test_captured' } },
      },
    };
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');

    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay2', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay2', status: PaymentStatus.PAID });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), signature);

    expect(mockPaymentsRepo.findPaymentByRazorpayOrderId).toHaveBeenCalledWith('order_test_captured');
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay2', PaymentStatus.PAID, 'pay_test_captured');
    expect(res).toEqual({ received: true, processed: true, paymentId: 'pay2' });
  });

  it('should process a signed payment.failed webhook without creating a registration', async () => {
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: { entity: { id: 'pay_test_failed', order_id: 'order_test_failed' } },
      },
    };
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');

    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay3', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay3', status: PaymentStatus.FAILED });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), signature);

    expect(mockPaymentsRepo.findPaymentByRazorpayOrderId).toHaveBeenCalledWith('order_test_failed');
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay3', PaymentStatus.FAILED, 'pay_test_failed');
    expect(res).toEqual({ received: true, processed: true, paymentId: 'pay3', status: 'FAILED' });
  });

  it('should not move an already PAID payment back to FAILED', async () => {
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: { entity: { id: 'pay_test_late_failure', order_id: 'order_test_paid' } },
      },
    };
    const body = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');

    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay4', status: PaymentStatus.PAID });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), signature);

    expect(mockPaymentsRepo.updatePaymentStatusAtomic).not.toHaveBeenCalled();
    expect(res).toEqual({ received: true, processed: false, message: 'Payment already marked as PAID' });
  });
});
