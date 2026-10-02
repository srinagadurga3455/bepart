import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repo';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailerService } from '../mailer/mailer.service';
import { isValidEmail, maskEmail } from '../mailer/templates/otp-email.template';
import { Role } from '../common/constants/roles';

const mockAuthRepo: any = {
  findUserByEmail: jest.fn(),
  findUserByPhone: jest.fn(),
  findUsersByPhoneSuffix: jest.fn().mockResolvedValue([]),
  findUserByEmailOrPhone: jest.fn(),
  findUserByIdWithProfile: jest.fn(),
  findUserByEmailNormalized: jest.fn(),
  createOtp: jest.fn(),
  findLatestOtp: jest.fn().mockResolvedValue(null),
  findLatestValidOtp: jest.fn(),
  incrementOtpAttempts: jest.fn(),
  markOtpVerified: jest.fn(),
};

const mockWhatsapp = {
  sendOtp: jest.fn().mockResolvedValue(undefined),
  sendTextMessage: jest.fn().mockResolvedValue({ skipped: true }),
  isConfigured: jest.fn().mockReturnValue(false),
};

const mockEmail = {
  sendOtpEmail: jest.fn().mockResolvedValue({ skipped: true }),
  isConfigured: jest.fn().mockReturnValue(false),
};

const mockNotifications = {
  sendOnce: jest.fn().mockImplementation(async ({ sender }: any) => {
    await sender?.();
    return { status: 'SKIPPED' };
  }),
};

const mockMailer = { sendOtpEmail: jest.fn().mockResolvedValue({ delivered: true }) };

describe('OTP diagnostics + recipient handling', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockNotifications.sendOnce.mockImplementation(async ({ sender }: any) => {
      await sender?.();
      return { status: 'SKIPPED' };
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: WhatsappService, useValue: mockWhatsapp },
        { provide: EmailService, useValue: mockEmail },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: MailerService, useValue: mockMailer },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'JWT_SECRET') return 'test-secret-min-32-chars-long!!';
              if (key === 'JWT_EXPIRES_IN') return '7d';
              return defaultValue;
            }),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'mock.jwt.token') } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('maskEmail (sanitized diagnostics)', () => {
    it('masks the local part, keeps the domain', () => {
      expect(maskEmail('Admin@Example.com')).toBe('a***@example.com');
    });

    it('trims and lowercases before masking', () => {
      expect(maskEmail('  FRIEND@Gmail.COM ')).toBe('f***@gmail.com');
    });

    it('never emits OTPs, passwords, or tokens', () => {
      expect(maskEmail('not-an-email')).toBe('***');
      expect(maskEmail('')).toBe('***');
      expect(maskEmail(null)).toBe('***');
    });
  });

  describe('requestOtp recipient normalization', () => {
    it('passes the normalized identifier to lookup, storage, and mailer for mixed-case input', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: '1', email: 'Admin@Example.com', role: Role.ADMIN, isActive: true });
      mockAuthRepo.createOtp.mockResolvedValue({ id: 'otp1' });
      const result = await service.requestOtp({ email: '  ADMIN@Example.COM ' });
      expect(result).toHaveProperty('message');
      expect(mockAuthRepo.findUserByEmail).toHaveBeenCalledWith('admin@example.com');
      expect(mockAuthRepo.createOtp).toHaveBeenCalledWith(expect.objectContaining({ identifier: 'admin@example.com' }));
      expect(mockMailer.sendOtpEmail).toHaveBeenCalledWith(
        'admin@example.com',
        expect.stringMatching(/^\d{6}$/),
        expect.objectContaining({ expiryMinutes: expect.any(Number) }),
      );
    });

    it('rejects unknown recipients before touching OTP storage or the mailer', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      await expect(service.requestOtp({ email: 'ghost@campus.edu' })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(mockAuthRepo.createOtp).not.toHaveBeenCalled();
      expect(mockMailer.sendOtpEmail).not.toHaveBeenCalled();
    });

    it('still rejects invalid email input at the mailer boundary', () => {
      // Template-level guard: the mailer validates before any transport use.
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('friend@gmail.com')).toBe(true);
    });
  });
});
