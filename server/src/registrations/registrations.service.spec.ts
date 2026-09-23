import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../database/prisma.service';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('RegistrationsService - Updated Schema Int EventId', () => {
  let service: RegistrationsService;
  let mockTx: any;

  const mockPrisma: any = {
    $transaction: jest.fn((cb) => cb(mockTx)),
    registration: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
    organizer: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx = {
      event: { findUnique: jest.fn() },
      registration: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
    };
    mockPrisma.registration.findUnique = jest.fn();
    mockPrisma.organizer.findUnique = jest.fn();
    mockPrisma.event.findUnique = jest.fn();
    mockPrisma.user.findUnique = jest.fn();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [RegistrationsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = mod.get(RegistrationsService);
  });

  it('should reject registration for unpublished event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'DRAFT', slots: 100, closingTime: new Date(Date.now() + 1000000) });
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject when closingTime passed', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() - 1000000) });
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject when slots full', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 5, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(5);
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(BadRequestException);
  });

  it('should prevent duplicate phone per event', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue({ registrationId: 'existing', phone: '+91 9999999999' });
    await expect(service.create({ phone: '+91 9999999999', eventId: 1 } as any)).rejects.toThrow(ConflictException);
  });

  it('should create registration with phone/formData and int eventId', async () => {
    mockTx.event.findUnique.mockResolvedValue({ id: 1, status: 'PUBLISHED', slots: 10, closingTime: new Date(Date.now() + 1000000) });
    mockTx.registration.count.mockResolvedValue(0);
    mockTx.registration.findFirst.mockResolvedValue(null);
    mockTx.registration.create.mockResolvedValue({ registrationId: 'r1', phone: '+91 9999999999', eventId: 1, formData: { branch: 'CSE' } });
    const res = await service.create({ phone: '+91 9999999999', eventId: 1, formData: { branch: 'CSE' } } as any);
    expect(mockTx.registration.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ phone: '+91 9999999999', eventId: 1 }) }));
    expect(res.registrationId).toBe('r1');
  });

  it('should restrict student to own phone', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({ registrationId: 'r1', phone: '+91 1111111111', eventId: 1 });
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1', phone: '+91 9999999999' });
    await expect(service.findOne('r1', 'user1', 'STUDENT')).rejects.toThrow(ForbiddenException);
  });

  it('should restrict organizer to own event', async () => {
    mockPrisma.registration.findUnique.mockResolvedValue({ registrationId: 'r1', phone: '+91 9999999999', eventId: 1 });
    mockPrisma.event.findUnique.mockResolvedValue({ id: 1, organizerId: 'org1' });
    mockPrisma.organizer.findUnique.mockResolvedValue({ id: 'org2' });
    await expect(service.findOne('r1', 'user1', 'ORGANIZER')).rejects.toThrow(ForbiddenException);
  });
});
