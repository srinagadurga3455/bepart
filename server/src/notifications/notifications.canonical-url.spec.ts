import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../database/prisma.service';

describe('NotificationsService canonical ticket URL (WhatsApp)', () => {
  let service: NotificationsService;
  const sendTicketMessage = jest.fn().mockResolvedValue({ messageId: 'wamid.1', skipped: false });
  const mockPrisma: any = {
    registration: { findUnique: jest.fn() },
    organizer: { findUnique: jest.fn().mockResolvedValue({ name: 'Tech Club' }) },
    notificationLog: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({}) },
  };
  const mockWhatsapp: any = { sendTicketMessage };
  const mockConfig: any = { get: jest.fn(() => 'https://www.bepart.in') };

  beforeEach(async () => {
    jest.clearAllMocks();
    sendTicketMessage.mockResolvedValue({ messageId: 'wamid.1', skipped: false });
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: 'EmailService', useValue: undefined },
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();
    service = new NotificationsService(mockPrisma, undefined, mockWhatsapp, mockConfig);
    void mod;
  });

  it('uses the stored canonical ticketUrl instead of reconstructing one', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      registrationId: 'reg1',
      phone: '9876543210',
      formData: { fullName: 'Asha' },
      event: { id: 'e1', eventName: 'Tech Fest', date: new Date('2026-10-05T10:00:00Z'), organizerId: 'org1' },
      ticket: { code: 'code-1', ticketUrl: 'https://www.bepart.in/ticket/code-1', status: 'VALID' },
    });
    await service.sendTicketNotifications({ registrationId: 'reg1', kind: 'confirmation' });
    expect(sendTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketNumber: 'code-1',
        ticketUrl: 'https://www.bepart.in/ticket/code-1',
      }),
    );
  });

  it('builds a code-based canonical URL when the stored one is missing', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({
      registrationId: 'reg1',
      phone: '9876543210',
      formData: { fullName: 'Asha' },
      event: { id: 'e1', eventName: 'Tech Fest', date: new Date('2026-10-05T10:00:00Z'), organizerId: 'org1' },
      ticket: { code: 'code-9', ticketUrl: null, status: 'VALID' },
    });
    await service.sendTicketNotifications({ registrationId: 'reg1', kind: 'confirmation' });
    expect(sendTicketMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketNumber: 'code-9',
        ticketUrl: 'https://www.bepart.in/ticket/code-9',
      }),
    );
  });
});
