import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OrganizersRepository } from './organizers.repo';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { UpdateOrganizerDto } from './dto/update-organizer.dto';
import { OrganizerStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class OrganizersService {
  private readonly logger = new Logger(OrganizersService.name);

  constructor(
    private readonly organizersRepo: OrganizersRepository,
    private readonly whatsappService: WhatsappService,
  ) {}

  private async getOrganizerOrFail(id: string) {
    const org = await this.organizersRepo.findOrganizerById(id);
    if (!org) throw new NotFoundException('Organizer not found');
    return org;
  }

  private async getOrganizerByUserId(userId: string) {
    return this.organizersRepo.findOrganizerByUserId(userId);
  }

  // ADMIN creates Organizer directly — creates User (ORGANIZER) + Organizer profile, links adminId
  // Password no longer required; OTP will be used for login. User.password stored as null.
  async adminCreate(dto: import('./dto/admin-create-organizer.dto').AdminCreateOrganizerDto, adminUserId: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.organizersRepo.findUserByEmail(normalizedEmail);
    if (existingUser) throw new ConflictException('Email already registered');

    const existingOrgByEmail = await this.organizersRepo.findOrganizerByEmail(normalizedEmail).catch(() => null);
    if (existingOrgByEmail) throw new ConflictException('Organizer email already used');

    let adminId: string | null = null;
    const adminProfile = await this.organizersRepo.findAdminById(adminUserId);
    if (adminProfile) adminId = adminProfile.id;
    else {
      const anyAdmin = await this.organizersRepo.findFirstAdmin();
      if (anyAdmin) adminId = anyAdmin.id;
    }

    const result = await this.organizersRepo.createOrganizerWithUser({
      email: normalizedEmail,
      name: dto.name.trim(),
      phone: dto.phone?.trim(),
      description: dto.description?.trim(),
      upiId: dto.upiId?.trim(),
      adminId,
    });

    // Generate OTP for organizer and log via console + Whatsapp mock
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.organizersRepo.createOtp({
      identifier: normalizedEmail,
      otpHash,
      purpose: 'ORGANIZER_LOGIN' as any,
      expiresAt,
    });
    console.log(`[OTP] ORGANIZER ${normalizedEmail} -> ${otp}`);
    this.logger.log(`[OTP] ORGANIZER ${normalizedEmail} -> ${otp}`);
    await this.whatsappService.sendOtp(normalizedEmail, otp);

    return result;
  }

  async create(dto: CreateOrganizerDto, userId: string, userRole: string) {
    if (userRole === Role.STUDENT) throw new ForbiddenException('Students cannot create organizer profiles. Register as ORGANIZER.');
    const existing = await this.organizersRepo.findOrganizerByUserId(userId);
    if (existing) throw new ConflictException('Organizer profile already exists for this user');
    const user = await this.organizersRepo.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (dto.email) {
      const dup = await this.organizersRepo.findOrganizerByEmail(dto.email.toLowerCase().trim()).catch(() => null);
      if (dup) throw new ConflictException('Email already used');
    }
    const organizer = await this.organizersRepo.createOrganizer({
      userId,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      phone: dto.phone?.trim(),
      email: dto.email?.toLowerCase().trim(),
      upiId: dto.upiId?.trim(),
      status: OrganizerStatus.APPROVED,
    });
    return organizer;
  }

  async findAll() {
    return this.organizersRepo.findAllOrganizers();
  }

  async getOrganizerEvents(organizerId: string, query: { page?: number; limit?: number }) {
    const organizer = await this.organizersRepo.findOrganizerById(organizerId);
    if (!organizer) throw new NotFoundException('Organizer not found');
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;
    const where = { organizerId };
    const [data, total] = await Promise.all([
      this.organizersRepo.findEventsByOrganizer(organizerId, skip, limit),
      this.organizersRepo.countEvents(where),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findMyOrganizer(userId: string) {
    const org = await this.getOrganizerByUserId(userId);
    if (!org) throw new NotFoundException('Organizer profile not found');
    return org;
  }

  async findOne(id: string, requesterId: string, requesterRole: string) {
    const org = await this.getOrganizerOrFail(id);
    if (requesterRole !== Role.ADMIN && org.userId !== requesterId) {
      throw new ForbiddenException('You can only view your own organizer profile');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizerDto, requesterId: string, requesterRole: string) {
    if (requesterRole !== Role.ADMIN) throw new ForbiddenException('Only ADMIN can update organizers');
    await this.getOrganizerOrFail(id);
    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim();
    if (dto.phone !== undefined) data.phone = dto.phone?.trim();
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase().trim();
    if (dto.upiId !== undefined) data.upiId = dto.upiId?.trim();
    return this.organizersRepo.updateOrganizer(id, data);
  }

  async remove(id: string) {
    const org = await this.getOrganizerOrFail(id);
    const eventCount = await this.organizersRepo.countEventsByOrganizer(id);
    if (eventCount > 0) throw new ConflictException(`Cannot delete organizer with ${eventCount} event(s). Deactivate instead.`);
    await this.organizersRepo.deleteOrganizer(id);
    return { message: 'Organizer deleted', id: org.id };
  }

  async deactivate(id: string) {
    const org = await this.getOrganizerOrFail(id);
    const [updatedOrg] = await this.organizersRepo.deactivateTransaction(id, org.userId!);
    return updatedOrg;
  }

  async approve(id: string) {
    const org = await this.getOrganizerOrFail(id);
    if (org.status === OrganizerStatus.APPROVED) return org;
    return this.organizersRepo.updateOrganizerStatus(id, OrganizerStatus.APPROVED, true);
  }

  async reject(id: string, reason?: string) {
    await this.getOrganizerOrFail(id);
    return this.organizersRepo.updateOrganizerStatus(id, OrganizerStatus.REJECTED, true);
  }

  async getApprovedOrganizerByUserId(userId: string) {
    const org = await this.organizersRepo.findOrganizerByUserId(userId);
    if (!org) throw new NotFoundException('Organizer profile not found');
    if (org.status !== OrganizerStatus.APPROVED) throw new ForbiddenException(`Organizer not approved (status: ${org.status}). Only APPROVED organizers can manage events.`);
    return org;
  }
}
