import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { WhatsappService } from './whatsapp.service';
import { MetaWhatsappProvider } from './whatsapp.provider';

const TOKEN = 'test-access-token-xyz';

const mockPrisma: any = {
  registration: { findUnique: jest.fn() },
  ticket: { findUnique: jest.fn() },
  whatsappDelivery: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  admin: { findMany: jest.fn().mockResolvedValue([]) },
  user: { findMany: jest.fn().mockResolvedValue([]) },
  organizer: { findUnique: jest.fn() },
  withdrawal: { findUnique: jest.fn() },
  withdrawalNotification: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
};

const mockProvider = { sendTemplate: jest.fn() };

const mockConfig: any = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      WHATSAPP_ACCESS_TOKEN: TOKEN,
      WHATSAPP_PHONE_NUMBER_ID: '123456789',
      WHATSAPP_API_VERSION: 'v21.0',
      WHATSAPP_TICKET_TEMPLATE: 'ticket_details',
      WHATSAPP_TEMPLATE_NAME: 'bepart_ticket_confirmation',
      WHATSAPP_TEMPLATE_LANGUAGE: 'en',
    };
    return map[key];
  }),
};

const reg = (over: any = {}) => ({
  registrationId: 'r1',
  phone: '9876543210',
  formData: { fullName: 'Asha' },
  event: { id: 'e1', eventName: 'Tech Fest', date: new Date('2026-10-05T10:00:00Z') },
  ticket: { id: 't1', code: 'code-1', ticketUrl: 'http://localhost:5173/ticket/code-1', status: 'VALID' },
  ...over,
});

