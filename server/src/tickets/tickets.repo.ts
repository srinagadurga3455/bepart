import { randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/** Canonical production frontend origin for public ticket URLs. */
export const PRODUCTION_FRONTEND_URL = 'https://www.bepart.in';

/** Public ticket URL + QR value. QR encodes the URL; no image is stored. */
export function buildTicketUrl(frontendBase: string, code: string): string {
  return `${frontendBase.replace(/\/$/, '')}/ticket/${code}`;
}

function isLocalOrLanHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '::1' ||
    /^192\.168\.\d+\.\d+$/.test(h) ||
    /^10\.\d+\.\d+\.\d+$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(h)
  );
}

/**
 * True when a ticket base URL must never be stamped onto a ticket in
 * production: localhost, LAN IPs, or the Render backend origin itself.
 */
export function isNonPublicTicketBase(base: string): boolean {
  const trimmed = String(base || '').trim();
  if (!trimmed) return true;
  let host = '';
  try {
    host = new URL(trimmed).hostname;
  } catch {
    return true;
  }
  if (isLocalOrLanHost(host)) return true;
  // The API/backend origin (e.g. *.onrender.com) is never a ticket URL base.
  if (/\.onrender\.com$/i.test(host)) return true;
  return false;
}

export function frontendBaseUrl(configBase?: string | null): string {
  const fromEnv = typeof process !== 'undefined' ? process.env.FRONTEND_URL : undefined;
  const resolved = (configBase || fromEnv || 'http://localhost:5173').replace(/\/$/, '');
  // Production tickets must always point at the public frontend. A missing
  // FRONTEND_URL (localhost fallback), a LAN IP, or the Render backend URL
  // would otherwise produce unscannable ticket links in WhatsApp/QR.
  const nodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : undefined;
  if (nodeEnv === 'production' && isNonPublicTicketBase(resolved)) {
    return PRODUCTION_FRONTEND_URL;
  }
  return resolved;
}

@Injectable()
export class TicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get db() {
    return this.prisma;
  }

  /**
   * Issue a ticket inside the caller's transaction (registration already
   * created). Idempotent per registration: a replayed fulfillment (webhook +
   * manual confirm) never creates a second ticket.
   */
  issueTicket(
    tx: any,
    data: { registrationId: string; eventId: string; frontendBase: string; code?: string; qrToken?: string },
  ) {
    const code = data.code || randomUUID();
    return tx.ticket.upsert({
      where: { registrationId: data.registrationId },
      create: {
        code,
        registrationId: data.registrationId,
        eventId: data.eventId,
        ticketUrl: buildTicketUrl(data.frontendBase, code),
        qrToken: data.qrToken || randomUUID(),
        status: 'VALID' as any,
      },
      update: {},
    });
  }

  /** Cancel the ticket of a registration (registration being cancelled). */
  async cancelForRegistration(registrationId: string) {
    await this.prisma.ticket.updateMany({
      where: { registrationId },
      data: { status: 'CANCELLED' as any },
    });
  }

  findTicketWithRelations(ticketId: string) {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        registration: true,
        event: { include: { organizer: { select: { id: true, name: true } } } },
      },
    });
  }

  findByCode(code: string) {
    return this.prisma.ticket.findUnique({
      where: { code },
      include: {
        registration: true,
        event: { include: { organizer: { select: { id: true, name: true } } } },
      },
    });
  }

  findByQrToken(qrToken: string) {
    return this.prisma.ticket.findUnique({
      where: { qrToken },
      include: {
        registration: true,
        event: { include: { organizer: { select: { id: true, name: true } } } },
      },
    });
  }

  findByRegistrationId(registrationId: string) {
    return this.prisma.ticket.findUnique({
      where: { registrationId },
      include: {
        registration: true,
        event: { include: { organizer: { select: { id: true, name: true } } } },
      },
    });
  }

    findOrganizerByUserId(userId: string) {
      return this.prisma.organizer.findUnique({ where: { userId } });
    }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findTicketsByPhones(phones: string[]) {
    return this.prisma.ticket.findMany({
      where: { registration: { phone: { in: phones } } },
      include: {
        registration: { select: { registrationId: true, phone: true, paymentStatus: true, createdAt: true } },
        event: { select: { id: true, eventName: true, date: true, closingTime: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Atomic check-in: flips ticket + mirrors registration.checkedInAt. */
  checkInAtomic(ticketId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${ticketId} FOR UPDATE`;
      const existing = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!existing) return null;
      if ((existing as any).status === 'CHECKED_IN') return { already: true, ticket: existing };
      const now = new Date();
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'CHECKED_IN' as any, checkedInAt: now },
      });
      await tx.registration.update({
        where: { registrationId: (existing as any).registrationId },
        data: { checkedInAt: now } as any,
      });
      return { already: false, ticket };
    });
  }

  /** Revert a check-in (organizer correction): ticket + registration. */
  async undoCheckInAtomic(ticketId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${ticketId} FOR UPDATE`;
      const existing = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!existing) return null;
      if ((existing as any).status === 'CANCELLED') return { ticket: existing };
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'VALID' as any, checkedInAt: null },
      });
      await tx.registration.update({
        where: { registrationId: (existing as any).registrationId },
        data: { checkedInAt: null } as any,
      });
      return { ticket };
    });
  }
}
