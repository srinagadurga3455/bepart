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

  async findAllOrganizersPaged(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.organizer.findMany({
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          _count: { select: { events: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.organizer.count(),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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

  updateUserPhone(id: string, phone: string | null) {
    return this.prisma.user.update({ where: { id }, data: { phone } });
  }

  updateUserEmail(id: string, email: string) {
    return this.prisma.user.update({ where: { id }, data: { email } });
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

  // Overview: events with registration count and PAID revenue per event.
  // Used by GET /organizers/:id/overview (ADMIN only).
  async getOrganizerOverview(organizerId: string) {
    const organizer = await this.prisma.organizer.findUnique({
      where: { id: organizerId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!organizer) return null;

    const events = await this.prisma.event.findMany({
      where: { organizerId },
      orderBy: { date: 'desc' },
      include: {
        _count: { select: { registrations: true } },
      },
    });

    // Collect all event IDs for this organizer
    const eventIds = events.map((e) => e.id);

    // Revenue: sum PAID payments per event (amount is in paise)
    const paidPayments = eventIds.length > 0
      ? await this.prisma.payment.findMany({
          where: {
            status: 'PAID',
            OR: [
              { eventId: { in: eventIds } },
              { registration: { eventId: { in: eventIds } } },
            ],
          },
          select: { id: true, amount: true, eventId: true, registrationId: true, registration: { select: { eventId: true } } },
        })
      : [];

    // Build per-event revenue map (paise)
    const revenueByEvent = new Map<string, number>();
    for (const p of paidPayments) {
      const eid = p.eventId || (p.registration as any)?.eventId;
      if (!eid) continue;
      revenueByEvent.set(eid, (revenueByEvent.get(eid) ?? 0) + p.amount);
    }

    const totalRegistrations = events.reduce((sum, e) => sum + e._count.registrations, 0);
    const totalRevenuePaise = [...revenueByEvent.values()].reduce((s, v) => s + v, 0);
    const now = new Date();

    const eventSummaries = events.map((e) => ({
      id: e.id,
      eventName: e.eventName,
      date: e.date,
      status: e.status,
      isActive: e.isActive,
      paymentRequired: e.paymentRequired,
      slots: e.slots,
      registrationCount: e._count.registrations,
      revenuePaise: revenueByEvent.get(e.id) ?? 0,
      isCompleted: e.date <= now,
    }));

    return {
      organizer,
      totalEvents: events.length,
      upcomingEvents: eventSummaries.filter((e) => !e.isCompleted && e.status === 'PUBLISHED').length,
      completedEvents: eventSummaries.filter((e) => e.isCompleted || e.status === 'COMPLETED' || e.status === 'CANCELLED').length,
      totalRegistrations,
      totalRevenuePaise,
      events: eventSummaries,
    };
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

  // Transaction for deactivate (organizer REJECTED + isActive false + user
  // login disabled + ALL organizer events hidden). Public listing and
  // registration only include isActive events, so this is the enforced
  // backend cascade: a deactivated organizer's events disappear for participants.
  deactivateTransaction(organizerId: string, userId: string) {
    return this.prisma.$transaction([
      this.prisma.organizer.update({
        where: { id: organizerId },
        data: { status: OrganizerStatus.REJECTED, isActive: false },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
      this.prisma.event.updateMany({ where: { organizerId }, data: { isActive: false } }),
    ]);
  }

  // Transaction for reactivate (organizer APPROVED + isActive true + user
  // login restored + events visible again).
  reactivateTransaction(organizerId: string, userId: string) {
    return this.prisma.$transaction([
      this.prisma.organizer.update({
        where: { id: organizerId },
        data: { status: OrganizerStatus.APPROVED, isActive: true },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { isActive: true } }),
      this.prisma.event.updateMany({ where: { organizerId }, data: { isActive: true } }),
    ]);
  }
}
