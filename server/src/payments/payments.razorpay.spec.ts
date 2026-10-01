import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repo';
import { CouponsRepository } from '../coupons/coupons.repo';
import { CouponsService } from '../coupons/coupons.service';
import { PaymentStatus } from '@prisma/client';
import * as crypto from 'crypto';

const WEBHOOK_SECRET = 'test-webhook-secret';
const KEY_ID = 'rzp_test_key';
const KEY_SECRET = 'test-key-secret';

const mockPaymentsRepo: any = {
  findRegistrationWithEvent: jest.fn(),
  findPaymentById: jest.fn(),
  findPaymentByRegistrationId: jest.fn(),
  findPaymentByRazorpayOrderId: jest.fn(),
  createPayment: jest.fn(),
  createPendingPayment: jest.fn(),
  updatePaymentRazorpayOrderId: jest.fn(),
  deletePayment: jest.fn(),
  updatePaymentStatusAtomic: jest.fn(),
  findUserById: jest.fn(),
  findOrganizerByUserId: jest.fn(),
  findEventById: jest.fn(),
  findPendingPaymentByPhoneAndEvent: jest.fn(),
  findRegistrationByPhoneAndEvent: jest.fn(),
};

const mockConfigService: any = {
  get: jest.fn((key: string) => {
    if (key === 'RAZORPAY_KEY_ID') return KEY_ID;
    if (key === 'RAZORPAY_KEY_SECRET') return KEY_SECRET;
    if (key === 'RAZORPAY_WEBHOOK_SECRET') return WEBHOOK_SECRET;
    return undefined;
  }),
};

const mockCouponsRepo: any = { findByCode: jest.fn() };
const mockCouponsService: any = { priceQuote: jest.fn(), validateForRedemption: jest.fn() };

