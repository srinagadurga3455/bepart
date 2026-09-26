import { Test, TestingModule } from '@nestjs/testing';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsRepository } from './withdrawals.repo';
import { StorageService } from '../storage/storage.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WithdrawalStatus } from '@prisma/client';

const EVENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const OTHER_EVENT_ID = '550e8400-e29b-41d4-a716-446655440003';

const paidEvent = (overrides: any = {}) => ({
  id: EVENT_ID,
  organizerId: 'org1',
  eventName: 'Tech Fest',
  paymentRequired: true,
  ...overrides,
});

const withdrawalRow = (overrides: any = {}) => ({
  id: 'w1',
  eventId: EVENT_ID,
  amount: 20000,
  upiId: 'org@upi',
  status: WithdrawalStatus.REQUESTED,
  transactionId: null,
  proofUrl: null,
  rejectionReason: null,
  requestedAt: new Date(),
  paidAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  organizerId: 'org1',
  event: { eventName: 'Tech Fest' },
  ...overrides,
});

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;

  const mockRepo: any = {
    db: {},
    transaction: jest.fn(),
    findOrganizerByUserId: jest.fn(),
    findEventById: jest.fn(),
    paidRevenueForEvent: jest.fn(),
    findWithdrawalsForEvent: jest.fn(),
    create: jest.fn(),
    findManyByOrganizerId: jest.fn(),
    findManyByEventId: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    transitionState: jest.fn(),
    findTransactionIdDuplicate: jest.fn(),
  };
  const mockStorage: any = { uploadProof: jest.fn(), readLocalFile: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        { provide: WithdrawalsRepository, useValue: mockRepo },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();
    service = mod.get(WithdrawalsService);
    mockRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED', upiId: 'org@upi' });
    // Run transactional callbacks inline against the same mocks.
    mockRepo.transaction.mockImplementation(async (fn: any) => fn({}));
  });

  function financeStubs(opts: {
    revenue?: number;
    withdrawals?: Array<{ id: string; amount: number; status: WithdrawalStatus }>;
    event?: any;
  } = {}) {
    mockRepo.findEventById.mockResolvedValue(opts.event ?? paidEvent());
    mockRepo.paidRevenueForEvent.mockResolvedValue(opts.revenue ?? 50000);
    mockRepo.findWithdrawalsForEvent.mockResolvedValue(opts.withdrawals ?? []);
    mockRepo.create.mockImplementation(async (_db: any, data: any) => withdrawalRow({ ...data }));
  }

  // ── Organizer create ──────────────────────────────────────────

  it('creates withdrawal successfully in paise (Int)', async () => {
    financeStubs();
    const res = await service.create({ eventId: EVENT_ID, amount: 20000 } as any, 'user1');
    expect(Number.isInteger(res.amount)).toBe(true);
    expect(res.amount).toBe(20000);
    expect(res.upiId).toBe('org@upi');
    expect(res.status).toBe(WithdrawalStatus.REQUESTED);
    expect(res.eventName).toBe('Tech Fest');
    expect(mockRepo.transaction).toHaveBeenCalledWith(expect.any(Function), 'Serializable');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ amount: 20000, upiId: 'org@upi', organizerId: 'org1', eventId: EVENT_ID }),
    );
  });

  it('accepts explicit upiId override and rejects invalid UPI IDs', async () => {
    financeStubs();
    const res = await service.create({ eventId: EVENT_ID, amount: 10000, upiId: 'club@okhdfc' } as any, 'user1');
    expect(res.upiId).toBe('club@okhdfc');
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000, upiId: 'not-a-upi' } as any, 'user1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects withdrawal for another organizer event', async () => {
    financeStubs({ event: paidEvent({ organizerId: 'orgX' }) });
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('rejects when event does not exist', async () => {
    mockRepo.findEventById.mockResolvedValue(null);
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects amount above available balance', async () => {
    financeStubs({ revenue: 50000 }); // available = 50000
    await expect(
      service.create({ eventId: EVENT_ID, amount: 50001 } as any, 'user1'),
    ).rejects.toThrow('exceeds available balance');
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('rejects zero/negative/non-integer amounts', async () => {
    financeStubs();
    await expect(service.create({ eventId: EVENT_ID, amount: 0 } as any, 'user1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create({ eventId: EVENT_ID, amount: -100 } as any, 'user1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.create({ eventId: EVENT_ID, amount: 10.5 } as any, 'user1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects duplicate open request for same event', async () => {
    financeStubs({
      revenue: 50000,
      withdrawals: [{ id: 'w0', amount: 10000, status: WithdrawalStatus.REQUESTED }],
    });
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when a PROCESSING request is already open', async () => {
    financeStubs({
      revenue: 50000,
      withdrawals: [{ id: 'w0', amount: 10000, status: WithdrawalStatus.PROCESSING }],
    });
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects free events and events with no paid revenue', async () => {
    financeStubs({ event: paidEvent({ paymentRequired: false }) });
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toThrow('paid events');
    financeStubs({ revenue: 0 });
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toThrow('No paid revenue');
  });

  it('rejects when organizer profile has no UPI ID and none supplied', async () => {
    mockRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', status: 'APPROVED', upiId: null });
    financeStubs();
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toThrow('UPI ID is required');
  });

  it('maps serialization failures to a retryable conflict', async () => {
    financeStubs();
    mockRepo.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('could not serialize access', {
        code: 'P2034',
        clientVersion: '5.22.0',
      }),
    );
    await expect(
      service.create({ eventId: EVENT_ID, amount: 10000 } as any, 'user1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  // ── Balance semantics ─────────────────────────────────────────

  it('PAID + PROCESSING withdrawals reduce availability; REJECTED releases it', async () => {
    financeStubs({
      revenue: 50000, // Rs.500
      withdrawals: [
        { id: 'wPaid', amount: 20000, status: WithdrawalStatus.PAID },
        { id: 'wProc', amount: 10000, status: WithdrawalStatus.PROCESSING },
        { id: 'wRej', amount: 30000, status: WithdrawalStatus.REJECTED }, // ignored
      ],
    });
    // available = 50000 - 20000 - 10000 = 20000, but an open request also blocks
    await expect(
      service.create({ eventId: EVENT_ID, amount: 20000 } as any, 'user1'),
    ).rejects.toBeInstanceOf(ConflictException); // open PROCESSING request exists
  });

  it('allows the exact available balance after a rejection released funds', async () => {
    financeStubs({
      revenue: 50000,
      withdrawals: [
        { id: 'wPaid', amount: 20000, status: WithdrawalStatus.PAID },
        { id: 'wRej', amount: 30000, status: WithdrawalStatus.REJECTED },
      ],
    });
    const res = await service.create({ eventId: EVENT_ID, amount: 30000 } as any, 'user1');
    expect(res.amount).toBe(30000);
  });

  it('event balance endpoint exposes revenue/reserved/paidOut/available', async () => {
    mockRepo.findEventById.mockResolvedValue(paidEvent());
    mockRepo.paidRevenueForEvent.mockResolvedValue(50000);
    mockRepo.findWithdrawalsForEvent.mockResolvedValue([
      { id: 'wPaid', amount: 20000, status: WithdrawalStatus.PAID },
    ]);
    mockRepo.findManyByEventId.mockResolvedValue([withdrawalRow({ id: 'wPaid', status: 'PAID', amount: 20000 })]);
    const res = await service.findByEvent(EVENT_ID, 'user1', 'ORGANIZER');
    expect(res.balance).toEqual({ revenue: 50000, reserved: 0, paidOut: 20000, available: 30000, openCount: 0 });
    expect(res.event.eventName).toBe('Tech Fest');
  });

  // ── Organizer views ───────────────────────────────────────────

  it('organizer sees own withdrawals but not another organizer withdrawal', async () => {
    mockRepo.findManyByOrganizerId.mockResolvedValue([withdrawalRow()]);
    const mine = await service.findMine('user1');
    expect(mine).toHaveLength(1);
    expect(mine[0]?.eventName).toBe('Tech Fest');

    mockRepo.findById.mockResolvedValue(withdrawalRow({ organizerId: 'orgX' }));
    await expect(service.findOne('w1', 'user1', 'ORGANIZER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('organizer cannot list another organizer event withdrawals', async () => {
    mockRepo.findEventById.mockResolvedValue(paidEvent({ organizerId: 'orgX' }));
    await expect(service.findByEvent(EVENT_ID, 'user1', 'ORGANIZER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('student has no organizer profile and cannot use withdrawal views', async () => {
    mockRepo.findOrganizerByUserId.mockResolvedValue(null);
    await expect(service.findMine('student1')).rejects.toBeInstanceOf(NotFoundException);
  });

  // ── Admin transitions ─────────────────────────────────────────

  function transitionOk(row: any) {
    mockRepo.transitionState.mockResolvedValue({ count: 1 });
    mockRepo.findById.mockResolvedValue(row);
  }

  function transitionBlocked(currentStatus: WithdrawalStatus) {
    mockRepo.transitionState.mockResolvedValue({ count: 0 });
    mockRepo.findById.mockResolvedValue(withdrawalRow({ status: currentStatus }));
  }

  it('admin processes REQUESTED → PROCESSING only', async () => {
    transitionOk(withdrawalRow({ status: WithdrawalStatus.PROCESSING }));
    const res = await service.process('w1');
    expect(res.status).toBe(WithdrawalStatus.PROCESSING);
    expect(mockRepo.transitionState).toHaveBeenCalledWith(
      expect.anything(),
      'w1',
      [WithdrawalStatus.REQUESTED],
      expect.objectContaining({ status: WithdrawalStatus.PROCESSING }),
    );

    transitionBlocked(WithdrawalStatus.PAID);
    await expect(service.process('w1')).rejects.toThrow('Cannot process');
    transitionBlocked(WithdrawalStatus.PROCESSING);
    await expect(service.process('w1')).rejects.toThrow('Cannot process');
  });

  it('admin rejects with reason; reason is stored and required', async () => {
    transitionOk(withdrawalRow({ status: WithdrawalStatus.REJECTED, rejectionReason: 'Insufficient documentation' }));
    const res = await service.reject('w1', 'Insufficient documentation');
    expect(res.status).toBe(WithdrawalStatus.REJECTED);
    expect(res.rejectionReason).toBe('Insufficient documentation');

    await expect(service.reject('w1', '')).rejects.toThrow('reason is required');
    await expect(service.reject('w1', '   ')).rejects.toThrow('reason is required');

    transitionBlocked(WithdrawalStatus.PAID);
    await expect(service.reject('w1', 'too late')).rejects.toThrow('Cannot reject');
  });

  it('admin marks PROCESSING → PAID with transactionId + proof; sets paidAt', async () => {
    mockRepo.findTransactionIdDuplicate.mockResolvedValue(null);
    transitionOk(
      withdrawalRow({ status: WithdrawalStatus.PAID, transactionId: 'TXN1', proofUrl: 'https://cdn.example.com/p.png', paidAt: new Date() }),
    );
    const res = await service.pay('w1', 'TXN1', 'https://cdn.example.com/p.png');
    expect(res.status).toBe(WithdrawalStatus.PAID);
    expect(res.transactionId).toBe('TXN1');
    expect(res.paidAt).not.toBeNull();
  });

  it('pay requires transactionId and proof, rejects REQUESTED and duplicates', async () => {
    await expect(service.pay('w1', '', 'https://cdn.example.com/p.png')).rejects.toThrow('Transaction ID is required');
    await expect(service.pay('w1', 'TXN1', '')).rejects.toThrow('proof URL is required');

    mockRepo.findTransactionIdDuplicate.mockResolvedValue(null);
    transitionBlocked(WithdrawalStatus.REQUESTED);
    await expect(service.pay('w1', 'TXN1', 'https://cdn.example.com/p.png')).rejects.toThrow('Cannot mark as paid');

    transitionBlocked(WithdrawalStatus.PAID);
    await expect(service.pay('w1', 'TXN1', 'https://cdn.example.com/p.png')).rejects.toThrow('Cannot mark as paid');

    mockRepo.findTransactionIdDuplicate.mockResolvedValue({ id: 'wOther' });
    await expect(service.pay('w1', 'TXN1', 'https://cdn.example.com/p.png')).rejects.toBeInstanceOf(ConflictException);
  });

  it('confirmPaid requires PROCESSING status, transaction ID and screenshot', async () => {
    mockRepo.findById.mockResolvedValue(withdrawalRow({ status: WithdrawalStatus.REQUESTED }));
    const file: any = { originalname: 'pay.png', mimetype: 'image/png', size: 1000, buffer: Buffer.from('x') };
    await expect(service.confirmPaid('w1', 'TXN1', file)).rejects.toThrow('Only PROCESSING');

    mockRepo.findById.mockResolvedValue(withdrawalRow({ status: WithdrawalStatus.PROCESSING }));
    await expect(service.confirmPaid('w1', '', file)).rejects.toThrow('Transaction ID is required');
    await expect(service.confirmPaid('w1', 'TXN1', undefined)).rejects.toThrow('screenshot is required');
  });

  it('confirmPaid uploads proof to R2 and marks PAID with timestamp', async () => {
    mockRepo.findById.mockResolvedValueOnce(withdrawalRow({ status: WithdrawalStatus.PROCESSING }));
    mockRepo.findTransactionIdDuplicate.mockResolvedValue(null);
    mockStorage.uploadProof.mockResolvedValue({ url: 'https://cdn.example.com/proofs/w1.png', key: 'proofs/w1.png' });
    transitionOk(
      withdrawalRow({ status: WithdrawalStatus.PAID, transactionId: 'TXN123', proofUrl: 'https://cdn.example.com/proofs/w1.png', paidAt: new Date() }),
    );
    const file: any = { originalname: 'pay.png', mimetype: 'image/png', size: 1000, buffer: Buffer.from('x') };
    const res = await service.confirmPaid('w1', 'TXN123', file);
    expect(mockStorage.uploadProof).toHaveBeenCalledWith(file, 'w1');
    expect(res.status).toBe(WithdrawalStatus.PAID);
    expect(res.proofUrl).toBe('https://cdn.example.com/proofs/w1.png');
  });

  it('proof is hidden from organizer before PAID but visible to admin', async () => {
    mockRepo.findById.mockResolvedValue(
      withdrawalRow({ status: WithdrawalStatus.PROCESSING, proofUrl: null }),
    );
    await expect(service.proofContent('w1', 'user1', 'ORGANIZER')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('admin can list and view any withdrawal', async () => {
    mockRepo.findAll.mockResolvedValue([withdrawalRow()]);
    const all = await service.findAll();
    expect(all).toHaveLength(1);

    mockRepo.findById.mockResolvedValue(withdrawalRow({ organizerId: 'orgX' }));
    const one = await service.findOne('w1', 'admin1', 'ADMIN');
    expect(one.id).toBe('w1');
  });

  it('unknown withdrawal IDs return 404', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findOne('missing', 'admin1', 'ADMIN')).rejects.toBeInstanceOf(NotFoundException);
    mockRepo.transitionState.mockResolvedValue({ count: 0 });
    await expect(service.process('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses organizerId from JWT profile, never from the request body', async () => {
    financeStubs();
    const res = await service.create(
      { eventId: EVENT_ID, amount: 10000, organizerId: 'attacker-org' } as any,
      'user1',
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizerId: 'org1' }),
    );
    expect(res.organizerId).toBe('org1');
  });

  it('guards: update-status style role metadata keeps pay/process/reject ADMIN-only', async () => {
    const { WithdrawalsController } = await import('./withdrawals.controller');
    for (const method of ['process', 'reject', 'pay', 'confirm', 'findAllAdmin', 'findOneAdmin'] as const) {
      const roles = Reflect.getMetadata('roles', WithdrawalsController.prototype[method]);
      expect(roles).toContain('ADMIN');
    }
    const createRoles = Reflect.getMetadata('roles', WithdrawalsController.prototype.create);
    expect(createRoles).toContain('ORGANIZER');
    expect(createRoles).not.toContain('STUDENT');
  });
});
