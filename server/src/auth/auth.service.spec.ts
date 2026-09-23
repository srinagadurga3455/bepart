import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repo';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Role } from '../common/constants/roles';

const mockAuthRepo: any = {
  findUserByEmail: jest.fn(),
  findUserByPhone: jest.fn(),
  findUserByEmailOrPhone: jest.fn(),
  findUserByIdWithProfile: jest.fn(),
  findUserByEmailNormalized: jest.fn(),
  createOtp: jest.fn(),
  findLatestValidOtp: jest.fn(),
  incrementOtpAttempts: jest.fn(),
  markOtpVerified: jest.fn(),
};

const mockWhatsapp = { sendOtp: jest.fn().mockResolvedValue(undefined) };

describe('AuthService OTP', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepo },
        { provide: WhatsappService, useValue: mockWhatsapp },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'JWT_SECRET') return 'test-secret-min-32-chars-long!!';
              if (key === 'JWT_EXPIRES_IN') return '7d';
              if (key === 'BCRYPT_SALT_ROUNDS') return 4;
              return defaultValue;
            }),
          },
        },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'mock.jwt.token') } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  describe('login (disabled)', () => {
    it('should throw BadRequest for password login', async () => {
      await expect(service.login({ email: 'test@campus.edu', password: 'pass' } as any)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('requestOtp', () => {
    it('should generate OTP for ADMIN', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: '1', email: 'admin@pravesh.local', role: Role.ADMIN, isActive: true });
      mockAuthRepo.createOtp.mockResolvedValue({ id: 'otp1' });
      const result = await service.requestOtp({ email: 'admin@pravesh.local' });
      expect(result).toHaveProperty('message');
      expect(mockAuthRepo.createOtp).toHaveBeenCalled();
      expect(mockWhatsapp.sendOtp).toHaveBeenCalled();
    });

    it('should reject unknown user', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue(null);
      await expect(service.requestOtp({ email: 'no@campus.edu' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject STUDENT role', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: '1', email: 's@campus.edu', role: Role.STUDENT, isActive: true });
      await expect(service.requestOtp({ email: 's@campus.edu' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject deactivated', async () => {
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: '1', email: 'admin@pravesh.local', role: Role.ADMIN, isActive: false });
      await expect(service.requestOtp({ email: 'admin@pravesh.local' })).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('verifyOtp', () => {
    it('should return JWT on valid OTP', async () => {
      const otp = '123456';
      const hash = await bcrypt.hash(otp, 4);
      mockAuthRepo.findLatestValidOtp.mockResolvedValue({
        id: 'otp1',
        identifier: 'admin@pravesh.local',
        otpHash: hash,
        purpose: 'ADMIN_LOGIN',
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        verified: false,
      });
      mockAuthRepo.findUserByEmail.mockResolvedValue({ id: '1', email: 'admin@pravesh.local', role: Role.ADMIN, isActive: true, name: 'Admin' });
      mockAuthRepo.findUserByEmailOrPhone.mockResolvedValue(null);
      mockAuthRepo.markOtpVerified.mockResolvedValue({});
      const result = await service.verifyOtp({ email: 'admin@pravesh.local', otp });
      expect(result).toHaveProperty('accessToken');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should reject invalid OTP', async () => {
      const hash = await bcrypt.hash('123456', 4);
      mockAuthRepo.findLatestValidOtp.mockResolvedValue({
        id: 'otp1',
        identifier: 'admin@pravesh.local',
        otpHash: hash,
        purpose: 'ADMIN_LOGIN',
        expiresAt: new Date(Date.now() + 60000),
        attempts: 0,
        verified: false,
      });
      mockAuthRepo.incrementOtpAttempts.mockResolvedValue({});
      await expect(service.verifyOtp({ email: 'admin@pravesh.local', otp: '000000' })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('should reject expired OTP', async () => {
      mockAuthRepo.findLatestValidOtp.mockResolvedValue(null);
      await expect(service.verifyOtp({ email: 'admin@pravesh.local', otp: '123456' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject too many attempts', async () => {
      const hash = await bcrypt.hash('123456', 4);
      mockAuthRepo.findLatestValidOtp.mockResolvedValue({
        id: 'otp1',
        identifier: 'admin@pravesh.local',
        otpHash: hash,
        purpose: 'ADMIN_LOGIN',
        expiresAt: new Date(Date.now() + 60000),
        attempts: 5,
        verified: false,
      });
      await expect(service.verifyOtp({ email: 'admin@pravesh.local', otp: '123456' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getMe', () => {
    it('should sanitize password', async () => {
      mockAuthRepo.findUserByIdWithProfile.mockResolvedValue({
        id: '1',
        email: 'me@campus.edu',
        password: 'hashed',
        name: 'Me',
        role: Role.STUDENT,
        phone: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        organizerProfile: null,
      });
      const result = await service.getMe('1');
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe('me@campus.edu');
    });
  });

  it('should not allow ADMIN via public register (register removed)', async () => {
    expect((service as any).register).toBeUndefined();
  });
});
