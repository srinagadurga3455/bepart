import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepository } from './auth.repo';
import { PrismaService } from '../database/prisma.service';

/**
 * Recipient-specific OTP failure guard: the request identifier is normalized
 * to lowercase, so the lookup MUST be case-insensitive — otherwise a stored
 * row with different casing 401s exactly one recipient while every other
 * recipient works on the same app and SMTP config.
 */
describe('AuthRepository email lookup (OTP path)', () => {
  let repo: AuthRepository;
  const mockPrisma: any = {
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [AuthRepository, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    repo = mod.get(AuthRepository);
  });

  it('looks up emails case-insensitively (mixed-case stored rows still resolve)', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: '1', email: 'Admin@Example.COM' });
    const res = await repo.findUserByEmail('admin@example.com');
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'admin@example.com', mode: 'insensitive' } },
    });
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    expect(res).toEqual({ id: '1', email: 'Admin@Example.COM' });
  });

  it('normalizes the input before querying', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await repo.findUserByEmail('  ADMIN@Example.COM ');
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'admin@example.com', mode: 'insensitive' } },
    });
  });
});
