import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailerService } from './mailer.service';
import { buildOtpEmail, isValidEmail, normalizeEmail } from './templates/otp-email.template';

jest.mock('nodemailer');

const mockedNodemailer = nodemailer as unknown as { createTransport: jest.Mock };

describe('otp-email.template (Pravesh contract)', () => {
  it('builds subject/text/html with the OTP and expiry', () => {
    const { subject, text, html } = buildOtpEmail({ otp: '482916', appName: 'BePart', expiryMinutes: 5 });
    expect(subject).toContain('482916');
    expect(subject).toContain('BePart');
    expect(text).toContain('482916');
    expect(text).toContain('5 minute(s)');
    expect(html).toContain('482916');
  });

  it('escapes HTML in app name and OTP', () => {
    const { html } = buildOtpEmail({ otp: '<b>1</b>', appName: '<script>' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('validates and normalizes emails', () => {
    expect(normalizeEmail('  Admin@Example.COM ')).toBe('admin@example.com');
    expect(isValidEmail('admin@example.com')).toBe(true);
    expect(isValidEmail('not-an-email')).toBe(false);
  });
});

describe('MailerService (Gmail/SMTP delivery only)', () => {
  const sendMail = jest.fn();

  function configFor(values: Record<string, string | undefined>) {
    return {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key in values) return values[key];
        return defaultValue;
      }),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: 'smtp-id-1' });
    mockedNodemailer.createTransport.mockReturnValue({ sendMail, verify: jest.fn() } as any);
  });

  async function serviceWith(values: Record<string, string | undefined>) {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [MailerService, { provide: ConfigService, useValue: configFor(values) }],
    }).compile();
    return mod.get(MailerService);
  }

  const smtpEnv = {
    NODE_ENV: 'test',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'bot@example.com',
    SMTP_PASS: 'app-password',
    SMTP_FROM: 'bot@example.com',
    SMTP_FROM_NAME: 'BePart',
  };

  it('reports unconfigured SMTP and falls back without throwing', async () => {
    const service = await serviceWith({ NODE_ENV: 'test' });
    expect(service.isConfigured()).toBe(false);
    const res = await service.sendOtpEmail('admin@example.com', '123456');
    expect(res).toEqual({ delivered: false, reason: 'smtp-not-configured' });
    expect(mockedNodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('rejects invalid email addresses', async () => {
    const service = await serviceWith(smtpEnv);
    await expect(service.sendOtpEmail('not-an-email', '123456')).rejects.toThrow(
      '"to" must be a valid email address',
    );
  });

  it('sends via STARTTLS on 587 with TLS >= 1.2 (Pravesh transport options)', async () => {
    const service = await serviceWith(smtpEnv);
    expect(service.isConfigured()).toBe(true);
    const res = await service.sendOtpEmail('Admin@Example.com', '654321', { expiryMinutes: 5 });
    expect(res.delivered).toBe(true);
    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        tls: { minVersion: 'TLSv1.2' },
      }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@example.com', subject: expect.stringContaining('654321') }),
    );
  });

  it('uses implicit TLS on 465', async () => {
    const service = await serviceWith({ ...smtpEnv, SMTP_PORT: '465' });
    await service.sendOtpEmail('admin@example.com', '654321');
    expect(mockedNodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 465, secure: true }),
    );
  });

  it('wraps transport errors instead of swallowing them', async () => {
    sendMail.mockRejectedValueOnce(new Error('connection refused'));
    const service = await serviceWith(smtpEnv);
    await expect(service.sendOtpEmail('admin@example.com', '654321')).rejects.toThrow('SMTP send failed');
  });

  it('surfaces recipient-specific SMTP rejections (code/response) without credentials', async () => {
    const rejection: any = new Error('Mailbox unavailable');
    rejection.code = 'EENVELOPE';
    rejection.responseCode = 550;
    rejection.response = '550 5.1.1 The email account does not exist';
    sendMail.mockRejectedValueOnce(rejection);
    const service = await serviceWith(smtpEnv);
    await expect(service.sendOtpEmail('ghost@example.com', '654321')).rejects.toThrow(
      /SMTP send failed: .*EENVELOPE.*550/,
    );
  });

  it('maskEmail sanitizes recipients for diagnostics', async () => {
    const { maskEmail } = await import('./templates/otp-email.template');
    expect(maskEmail('Friend@Gmail.com')).toBe('f***@gmail.com');
    expect(maskEmail('not-an-email')).toBe('***');
  });
});
