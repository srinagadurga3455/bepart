import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { OrganizerStatus, Role } from '@prisma/client';

@Injectable()
export class OrganizersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Organizer queries
  findOrganizerById(id: string) {
    return this.prisma.organizer.findUnique({ where: { id }, include: { user: true } });
  }

  findOrganizerByUserId(userId: string) {
    return this.prisma.organizer.findUnique({ where: { userId }, include: { user: true } });
  }

  findOrganizerByEmail(email: string) {
    return this.prisma.organizer.findUnique({ where: { email } });
  }

  findAllOrganizers() {
    return this.prisma.organizer.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { events: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  createOrganizer(data: { userId: string; name: string; description?: string; phone?: string; email?: string; upiId?: string; status: OrganizerStatus }) {
    return this.prisma.organizer.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        phone: data.phone,
        email: data.email,
        upiId: data.upiId,
        status: data.status,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  updateOrganizer(id: string, data: any) {
    return this.prisma.organizer.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  deleteOrganizer(id: string) {
    return this.prisma.organizer.delete({ where: { id } });
  }

  updateOrganizerStatus(id: string, status: OrganizerStatus, includeUser = false) {
    if (includeUser) {
      return this.prisma.organizer.update({ where: { id }, data: { status }, include: { user: true } });
    }
    return this.prisma.organizer.update({ where: { id }, data: { status }, include: { user: { select: { id: true, name: true, email: true, role: true } } } });
  }

  // User queries (organizer domain)
  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  updateUserActive(id: string, isActive: boolean) {
    return this.prisma.user.update({ where: { id }, data: { isActive } });
  }

  // Admin queries
  findAdminById(id: string) {
    return this.prisma.admin.findUnique({ where: { id } });
  }

  findFirstAdmin() {
    return this.prisma.admin.findFirst();
  }

  // Event queries (for organizer context)
  countEventsByOrganizer(organizerId: string) {
    return this.prisma.event.count({ where: { organizerId } });
  }

  findEventsByOrganizer(organizerId: string, skip: number, take: number) {
    return this.prisma.event.findMany({
      where: { organizerId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    });
  }

  countEvents(where: any) {
    return this.prisma.event.count({ where });
  }

  // OTP
  createOtp(data: { identifier: string; otpHash: string; purpose: any; expiresAt: Date }) {
    return this.prisma.otpVerification.create({ data });
  }

  // Transaction for ADMIN create organizer (User + Organizer)
  createOrganizerWithUser(data: { email: string; name: string; phone?: string; description?: string; upiId?: string; adminId: string | null }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          password: null,
          name: data.name,
          phone: data.phone,
          role: Role.ORGANIZER,
          isActive: true,
        },
      });

      const organizer = await tx.organizer.create({
        data: {
          userId: user.id,
          adminId: data.adminId,
          name: data.name,
          description: data.description,
          phone: data.phone,
          email: data.email,
          upiId: data.upiId,
          status: OrganizerStatus.APPROVED,
        },
        include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } }, admin: true },
      });

      return organizer;
    });
  }

  // Transaction for deactivate (organizer REJECTED + user isActive false)
  deactivateTransaction(organizerId: string, userId: string) {
    return this.prisma.$transaction([
      this.prisma.organizer.update({
        where: { id: organizerId },
        data: { status: OrganizerStatus.REJECTED },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
    ]);
  }
}
