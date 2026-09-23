import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { Role } from '../common/constants/roles';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
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
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'mock.jwt.token') },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return token on valid credentials', async () => {
      const hashed = await bcrypt.hash('correctpassword', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@campus.edu',
        password: hashed,
        name: 'Test',
        role: Role.STUDENT,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const result = await service.login({ email: 'test@campus.edu', password: 'correctpassword' });
      expect(result).toHaveProperty('accessToken');
      expect(result.user).not.toHaveProperty('password');
    });

    it('should reject invalid password', async () => {
      const hashed = await bcrypt.hash('correct', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@campus.edu',
        password: hashed,
        name: 'Test',
        role: Role.STUDENT,
        isActive: true,
      });
      await expect(service.login({ email: 'test@campus.edu', password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should reject deactivated account', async () => {
      const hashed = await bcrypt.hash('pass12345', 4);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: '1',
        email: 'test@campus.edu',
        password: hashed,
        role: Role.STUDENT,
        isActive: false,
      });
      await expect(service.login({ email: 'test@campus.edu', password: 'pass12345' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should reject non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'no@campus.edu', password: 'pass12345' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should not allow ADMIN via public register (register removed)', async () => {
      // Public POST /api/auth/register is removed — only ADMIN can create ADMIN via POST /api/admin/admins
      expect((service as any).register).toBeUndefined();
    });
  });

  describe('getMe', () => {
    it('should sanitize password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
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
});
