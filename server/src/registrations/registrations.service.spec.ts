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

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx = {
      event: { findUnique: jest.fn() },
      registration: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
      payment: { findFirst: jest.fn(), create: jest.fn() },
    };
    mockRegistrationsRepo.findByRegistrationId = jest.fn();
    mockRegistrationsRepo.findOrganizerByUserId = jest.fn();
    mockRegistrationsRepo.findEventById = jest.fn();
    mockRegistrationsRepo.findUserById = jest.fn();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [RegistrationsService, { provide: RegistrationsRepository, useValue: mockRegistrationsRepo }],
    }).compile();
    service = mod.get(RegistrationsService);
  });

  it('should reject registration for unpublished event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'DRAFT', slots: 100, closingTime: new Date(Date.now() + 1000000) });
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject when closingTime passed', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() - 1000000) });
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject when slots full', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 5, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(5);
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should prevent duplicate phone per event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue({ registrationId: 'existing', phone: '+91 9999999999' });
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(ConflictException);
  });

  it('should create registration with phone/formData and int eventId', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: false });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.registration.create.mockResolvedValue({ registrationId: 'r1', phone: '9999999999', eventId: 1, formData: { branch: 'CSE' } });
    const res = await service.create({ phone: '+91 9999999999', eventId: 1, formData: { branch: 'CSE' } } as any);
    expect(mockTx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: '9999999999', eventId: 1 }) }));
    expect(res.registrationId).toBe('r1');
  });

  it('should create registration directly for free event (paymentRequired=false)', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 10, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: false });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.registration.create.mockResolvedValue({ registrationId: 'rFree', phone: '8888888888', eventId: 10, formData: { name: 'Free' } });
    const res = await service.create({ phone: '+91 8888888888', eventId: 10, formData: { name: 'Free' } } as any);
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
    mockTx.event.findUnique.mockResolvedValue({ id: 17, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    // Payment stored as canonical 9123456789, lookup with +91 9123456789 should find it
    mockTx.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'PAID', phone: '9123456789', eventId: 17, registrationId: null });
    mockTx.registration.create.mockResolvedValue({ registrationId: 'rPaid', phone: '9123456789', eventId: 17, formData: {}, paymentStatus: 'PAID' });
    mockTx.payment.update = jest.fn().mockResolvedValue({});
    const res1: any = await service.create({ phone: '+91 9123456789', eventId: 17, formData: {} } as any);
    expect(res1.registrationId).toBe('rPaid');
    // Also test with +919123456789
    mockTx.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'PAID', phone: '9123456789', eventId: 17, registrationId: null });
    const res2: any = await service.create({ phone: '+919123456789', eventId: 17, formData: {} } as any);
    expect(res2.registrationId).toBe('rPaid');
    // And with 9123456789
    mockTx.payment.findFirst.mockResolvedValue({ id: 'pay1', status: 'PAID', phone: '9123456789', eventId: 17, registrationId: null });
    const res3: any = await service.create({ phone: '9123456789', eventId: 17, formData: {} } as any);
    expect(res3.registrationId).toBe('rPaid');
  });

  it('should require PAID payment before creating registration for paid event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 20, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    // No PAID payment exists, only PENDING (canonical 9999999999)
    mockTx.payment.findFirst.mockResolvedValueOnce(null) // first call checks for PAID - none
      .mockResolvedValueOnce({ id: 'payPending', status: 'PENDING' }); // second call checks for pending/failed
    await expect(service.create({ phone: '+91 9999999999', eventId: 20, formData: { branch: 'CSE' } } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should reject PENDING payment from creating registration', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 20, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'payPending', status: 'PENDING' });
    await expect(service.create({ phone: '9123456789', eventId: 20, formData: {} } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should reject FAILED payment from creating registration', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 20, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'payFailed', status: 'FAILED' });
    await expect(service.create({ phone: '9123456789', eventId: 20, formData: {} } as any)).rejects.toThrow(BadRequestException);
    expect(mockTx.registration.create).not.toHaveBeenCalled();
  });

  it('should create registration for paid event only after PAID payment exists', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 20, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.payment.findFirst.mockResolvedValue({ id: 'payPaid', status: 'PAID', phone: '9999999999', eventId: 20, registrationId: null });
    mockTx.registration.create.mockResolvedValue({ registrationId: 'rPaid', phone: '9999999999', eventId: 20, formData: { branch: 'CSE' }, paymentStatus: 'PAID' });
    mockTx.payment.findFirst.mockResolvedValueOnce({ id: 'payPaid', status: 'PAID' }); // for successfulPayment check
    // Mock update for linking payment
    mockTx.payment.update = jest.fn().mockResolvedValue({ id: 'payPaid', status: 'PAID', registrationId: 'rPaid' });
    const res: any = await service.create({ phone: '+91 9999999999', eventId: 20, formData: { branch: 'CSE' } } as any);
    expect(mockTx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: '9999999999', eventId: 20, formData: { branch: 'CSE' }, paymentStatus: 'PAID' }) }));
    expect(res.registrationId).toBe('rPaid');
  });

  it('should reject duplicate registration even for paid event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 20, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000), paymentRequired: true });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue({ registrationId: 'rExist' });
    await expect(service.create({ phone: '+91 9999999999', eventId: 20, formData: {}, amount: 50000 } as any)).rejects.toThrow(ConflictException);
  });

  it('should restrict student to own phone', async () => {
    mockRegistrationsRepo.findByRegistrationId.mockResolvedValue({ registrationId: 'r1', phone: '+91 1111111111', eventId: 1 });
    mockRegistrationsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+91 9999999999' });
    await expect(service.findOne('r1', 'user1', 'STUDENT')).rejects.toThrow(ForbiddenException);
  });

  it('should restrict organizer to own event', async () => {
    mockRegistrationsRepo.findByRegistrationId.mockResolvedValue({ registrationId: 'r1', phone: '+91 9999999999', eventId: 1 });
    mockRegistrationsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1' });
    mockRegistrationsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
    await expect(service.findOne('r1', 'user1', 'ORGANIZER')).rejects.toThrow(ForbiddenException);
  });
});
