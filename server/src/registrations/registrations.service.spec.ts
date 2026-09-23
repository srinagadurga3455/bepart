import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { RegistrationsRepository } from './registrations.repo';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('RegistrationsService - Updated Schema Int EventId', () => {
  let service: RegistrationsService;
  let mockTx: any;

  const mockRegistrationsRepo: any = {
    transaction: jest.fn((cb) => cb(mockTx)),
    findAll: jest.fn(),
    findByOrganizerId: jest.fn(),
    findByPhone: jest.fn(),
    findByRegistrationId: jest.fn(),
    findOrganizerByUserId: jest.fn(),
    findEventById: jest.fn(),
    findUserById: jest.fn(),
    deleteByRegistrationId: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx = {
      event: { findUnique: jest.fn() },
      registration: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn() },
    };
    mockRegistrationsRepo.findByRegistrationId = jest.fn();
    mockRegistrationsRepo.findOrganizerByUserId = jest.fn();
    mockRegistrationsRepo.findEventById = jest.fn();
    mockRegistrationsRepo.findUserById = jest.fn();

    const mod: TestingModule = await Test.createTestingModule({
      providers: [RegistrationsService, { provide: RegistrationsRepository, useValue: mockRegistrationsRepo }],
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
    mockRegistrationsRepo.findByRegistrationId.mockResolvedValue({ registrationId: 'r1', phone: '+91 1111111111', eventId: 1 });
    mockRegistrationsRepo.findUserById.mockResolvedValue({ id: 'user1', phone: '+91 9999999999' });
    await expect(service.findOne('r1', 'user1', 'STUDENT')).rejects.toThrow(ForbiddenException);
  });

  it('should restrict organizer to own event', async () => {
    mockRegistrationsRepo.findByRegistrationId.mockResolvedValue({ registrationId: 'r1', phone: '+91 9999999999', eventId: 1 });
    mockRegistrationsRepo.findEventById.mockResolvedValue({ id: 1, organizerId: 'org1' });
    mockRegistrationsRepo.findOrganizerByUserId.mockResolvedValue({ id: 'org2' });
    await expect(service.findOne('r1', 'user1', 'ORGANIZER')).rejects.toThrow(ForbiddenException);
  });
});
