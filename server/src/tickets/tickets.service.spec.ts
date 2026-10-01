import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repo';

const baseTicket = (overrides: any = {}) => ({
  id: 'tick1',
  code: 'code-1',
  qrToken: 'qr-1',
  registrationId: 'reg1',
  eventId: 'ev1',
  ticketUrl: 'http://localhost:5173/ticket/code-1',
  status: 'VALID',
  checkedInAt: null,
  createdAt: new Date(),
  registration: {
    registrationId: 'reg1',
    phone: '9999999999',
    formData: { fullName: 'Asha' },
    paymentStatus: 'PAID',
  },
  event: { id: 'ev1', eventName: 'Tech Fest', organizerId: 'org1', paymentRequired: true, status: 'PUBLISHED' },
  ...overrides,
});

describe('TicketsService', () => {
  let service: TicketsService;
  const mockRepo: any = {
    findByCode: jest.fn(),
    findByQrToken: jest.fn(),
    findByRegistrationId: jest.fn(),
    findTicketWithRelations: jest.fn(),
    findOrganizerByUserId: jest.fn(),
    findUserById: jest.fn(),
    findTicketsByPhones: jest.fn(),
    checkInAtomic: jest.fn(),
  };
  const orgActor = { userId: 'u1', role: 'ORGANIZER' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [TicketsService, { provide: TicketsRepository, useValue: mockRepo }],
    }).compile();
    service = mod.get(TicketsService);
    mockRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org1', userId: 'u1' });
  });

  it('validates a ticket by code for the owning organizer', async () => {
    mockRepo.findByCode.mockResolvedValue(baseTicket());
    const res: any = await service.validate('code-1', orgActor);
    expect(res.registration.participantName).toBe('Asha');
    expect(res.event.eventName).toBe('Tech Fest');
    expect(res.checkedIn).toBe(false);
  });

  it('resolves ticket URL and QR token forms', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByQrToken.mockResolvedValue(baseTicket());
    const res: any = await service.validate('http://localhost:5173/ticket/code-1?x=1', orgActor);
    expect(mockRepo.findByQrToken).toHaveBeenCalledWith('code-1');
    expect(res.ticket.code).toBe('code-1');
  });

  it('404s on unknown tickets', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByQrToken.mockResolvedValue(null);
    mockRepo.findByRegistrationId.mockResolvedValue(null);
    await expect(service.validate('nope', orgActor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('403s when the organizer does not own the event (eventId never trusted from client)', async () => {
    mockRepo.findByCode.mockResolvedValue(baseTicket({ event: { id: 'evX', organizerId: 'orgX' } }));
    await expect(service.validate('code-1', orgActor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects unpaid registrations for paid events', async () => {
    const t = baseTicket();
    (t.registration as any).paymentStatus = 'PENDING';
    mockRepo.findByCode.mockResolvedValue(t);
    await expect(service.validate('code-1', orgActor)).rejects.toThrow('not completed');
  });

  it('checks in and returns participant details', async () => {
    mockRepo.findByCode.mockResolvedValue(baseTicket());
    mockRepo.checkInAtomic.mockResolvedValue({ already: false, ticket: {} });
    mockRepo.findTicketWithRelations.mockResolvedValue(
      baseTicket({ status: 'CHECKED_IN', checkedInAt: new Date('2026-09-29T10:00:00Z') }),
    );
    const res: any = await service.checkIn('code-1', orgActor);
    expect(res.participantName).toBe('Asha');
    expect(res.ticketId).toBe('code-1');
    expect(res.checkedInAt).toBeDefined();
  });

  it('409s on duplicate check-in with the original time', async () => {
    mockRepo.findByCode.mockResolvedValue(baseTicket({ status: 'CHECKED_IN', checkedInAt: new Date() }));
    mockRepo.checkInAtomic.mockResolvedValue({ already: true, ticket: {} });
    mockRepo.findTicketWithRelations.mockResolvedValue(
      baseTicket({ status: 'CHECKED_IN', checkedInAt: new Date('2026-09-29T10:00:00Z') }),
    );
    await expect(service.checkIn('code-1', orgActor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('public lookup exposes no payment internals', async () => {
    mockRepo.findByCode.mockResolvedValue(baseTicket());
    const res: any = await service.findPublicTicket('code-1');
    expect(res.ticket.code).toBe('code-1');
    expect(res.registration.participantName).toBe('Asha');
    expect(JSON.stringify(res)).not.toMatch(/originalAmount|discountAmount|razorpay/i);
  });

  it('findMine matches the account phone', async () => {
    mockRepo.findUserById.mockResolvedValue({ id: 'u9', phone: '+91 9999999999' });
    mockRepo.findTicketsByPhones.mockResolvedValue([{ code: 'code-1' }]);
    const res = await service.findMine('u9');
    expect(mockRepo.findTicketsByPhones).toHaveBeenCalledWith(['+91 9999999999', '9999999999']);
    expect(res).toHaveLength(1);
  });

  it('ADMIN bypasses ownership', async () => {
    mockRepo.findByCode.mockResolvedValue(baseTicket());
    const res: any = await service.validate('code-1', { userId: 'admin', role: 'ADMIN' });
    expect(res.ticket.code).toBe('code-1');
    expect(mockRepo.findOrganizerByUserId).not.toHaveBeenCalled();
  });

  it('requires a ticket identifier', async () => {
    await expect(service.validate('   ', orgActor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