describe('WhatsappService - ticket confirmation', () => {
  let service: WhatsappService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: MetaWhatsappProvider, useValue: mockProvider },
      ],
    }).compile();
    service = mod.get(WhatsappService);
  });

  function freshRow(ticketId = 't1') {
    return { id: 'd1', ticketId, phone: '9876543210', status: 'PENDING', attempts: 0 };
  }

  it('1. sends the template successfully and records SENT with the provider id', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(reg());
    mockPrisma.whatsappDelivery.create.mockResolvedValue(freshRow());
    mockProvider.sendTemplate.mockResolvedValue({ providerMessageId: 'wamid.123' });

    const res = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(res.status).toBe('sent');
    expect(mockProvider.sendTemplate).toHaveBeenCalledTimes(1);
    expect(mockPrisma.whatsappDelivery.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'SENT', providerMessageId: 'wamid.123', lastError: null },
    });
  });

  it('2-5. uses the ticket_details contract: body [name,event,date,time,venue] + URL button [code]', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(reg());
    mockPrisma.whatsappDelivery.create.mockResolvedValue(freshRow());
    mockProvider.sendTemplate.mockResolvedValue({ providerMessageId: 'wamid.1' });

    await service.notifyTicketReady({ registrationId: 'r1' });

    expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: TOKEN, phoneNumberId: '123456789', apiVersion: 'v21.0' }),
      expect.objectContaining({
        to: '919876543210',
        templateName: 'ticket_details',
        languageCode: 'en',
      }),
    );
    const components = mockProvider.sendTemplate.mock.calls[0][1].components;
    expect(components[0]).toEqual({
      type: 'body',
      parameters: expect.arrayContaining([
        { type: 'text', text: 'Asha' },
        { type: 'text', text: 'Tech Fest' },
      ]),
    });
    expect(components[0].parameters).toHaveLength(5);
    expect(components[0].parameters[4]).toEqual({ type: 'text', text: 'See ticket' });
    expect(components[1]).toEqual({
      type: 'button',
      sub_type: 'url',
      index: 0,
      parameters: [{ type: 'text', text: 'code-1' }],
    });
  });

  it('6. does not send when the ticket does not exist yet', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({ registrationId: 'r1', phone: '1', ticket: null });

    const res = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(res.status).toBe('skipped');
    expect(mockProvider.sendTemplate).not.toHaveBeenCalled();
    expect(mockPrisma.whatsappDelivery.create).not.toHaveBeenCalled();
  });

  it('skips cancelled tickets without sending', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(
      reg({ ticket: { id: 't1', code: 'c', ticketUrl: 'u', status: 'CANCELLED' } }),
    );

    const res = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(res.status).toBe('skipped');
    expect(mockProvider.sendTemplate).not.toHaveBeenCalled();
  });

  it('8+11. provider failure records FAILED without touching the ticket', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(reg());
    mockPrisma.whatsappDelivery.create.mockResolvedValue(freshRow());
    mockProvider.sendTemplate.mockRejectedValue(new Error('Meta exploded'));

    const res = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(res.status).toBe('failed');
    expect(mockPrisma.whatsappDelivery.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'FAILED', lastError: expect.stringContaining('Meta exploded') },
    });
    // Ticket row is never written by this service.
    expect(mockPrisma.ticket.findUnique).not.toHaveBeenCalled();
  });

  it('9. duplicate processing for an already-SENT ticket never re-sends', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(reg());
    const dup: any = new Error('Unique constraint');
    dup.code = 'P2002';
    mockPrisma.whatsappDelivery.create.mockRejectedValue(dup);
    mockPrisma.whatsappDelivery.findUnique.mockResolvedValue({ ...freshRow(), status: 'SENT' });

    const res = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(res.status).toBe('duplicate');
    expect(mockProvider.sendTemplate).not.toHaveBeenCalled();
  });

  it('10. missing phone is recorded as FAILED safely (ticket stays valid)', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(reg({ phone: '' }));
    mockPrisma.whatsappDelivery.create.mockResolvedValue(freshRow());

    const res = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(res.status).toBe('failed');
    expect(res.reason).toBe('missing-or-invalid-phone');
    expect(mockProvider.sendTemplate).not.toHaveBeenCalled();
    expect(mockPrisma.whatsappDelivery.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'FAILED', lastError: 'missing-or-invalid-phone' },
    });
  });

  it('12. access token never appears in results', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue(reg());
    mockPrisma.whatsappDelivery.create.mockResolvedValue(freshRow());
    mockProvider.sendTemplate.mockResolvedValue({ providerMessageId: 'wamid.2' });

    const ok = await service.notifyTicketReady({ registrationId: 'r1' });
    mockProvider.sendTemplate.mockRejectedValueOnce(new Error('nope'));
    const bad = await service.notifyTicketReady({ registrationId: 'r1' });

    expect(JSON.stringify(ok)).not.toContain(TOKEN);
    expect(JSON.stringify(bad)).not.toContain(TOKEN);
  });

  it('skips everything when WhatsApp is not configured (no DB writes)', async () => {
    // Deterministic regardless of developer .env: importing @prisma/client
    // loads server/.env into process.env, and WhatsappService falls back to
    // process.env when ConfigService returns undefined. Strip the real keys
    // for this test and restore them afterwards.
    const origImpl = mockConfig.get.getMockImplementation();
    const savedToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const savedPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    mockConfig.get.mockImplementation(() => undefined);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    try {
      const res = await service.notifyTicketReady({ registrationId: 'r1' });

      expect(res.status).toBe('skipped');
      expect(mockPrisma.registration.findUnique).not.toHaveBeenCalled();
    } finally {
      mockConfig.get.mockImplementation(origImpl);
      if (savedToken !== undefined) process.env.WHATSAPP_ACCESS_TOKEN = savedToken;
      if (savedPhoneId !== undefined) process.env.WHATSAPP_PHONE_NUMBER_ID = savedPhoneId;
    }
  });

  it('retryFailed re-attempts FAILED rows and leaves exhausted ones alone', async () => {
    const failedRow = { ...freshRow('t9'), status: 'FAILED', attempts: 1 };
    mockPrisma.whatsappDelivery.findMany.mockResolvedValue([failedRow]);
    mockPrisma.ticket.findUnique.mockResolvedValue({
      id: 't9',
      code: 'code-9',
      ticketUrl: 'http://localhost:5173/ticket/code-9',
      status: 'VALID',
      registration: reg({ ticket: undefined }),
    });
    mockProvider.sendTemplate.mockResolvedValue({ providerMessageId: 'wamid.9' });

    const res = await service.retryFailed();

    expect(res).toEqual({ attempted: 1, sent: 1 });
    expect(mockProvider.sendTemplate).toHaveBeenCalledTimes(1);
  });

  describe('sendOtp logging (mock)', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    afterEach(() => {
      process.env.NODE_ENV = prevNodeEnv;
      jest.restoreAllMocks();
    });

    it('never logs OTP values in production', async () => {
      process.env.NODE_ENV = 'production';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const loggerSpy = jest.spyOn((service as any).logger, 'log').mockImplementation(() => {});

      await service.sendOtp('+919876543210', '123456');

      expect(consoleSpy).not.toHaveBeenCalled();
      const logged = loggerSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(logged).not.toContain('123456');
    });

    it('keeps dev console behavior outside production', async () => {
      process.env.NODE_ENV = 'test';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await service.sendOtp('+919876543210', '123456');

      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('payout notifications (side effects only)', () => {
    const withdrawal = (over: any = {}) => ({
      id: 'w1',
      amount: 250000,
      upiId: 'org@upi',
      status: 'REQUESTED',
      transactionId: 'TXN123',
      proofUrl: 'https://r2.example.com/proofs/w1.png',
      rejectionReason: 'Wrong UPI',
      organizerId: 'org1',
      organizer: { id: 'org1', name: 'Tech Club', phone: '9876543210' },
      event: { id: 'e1', eventName: 'Tech Fest' },
      ...over,
    });

    beforeEach(() => {
      mockPrisma.withdrawal.findUnique.mockResolvedValue(withdrawal());
      mockPrisma.withdrawalNotification.create.mockImplementation(async (args: any) => ({
        id: 'n1',
        ...args.data,
      }));
      mockPrisma.withdrawalNotification.update.mockResolvedValue({});
      mockProvider.sendTemplate.mockResolvedValue({ providerMessageId: 'wamid.p' });
    });

    it('notifyPayoutRequest uses payout_request contract and notifies DB admins', async () => {
      mockPrisma.admin.findMany.mockResolvedValue([{ phone: '9123456780' }]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await service.notifyPayoutRequest('w1');

      expect(res).toEqual({ attempted: 1, sent: 1, failed: 0 });
      expect(mockProvider.sendTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ to: '919123456780', templateName: 'payout_request' }),
      );
      const components = mockProvider.sendTemplate.mock.calls[0][1].components;
      expect(components[0].parameters.map((p: any) => p.text)).toEqual([
        '₹2,500',
        'Tech Club',
        'Tech Fest',
        'w1',
      ]);
      expect(components[1]).toMatchObject({ type: 'button', sub_type: 'url', index: 0 });
    });

    it('notifyPayoutRequest skips when no admin phone exists (request kept)', async () => {
      mockPrisma.admin.findMany.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await service.notifyPayoutRequest('w1');

      expect(res).toEqual({ attempted: 0, sent: 0, failed: 0 });
      expect(mockProvider.sendTemplate).not.toHaveBeenCalled();
    });

    it('notifyPayoutSuccess sends image header with the public proof URL', async () => {
      mockPrisma.organizer.findUnique.mockResolvedValue({ phone: '9876543210', user: null });

      const res = await service.notifyPayoutSuccess('w1');

      expect(res.sent).toBe(1);
      const components = mockProvider.sendTemplate.mock.calls[0][1].components;
      expect(components[0]).toEqual({
        type: 'header',
        parameters: [{ type: 'image', image: { link: 'https://r2.example.com/proofs/w1.png' } }],
      });
      expect(components[1].parameters.map((p: any) => p.text)).toEqual(['Tech Club', '₹2,500', 'TXN123']);
    });

    it('notifyPayoutSuccess falls back to body-only for local:// proofs (payout kept PAID)', async () => {
      mockPrisma.withdrawal.findUnique.mockResolvedValue(withdrawal({ proofUrl: 'local://proofs/w1.png' }));
      mockPrisma.organizer.findUnique.mockResolvedValue({ phone: null, user: { phone: '9876543210' } });

      const res = await service.notifyPayoutSuccess('w1');

      expect(res.sent).toBe(1);
      const components = mockProvider.sendTemplate.mock.calls[0][1].components;
      expect(components).toHaveLength(1);
      expect(components[0].type).toBe('body');
    });

    it('notifyPayoutRejected includes the rejection reason', async () => {
      mockPrisma.organizer.findUnique.mockResolvedValue({ phone: '9876543210', user: null });

      const res = await service.notifyPayoutRejected('w1');

      expect(res.sent).toBe(1);
      const components = mockProvider.sendTemplate.mock.calls[0][1].components;
      expect(components[0].parameters.map((p: any) => p.text)).toEqual([
        'Tech Club',
        '₹2,500',
        'w1',
        'Wrong UPI',
      ]);
    });

    it('provider failure records FAILED without throwing (business op untouched)', async () => {
      mockPrisma.admin.findMany.mockResolvedValue([{ phone: '9123456780' }]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockProvider.sendTemplate.mockRejectedValueOnce(new Error('Meta exploded'));

      const res = await service.notifyPayoutRequest('w1');

      expect(res).toEqual({ attempted: 1, sent: 0, failed: 1 });
      expect(mockPrisma.withdrawalNotification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'n1' },
          data: expect.objectContaining({ status: 'FAILED', lastError: expect.stringContaining('Meta exploded') }),
        }),
      );
    });
  });
});
