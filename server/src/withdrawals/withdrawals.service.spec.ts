import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;

  const paidEvent = (overrides: any = {}) => ({
    id: 3,
    organizerId: 'org1',
    paymentRequired: true,
    formStructure: { payment: { amount: 100 } },
    ...overrides,
  });

  const mockPrisma: any = {
    organizer: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    registration: { count: jest.fn() },
    withdrawal: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const mockStorage: any = { uploadProof: jest.fn(), readLocalFile: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    service = mod.get(WithdrawalsService);
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org1', status: 'APPROVED', upiId: 'org@upi' });
  });

  function financeStubs(regCount = 5, withdrawals: any[] = []) {
    mockPrisma.event.findUnique.mockResolvedValue(paidEvent());
    mockPrisma.registration.count.mockResolvedValue(regCount);
    mockPrisma.withdrawal.findMany.mockResolvedValue(withdrawals);
  }

  it('should reject withdrawal for another organizer event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(paidEvent({ organizerId: 'orgX' }));
    mockPrisma.registration.count.mockResolvedValue(5);
    mockPrisma.withdrawal.findMany.mockResolvedValue([]);
    await expect(service.create({ eventId: 3, amount: 100 } as any, 'user1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should reject amount above available balance', async () => {
    financeStubs(5, []); // collected = 500
    await expect(service.create({ eventId: 3, amount: 501 } as any, 'user1')).rejects.toThrow('exceeds available balance');
  });

  it('should reject duplicate open request for same event', async () => {
    financeStubs(5, [{ id: 'w1', status: 'REQUESTED', amount: 100 }]);
    await expect(service.create({ eventId: 3, amount: 100 } as any, 'user1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('should reject events without a fee', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(paidEvent({ paymentRequired: false }));
    mockPrisma.registration.count.mockResolvedValue(5);
    mockPrisma.withdrawal.findMany.mockResolvedValue([]);
    await expect(service.create({ eventId: 3, amount: 10 } as any, 'user1')).rejects.toThrow('no registration fee');
  });

  it('should create with UPI snapshot from organizer profile', async () => {
    financeStubs(5, []);
    mockPrisma.withdrawal.create.mockResolvedValue({ id: 'w1', amount: 200, upiId: 'org@upi' });
    const res = await service.create({ eventId: 3, amount: 200 } as any, 'user1');
    expect(mockPrisma.withdrawal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 200, upiId: 'org@upi', organizerId: 'org1', eventId: 3 }) }),
    );
    expect(res.upiId).toBe('org@upi');
  });

  it('should forbid non-owner organizer from viewing withdrawal', async () => {
    mockPrisma.withdrawal.findUnique.mockResolvedValue({
      id: 'w1', organizerId: 'orgX', status: 'PAID',
      organizer: { id: 'orgX' }, event: { id: 3 },
    });
    await expect(service.findOne('w1', 'user1', 'ORGANIZER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should only process REQUESTED withdrawals', async () => {
    mockPrisma.withdrawal.findUnique.mockResolvedValue({ id: 'w1', status: 'PROCESSING' });
    await expect(service.process('w1')).rejects.toThrow('Only REQUESTED');
  });

  it('should require transaction ID and screenshot to confirm paid', async () => {
    mockPrisma.withdrawal.findUnique.mockResolvedValue({ id: 'w1', status: 'REQUESTED' });
    await expect(service.confirmPaid('w1', '', undefined)).rejects.toThrow('Transaction ID is required');
    await expect(service.confirmPaid('w1', 'TXN1', undefined)).rejects.toThrow('screenshot is required');
  });

  it('should confirm paid with proof and timestamp', async () => {
    mockPrisma.withdrawal.findUnique.mockResolvedValue({ id: 'w1', status: 'REQUESTED' });
    mockStorage.uploadProof.mockResolvedValue({ url: 'local://proofs/w1.png', key: 'w1.png' });
    mockPrisma.withdrawal.update.mockResolvedValue({ id: 'w1', status: 'PAID' });
    const file: any = { originalname: 'pay.png', mimetype: 'image/png', size: 1000, buffer: Buffer.from('x') };
    await service.confirmPaid('w1', 'TXN123', file);
    expect(mockStorage.uploadProof).toHaveBeenCalled();
    expect(mockPrisma.withdrawal.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID', transactionId: 'TXN123', proofUrl: 'local://proofs/w1.png' }),
      }),
    );
  });

  it('should hide proof from organizer before PAID', async () => {
    mockPrisma.withdrawal.findUnique.mockResolvedValue({
      id: 'w1', organizerId: 'org1', status: 'REQUESTED', proofUrl: null,
      organizer: { id: 'org1' }, event: { id: 3 },
    });
    await expect(service.proofContent('w1', 'user1', 'ORGANIZER')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
