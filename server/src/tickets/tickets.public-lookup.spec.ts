import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repo';

const publicTicket = (overrides: any = {}) => ({
  id: 'tick1',
  code: 'code-1',
  qrToken: 'qr-1',
  registrationId: 'reg1',
  eventId: 'ev1',
  ticketUrl: 'https://www.bepart.in/ticket/code-1',
  status: 'VALID',
  checkedInAt: null,
  createdAt: new Date(),
  registration: {
    registrationId: 'reg1',
    phone: '9999999999',
    formData: { fullName: 'Asha' },
    paymentStatus: 'PAID',
  },
  event: {
    id: 'ev1',
    eventName: 'Tech Fest',
    date: new Date('2026-10-05T10:00:00Z'),
    closingTime: null,
    status: 'PUBLISHED',
    formStructure: { title: 't', sections: [] },
    organizer: { id: 'org1', name: 'Tech Club' },
    organizerId: 'org1',
    paymentRequired: false,
  },
  ...overrides,
});

describe('TicketsService public lookup (participant ticket page)', () => {
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [TicketsService, { provide: TicketsRepository, useValue: mockRepo }],
    }).compile();
    service = mod.get(TicketsService);
  });

  it('opens with a ticket code and returns ticket + registration + event + QR-safe URL', async () => {
    mockRepo.findByCode.mockResolvedValue(publicTicket());
    const res: any = await service.findPublicTicket('code-1');
    expect(mockRepo.findByCode).toHaveBeenCalledWith('code-1');
    expect(res.ticket.code).toBe('code-1');
    expect(res.ticket.ticketUrl).toBe('https://www.bepart.in/ticket/code-1');
    expect(res.registration.registrationId).toBe('reg1');
    expect(res.registration.participantName).toBe('Asha');
    expect(res.event.eventName).toBe('Tech Fest');
  });

  it('opens with a full ticket URL (WhatsApp button target)', async () => {
    mockRepo.findByCode.mockResolvedValue(publicTicket());
    const res: any = await service.findPublicTicket('https://www.bepart.in/ticket/code-1');
    expect(mockRepo.findByCode).toHaveBeenCalledWith('code-1');
    expect(res.ticket.code).toBe('code-1');
  });

  it('retains legacy registration-ID compatibility', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByQrToken.mockResolvedValue(null);
    mockRepo.findByRegistrationId.mockResolvedValue(publicTicket());
    const res: any = await service.findPublicTicket('reg1');
    expect(mockRepo.findByRegistrationId).toHaveBeenCalledWith('reg1');
    expect(res.ticket.code).toBe('code-1');
    expect(res.registration.registrationId).toBe('reg1');
  });

  it('resolves QR tokens', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByQrToken.mockResolvedValue(publicTicket());
    const res: any = await service.findPublicTicket('qr-1');
    expect(res.ticket.code).toBe('code-1');
  });

  it('throws 404 only for genuinely unknown tickets', async () => {
    mockRepo.findByCode.mockResolvedValue(null);
    mockRepo.findByQrToken.mockResolvedValue(null);
    mockRepo.findByRegistrationId.mockResolvedValue(null);
    await expect(service.findPublicTicket('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exposes no payment internals or phone numbers', async () => {
    mockRepo.findByCode.mockResolvedValue(publicTicket());
    const res: any = await service.findPublicTicket('code-1');
    expect(JSON.stringify(res)).not.toMatch(/originalAmount|discountAmount|razorpay/i);
    expect(JSON.stringify(res.registration)).not.toContain('9999999999');
    expect(res.registration.paymentStatus).toBeUndefined();
  });
});
