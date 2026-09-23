import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { UpdateOrganizerDto } from './dto/update-organizer.dto';
import { OrganizerStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrganizersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private async getOrganizerOrFail(id: string) {
    const org = await this.prisma.organizer.findUnique({ where: { id }, include: { user: true } });
    if (!org) throw new NotFoundException('Organizer not found');
    return org;
  }

  private async getOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId }, include: { user: true } });
  }

  // ADMIN creates Organizer directly — creates User (ORGANIZER) + Organizer profile, links adminId
  async adminCreate(dto: import('./dto/admin-create-organizer.dto').AdminCreateOrganizerDto, adminUserId: string) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check duplicate User email (login email)
    const existingUser = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) throw new ConflictException('Email already registered');

    // Check duplicate Organizer email (contact email, unique)
    const existingOrgByEmail = await this.prisma.organizer
      .findUnique({ where: { email: normalizedEmail } })
      .catch(() => null);
    if (existingOrgByEmail) throw new ConflictException('Organizer email already used');

    // Hash password using existing bcrypt setup
    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 10);
    const hashed = await bcrypt.hash(dto.password, rounds);

    // Resolve adminId for linking (Admin.id == User.id per seed)
    let adminId: string | null = null;
    const adminProfile = await this.prisma.admin.findUnique({ where: { id: adminUserId } });
    if (adminProfile) adminId = adminProfile.id;
    else {
      const anyAdmin = await this.prisma.admin.findFirst();
      if (anyAdmin) adminId = anyAdmin.id;
    }

    // Transaction: create User + Organizer atomically
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          password: hashed,
          name: dto.name.trim(),
          phone: dto.phone?.trim(),
          role: Role.ORGANIZER,
          isActive: true,
        },
      });

      const organizer = await tx.organizer.create({
        data: {
          userId: user.id,
          adminId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          phone: dto.phone?.trim(),
          email: normalizedEmail,
          upiId: dto.upiId?.trim(),
          status: OrganizerStatus.APPROVED,
        },
        include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } }, admin: true },
      });

      return organizer;
    });

    return result;
  }

  async create(dto: CreateOrganizerDto, userId: string, userRole: string) {
    if (userRole === Role.STUDENT) throw new ForbiddenException('Students cannot create organizer profiles. Register as ORGANIZER.');
    const existing = await this.prisma.organizer.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Organizer profile already exists for this user');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.email) {
      const dup = await this.prisma.organizer.findUnique({ where: { email: dto.email.toLowerCase().trim() } }).catch(() => null);
      if (dup) throw new ConflictException('Email already used');
    }
    const organizer = await this.prisma.organizer.create({
      data: {
        userId,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.toLowerCase().trim(),
        upiId: dto.upiId?.trim(),
        status: OrganizerStatus.APPROVED,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return organizer;
  }

  async findAll() {
    return this.prisma.organizer.findMany({
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
    return this.prisma.organizer.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async remove(id: string) {
    const org = await this.getOrganizerOrFail(id);
    const eventCount = await this.prisma.event.count({ where: { organizerId: id } });
    if (eventCount > 0) throw new ConflictException(`Cannot delete organizer with ${eventCount} event(s). Deactivate instead.`);
    await this.prisma.organizer.delete({ where: { id } });
    return { message: 'Organizer deleted', id: org.id };
  }

  async deactivate(id: string) {
    const org = await this.getOrganizerOrFail(id);
    const [updatedOrg] = await this.prisma.$transaction([
      this.prisma.organizer.update({
        where: { id },
        data: { status: OrganizerStatus.REJECTED },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.user.update({ where: { id: org.userId! }, data: { isActive: false } }),
    ]);
    return updatedOrg;
  }

  async approve(id: string) {
    const org = await this.getOrganizerOrFail(id);
    if (org.status === OrganizerStatus.APPROVED) return org;
    return this.prisma.organizer.update({ where: { id }, data: { status: OrganizerStatus.APPROVED }, include: { user: true } });
  }

  async reject(id: string, reason?: string) {
    await this.getOrganizerOrFail(id);
    return this.prisma.organizer.update({
      where: { id },
      data: { status: OrganizerStatus.REJECTED },
      include: { user: true },
    });
  }

  async getApprovedOrganizerByUserId(userId: string) {
    const org = await this.prisma.organizer.findUnique({ where: { userId } });
    if (!org) throw new NotFoundException('Organizer profile not found');
    if (org.status !== OrganizerStatus.APPROVED) throw new ForbiddenException(`Organizer not approved (status: ${org.status}). Only APPROVED organizers can manage events.`);
    return org;
  }
}
