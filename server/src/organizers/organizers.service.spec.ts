import { Test, TestingModule } from '@nestjs/testing';
import { OrganizersService } from './organizers.service';
import { PrismaService } from '../database/prisma.service';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizerStatus, Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

const mockPrisma: any = {
  organizer: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  event: { count: jest.fn() },
  admin: { findUnique: jest.fn(), findFirst: jest.fn() },
  $transaction: jest.fn(async (cb: any) => {
    if (Array.isArray(cb)) return Promise.all(cb.map((p: any) => p));
    if (typeof cb === 'function') {
      const tx = {
        user: { create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'newUserId', ...data })) },
        organizer: {
          create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'oNew', status: OrganizerStatus.APPROVED, ...data })),
          findUnique: jest.fn(),
        },
        admin: { findUnique: jest.fn(), findFirst: jest.fn() },
      };
      return cb(tx);
    }
    return Promise.resolve(cb);
  }),
};

describe('OrganizersService - Phase 2', () => {
  let service: OrganizersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(10) } },
      ],
    }).compile();
    service = mod.get(OrganizersService);
  });

  it('should start new organizers as APPROVED (no approval step)', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', role: Role.ORGANIZER, isActive: true });
    mockPrisma.organizer.create.mockResolvedValue({ id: 'o1', status: OrganizerStatus.APPROVED, name: 'Tech', phone: '+91 9876543210' });
    const res = await service.create({ name: 'Tech', phone: '+91 9876543210' } as any, 'u1', Role.ORGANIZER);
    expect(res.status).toBe(OrganizerStatus.APPROVED);
    expect(mockPrisma.organizer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'APPROVED', name: 'Tech' }) }),
    );
  });

  it('should forbid STUDENT from creating organizer', async () => {
    await expect(service.create({ name: 'Club' } as any, 'u1', Role.STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should reject duplicate organizer per user', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1' });
    await expect(service.create({ name: 'Club' } as any, 'u1', Role.ORGANIZER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('should allow ADMIN approve', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', status: OrganizerStatus.PENDING });
    mockPrisma.organizer.update.mockResolvedValue({ id: 'o1', status: OrganizerStatus.APPROVED });
    const res = await service.approve('o1');
    expect(res.status).toBe(OrganizerStatus.APPROVED);
  });

  it('should allow ADMIN reject', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', status: OrganizerStatus.PENDING });
    mockPrisma.organizer.update.mockResolvedValue({ id: 'o1', status: OrganizerStatus.REJECTED });
    const res = await service.reject('o1', 'Incomplete');
    expect(mockPrisma.organizer.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED' }) }));
  });

  it('should enforce ownership on findOne (organizer cannot view other)', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', userId: 'userA' });
    await expect(service.findOne('o1', 'userB', Role.ORGANIZER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow admin to view any', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', userId: 'userA' });
    const res = await service.findOne('o1', 'adminId', Role.ADMIN);
    expect(res.id).toBe('o1');
  });

  it('should enforce ADMIN-only on update', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', userId: 'userA', status: OrganizerStatus.PENDING });
    await expect(service.update('o1', { name: 'New' } as any, 'userB', Role.ORGANIZER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('o1', { name: 'New' } as any, 'userB', Role.STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow ADMIN to update any organizer', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', userId: 'userA', status: OrganizerStatus.REJECTED });
    mockPrisma.organizer.update.mockResolvedValue({ id: 'o1', name: 'Fixed' });
    await service.update('o1', { name: 'Fixed' } as any, 'admin1', Role.ADMIN);
    expect(mockPrisma.organizer.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Fixed' }) }));
  });

  it('should throw NotFound for missing organizer on approve', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue(null);
    await expect(service.approve('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should allow ADMIN to create organizer directly as APPROVED (creates User + Organizer)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null); // no existing user
    mockPrisma.organizer.findUnique.mockResolvedValue(null);
    mockPrisma.admin.findUnique.mockResolvedValue({ id: 'admin1' });
    const res = await service.adminCreate(
      { name: 'Tech Club', email: 'neworg@example.com', password: 'Password123', phone: '+91 9876543210' } as any,
      'admin1',
    );
    expect(res.status).toBe(OrganizerStatus.APPROVED);
    expect(res.name).toBe('Tech Club');
  });

  it('should reject adminCreate if email already registered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing', email: 'neworg@example.com' });
    await expect(
      service.adminCreate({ name: 'Club', email: 'neworg@example.com', password: 'Password123' } as any, 'admin1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should delete organizer when no events (ADMIN)', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1' });
    mockPrisma.event.count.mockResolvedValue(0);
    mockPrisma.organizer.delete = jest.fn().mockResolvedValue({ id: 'o1' });
    (service as any).prisma.event = { count: jest.fn().mockResolvedValue(0) };
    mockPrisma.event.count = jest.fn().mockResolvedValue(0);
    const res = await service.remove('o1');
    expect(res.message).toMatch(/deleted/i);
  });

  it('should deactivate organizer (REJECTED + user isActive false)', async () => {
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'o1', userId: 'u1' });
    mockPrisma.organizer.update = jest.fn().mockResolvedValue({ id: 'o1', status: OrganizerStatus.REJECTED });
    mockPrisma.user.update = jest.fn().mockResolvedValue({ id: 'u1', isActive: false });
    (service as any).prisma.$transaction = jest.fn().mockImplementation((args: any) => {
      if (Array.isArray(args)) return Promise.all(args.map((p: any) => p));
      return args;
    });
    await service.deactivate('o1');
    expect(mockPrisma.organizer.update).toHaveBeenCalled();
  });
});
