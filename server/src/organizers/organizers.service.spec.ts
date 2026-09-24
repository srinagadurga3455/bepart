import { Test, TestingModule } from '@nestjs/testing';
import { OrganizersService } from './organizers.service';
import { OrganizersRepository } from './organizers.repo';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizerStatus, Role } from '@prisma/client';
import { WhatsappService } from '../whatsapp/whatsapp.service';

const mockOrganizersRepo: any = {
  findOrganizerById: jest.fn(),
  findOrganizerByUserId: jest.fn(),
  findOrganizerByEmail: jest.fn(),
  findAllOrganizers: jest.fn(),
  createOrganizer: jest.fn(),
  updateOrganizer: jest.fn(),
  deleteOrganizer: jest.fn(),
  updateOrganizerStatus: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  findAdminById: jest.fn(),
  findFirstAdmin: jest.fn(),
  countEventsByOrganizer: jest.fn(),
  findEventsByOrganizer: jest.fn(),
  countEvents: jest.fn(),
  createOtp: jest.fn().mockResolvedValue({ id: 'otp1' }),
  createOrganizerWithUser: jest.fn(),
  deactivateTransaction: jest.fn(),
  updateUserPhone: jest.fn().mockResolvedValue({}),
};

describe('OrganizersService - Phase 2', () => {
  let service: OrganizersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizersService,
        { provide: OrganizersRepository, useValue: mockOrganizersRepo },
        { provide: WhatsappService, useValue: { sendOtp: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();
    service = mod.get(OrganizersService);
  });

  it('should start new organizers as APPROVED (no approval step)', async () => {
    mockOrganizersRepo.findOrganizerByUserId.mockResolvedValue(null);
    mockOrganizersRepo.findUserById.mockResolvedValue({ id: 'u1', role: Role.ORGANIZER, isActive: true });
    mockOrganizersRepo.createOrganizer.mockResolvedValue({ id: 'o1', status: OrganizerStatus.APPROVED, name: 'Tech', phone: '+91 9876543210' });
    const res = await service.create({ name: 'Tech', phone: '+91 9876543210' } as any, 'u1', Role.ORGANIZER);
    expect(res.status).toBe(OrganizerStatus.APPROVED);
    expect(mockOrganizersRepo.createOrganizer).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'APPROVED', name: 'Tech' }),
    );
  });

  it('should forbid STUDENT from creating organizer', async () => {
    await expect(service.create({ name: 'Club' } as any, 'u1', Role.STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should reject duplicate organizer per user', async () => {
    mockOrganizersRepo.findOrganizerByUserId.mockResolvedValue({ id: 'o1' });
    await expect(service.create({ name: 'Club' } as any, 'u1', Role.ORGANIZER)).rejects.toBeInstanceOf(ConflictException);
  });

  it('should allow ADMIN approve', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', status: OrganizerStatus.PENDING });
    mockOrganizersRepo.updateOrganizerStatus.mockResolvedValue({ id: 'o1', status: OrganizerStatus.APPROVED });
    const res = await service.approve('o1');
    expect(res.status).toBe(OrganizerStatus.APPROVED);
  });

  it('should allow ADMIN reject', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', status: OrganizerStatus.PENDING });
    mockOrganizersRepo.updateOrganizerStatus.mockResolvedValue({ id: 'o1', status: OrganizerStatus.REJECTED });
    const res = await service.reject('o1', 'Incomplete');
    expect(mockOrganizersRepo.updateOrganizerStatus).toHaveBeenCalledWith('o1', OrganizerStatus.REJECTED, true);
  });

  it('should enforce ownership on findOne (organizer cannot view other)', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'userA' });
    await expect(service.findOne('o1', 'userB', Role.ORGANIZER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow admin to view any', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'userA' });
    const res = await service.findOne('o1', 'adminId', Role.ADMIN);
    expect(res.id).toBe('o1');
  });

  it('should enforce ADMIN-only on update', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'userA', status: OrganizerStatus.PENDING });
    await expect(service.update('o1', { name: 'New' } as any, 'userB', Role.ORGANIZER)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('o1', { name: 'New' } as any, 'userB', Role.STUDENT)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('should allow ADMIN to update any organizer', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'userA', status: OrganizerStatus.REJECTED });
    mockOrganizersRepo.updateOrganizer.mockResolvedValue({ id: 'o1', name: 'Fixed' });
    await service.update('o1', { name: 'Fixed' } as any, 'admin1', Role.ADMIN);
    expect(mockOrganizersRepo.updateOrganizer).toHaveBeenCalledWith('o1', expect.objectContaining({ name: 'Fixed' }));
  });

  it('should throw NotFound for missing organizer on approve', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue(null);
    await expect(service.approve('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should allow ADMIN to create organizer directly as APPROVED (creates User + Organizer)', async () => {
    mockOrganizersRepo.findUserByEmail.mockResolvedValue(null);
    mockOrganizersRepo.findOrganizerByEmail.mockResolvedValue(null);
    mockOrganizersRepo.findAdminById.mockResolvedValue({ id: 'admin1' });
    mockOrganizersRepo.createOrganizerWithUser.mockResolvedValue({ id: 'oNew', status: OrganizerStatus.APPROVED, name: 'Tech Club' });
    const res = await service.adminCreate(
      { name: 'Tech Club', email: 'neworg@example.com', phone: '+91 9876543210' } as any,
      'admin1',
    );
    expect(res.status).toBe(OrganizerStatus.APPROVED);
    expect(res.name).toBe('Tech Club');
  });

  it('should store normalized phone when ADMIN creates organizer', async () => {
    mockOrganizersRepo.findUserByEmail.mockResolvedValue(null);
    mockOrganizersRepo.findOrganizerByEmail.mockResolvedValue(null);
    mockOrganizersRepo.findAdminById.mockResolvedValue({ id: 'admin1' });
    mockOrganizersRepo.createOrganizerWithUser.mockResolvedValue({ id: 'oNew', status: OrganizerStatus.APPROVED, name: 'Phone Club', phone: '9876543224' } as any);
    await service.adminCreate(
      { name: 'Phone Club', email: 'phone@example.com', phone: '+91 98765-43224' } as any,
      'admin1',
    );
    expect(mockOrganizersRepo.createOrganizerWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+919876543224' }),
    );
  });

  it('should normalize phone with spaces/hyphens/parentheses on create', async () => {
    mockOrganizersRepo.findUserByEmail.mockResolvedValue(null);
    mockOrganizersRepo.findOrganizerByEmail.mockResolvedValue(null);
    mockOrganizersRepo.findAdminById.mockResolvedValue({ id: 'admin1' });
    mockOrganizersRepo.createOrganizerWithUser.mockResolvedValue({ id: 'oNew', status: OrganizerStatus.APPROVED, name: 'Phone Club 2' } as any);
    await service.adminCreate(
      { name: 'Phone Club 2', email: 'phone2@example.com', phone: '(+91) 98765 43224' } as any,
      'admin1',
    );
    expect(mockOrganizersRepo.createOrganizerWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+919876543224' }),
    );
  });

  it('should reject adminCreate if email already registered', async () => {
    mockOrganizersRepo.findUserByEmail.mockResolvedValue({ id: 'existing', email: 'neworg@example.com' });
    await expect(
      service.adminCreate({ name: 'Club', email: 'neworg@example.com' } as any, 'admin1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should delete organizer when no events (ADMIN)', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'u1' });
    mockOrganizersRepo.countEventsByOrganizer.mockResolvedValue(0);
    mockOrganizersRepo.deleteOrganizer.mockResolvedValue({ id: 'o1' });
    const res = await service.remove('o1');
    expect(res.message).toMatch(/deleted/i);
  });

  it('should deactivate organizer (REJECTED + user isActive false)', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'u1' });
    mockOrganizersRepo.deactivateTransaction.mockResolvedValue([{ id: 'o1', status: OrganizerStatus.REJECTED }]);
    await service.deactivate('o1');
    expect(mockOrganizersRepo.deactivateTransaction).toHaveBeenCalledWith('o1', 'u1');
  });

  it('should keep Organizer.phone synchronized with User.phone on update', async () => {
    mockOrganizersRepo.findOrganizerById.mockResolvedValue({ id: 'o1', userId: 'u1', status: OrganizerStatus.APPROVED });
    mockOrganizersRepo.updateOrganizer.mockResolvedValue({ id: 'o1', phone: '+919876543224' });
    mockOrganizersRepo.updateUserPhone.mockResolvedValue({ id: 'u1', phone: '+919876543224' });
    await service.update('o1', { phone: '+91 98765-43224' } as any, 'admin1', Role.ADMIN);
    expect(mockOrganizersRepo.updateOrganizer).toHaveBeenCalledWith('o1', expect.objectContaining({ phone: '+919876543224' }));
    expect(mockOrganizersRepo.updateUserPhone).toHaveBeenCalledWith('u1', '+919876543224');
  });

  it('should synchronize User.phone when creating organizer via create', async () => {
    mockOrganizersRepo.findOrganizerByUserId.mockResolvedValue(null);
    mockOrganizersRepo.findUserById.mockResolvedValue({ id: 'u1', role: Role.ORGANIZER, isActive: true });
    mockOrganizersRepo.createOrganizer.mockResolvedValue({ id: 'o1', status: OrganizerStatus.APPROVED, name: 'SyncTech', phone: '+919876543224' });
    mockOrganizersRepo.updateUserPhone.mockResolvedValue({ id: 'u1', phone: '+919876543224' });
    const res = await service.create({ name: 'SyncTech', phone: '(+91) 98765-43224' } as any, 'u1', Role.ORGANIZER);
    expect(res.phone).toBe('+919876543224');
    expect(mockOrganizersRepo.createOrganizer).toHaveBeenCalledWith(expect.objectContaining({ phone: '+919876543224' }));
    expect(mockOrganizersRepo.updateUserPhone).toHaveBeenCalledWith('u1', '+919876543224');
  });
});