describe('PaymentsService - Razorpay integration', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: mockPaymentsRepo },
        { provide: CouponsRepository, useValue: mockCouponsRepo },
        { provide: CouponsService, useValue: mockCouponsService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = mod.get(PaymentsService);
  });

  it('creates a Razorpay order on createPending and stores the order id', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440017';
    mockPaymentsRepo.findEventById.mockResolvedValue({ id: eventId, paymentRequired: true, status: 'PUBLISHED' });
    mockPaymentsRepo.findPendingPaymentByPhoneAndEvent.mockResolvedValue(null);
    mockPaymentsRepo.findRegistrationByPhoneAndEvent.mockResolvedValue(null);
    mockPaymentsRepo.createPendingPayment.mockResolvedValue({
      id: 'pay1', phone: '9123456789', eventId, amount: 50000, status: 'PENDING',
    });
    mockPaymentsRepo.updatePaymentRazorpayOrderId.mockResolvedValue({ id: 'pay1', razorpayOrderId: 'order_test_1' });
    const createOrder = jest.fn().mockResolvedValue({ id: 'order_test_1' });
    (service as any).razorpay = { orders: { create: createOrder } };

    // API takes rupees (500 = ₹500)...
    const res: any = await service.createPending({ eventId, phone: '+91 9123456789', amount: 500 } as any);
    expect(res.razorpayOrderId).toBe('order_test_1');
    expect(res.razorpayKeyId).toBe(KEY_ID);
    // ...but Razorpay itself always gets paise (50000), and the API returns rupees.
    expect(createOrder).toHaveBeenCalledWith(expect.objectContaining({ amount: 50000, currency: 'INR' }));
    expect(res.amount).toBe(500);
    expect(mockPaymentsRepo.updatePaymentRazorpayOrderId).toHaveBeenCalledWith('pay1', 'order_test_1');
  });

  it('rejects a webhook with an invalid signature before touching payments', async () => {
    const body = JSON.stringify({ event: 'order.paid', payload: {} });
    await expect(service.handleWebhook(Buffer.from(body, 'utf8'), '0'.repeat(64))).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPaymentsRepo.findPaymentByRazorpayOrderId).not.toHaveBeenCalled();
  });

  it('processes a signed order.paid webhook', async () => {
    const payload = {
      event: 'order.paid',
      payload: { order: { entity: { id: 'order_ok' } }, payment: { entity: { id: 'pay_ok' } } },
    };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PAID });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), sig);
    expect(mockPaymentsRepo.findPaymentByRazorpayOrderId).toHaveBeenCalledWith('order_ok');
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay1', PaymentStatus.PAID, 'pay_ok');
    expect(res).toEqual({ received: true, processed: true, paymentId: 'pay1' });
  });

  it('processes a signed payment.failed webhook', async () => {
    const payload = {
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_f', order_id: 'order_f' } } },
    };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay3', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay3', status: PaymentStatus.FAILED });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), sig);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay3', PaymentStatus.FAILED, 'pay_f');
    expect(res).toEqual({ received: true, processed: true, paymentId: 'pay3', status: 'FAILED' });
  });

  it('never moves a PAID payment back to FAILED', async () => {
    const payload = {
      event: 'payment.failed',
      payload: { payment: { entity: { id: 'pay_late', order_id: 'order_paid' } } },
    };
    const body = JSON.stringify(payload);
    const sig = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay4', status: PaymentStatus.PAID });

    const res = await service.handleWebhook(Buffer.from(body, 'utf8'), sig);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).not.toHaveBeenCalled();
    expect(res).toEqual({ received: true, processed: false, message: 'Payment already marked as PAID' });
  });

  it('verifies a checkout payment signature and marks payment PAID', async () => {
    const orderId = 'order_verify_1';
    const paymentId = 'pay_verify_1';
    const sig = crypto.createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    mockPaymentsRepo.findPaymentByRazorpayOrderId.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PENDING });
    mockPaymentsRepo.updatePaymentStatusAtomic.mockResolvedValue({ id: 'pay1', status: PaymentStatus.PAID });

    const res = await service.verifyPayment({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig });
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).toHaveBeenCalledWith('pay1', PaymentStatus.PAID, paymentId);
    expect(res.success).toBe(true);
  });

  it('rejects a tampered checkout signature', async () => {
    await expect(
      service.verifyPayment({ razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: '0'.repeat(64) }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPaymentsRepo.updatePaymentStatusAtomic).not.toHaveBeenCalled();
  });

  it('rejects a sub-₹1 payable amount before creating any payment row', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440017';
    mockPaymentsRepo.findEventById.mockResolvedValue({ id: eventId, paymentRequired: true, status: 'PUBLISHED' });
    mockPaymentsRepo.findPendingPaymentByPhoneAndEvent.mockResolvedValue(null);
    mockPaymentsRepo.findRegistrationByPhoneAndEvent.mockResolvedValue(null);
    // ₹0.50 = 50 paise: passes rupee validation but is below Razorpay's minimum.
    await expect(
      service.createPending({ eventId, phone: '+91 9123456789', amount: 0.5 } as any),
    ).rejects.toThrow(/at least ₹1/);
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });

  it('rejects a fully-discounted (₹0) coupon total before creating any payment row', async () => {
    const eventId = '550e8400-e29b-41d4-a716-446655440017';
    mockPaymentsRepo.findEventById.mockResolvedValue({ id: eventId, paymentRequired: true, status: 'PUBLISHED' });
    mockPaymentsRepo.findPendingPaymentByPhoneAndEvent.mockResolvedValue(null);
    mockPaymentsRepo.findRegistrationByPhoneAndEvent.mockResolvedValue(null);
    mockCouponsService.priceQuote.mockResolvedValue({
      originalAmount: 500, discountAmount: 500, totalAmount: 0, coupon: { id: 'c1', code: 'FREE100' },
    });
    await expect(
      service.createPending({ eventId, phone: '+91 9123456789', amount: 500, couponCode: 'FREE100' } as any),
    ).rejects.toThrow(/at least ₹1/);
    expect(mockPaymentsRepo.createPendingPayment).not.toHaveBeenCalled();
  });
});
