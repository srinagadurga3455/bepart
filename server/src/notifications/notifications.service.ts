import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationChannel, NotificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

export const NotificationTypes = {
  OTP_EMAIL: 'OTP_EMAIL',
  OTP_WHATSAPP: 'OTP_WHATSAPP',
  REGISTRATION_CONFIRMATION_EMAIL: 'REGISTRATION_CONFIRMATION_EMAIL',
  TICKET_EMAIL: 'TICKET_EMAIL',
  TICKET_WHATSAPP: 'TICKET_WHATSAPP',
  SETTLEMENT_REQUEST_WHATSAPP: 'SETTLEMENT_REQUEST_WHATSAPP',
  SETTLEMENT_REQUEST_EMAIL: 'SETTLEMENT_REQUEST_EMAIL',
  SETTLEMENT_APPROVED_WHATSAPP: 'SETTLEMENT_APPROVED_WHATSAPP',
  SETTLEMENT_APPROVED_EMAIL: 'SETTLEMENT_APPROVED_EMAIL',
  SETTLEMENT_REJECTED_WHATSAPP: 'SETTLEMENT_REJECTED_WHATSAPP',
  SETTLEMENT_REJECTED_EMAIL: 'SETTLEMENT_REJECTED_EMAIL',
  SETTLEMENT_PAID_WHATSAPP: 'SETTLEMENT_PAID_WHATSAPP',
  SETTLEMENT_PAID_EMAIL: 'SETTLEMENT_PAID_EMAIL',
} as const;

export type NotificationType = (typeof NotificationTypes)[keyof typeof NotificationTypes];

export interface SendOnceInput {
  type: string;
  channel: NotificationChannel;
  recipient: string;
  entityType?: string;
  entityId?: string;
  sender: () => Promise<{ messageId?: string; skipped?: boolean }>;
}

export interface SendOnceResult {
  status: NotificationStatus;
  skippedDuplicate?: boolean;
}

/**
 * Delivery audit + duplicate guard. Failures are recorded, never thrown:
 * a failed WhatsApp/email must NEVER roll back a payment, ticket or
 * settlement — those stay successful and the notification can be retried.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailService?: EmailService,
    @Optional() private readonly whatsappService?: WhatsappService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async alreadySent(type: string, entityId: string): Promise<boolean> {
    const row = await this.prisma.notificationLog.findFirst({
      where: { type, entityId, status: NotificationStatus.SENT },
      select: { id: true },
    });
    return !!row;
  }

  async sendOnce(input: SendOnceInput): Promise<SendOnceResult> {    const { type, channel, recipient, entityType, entityId, sender } = input;
    try {
      if (entityId && (await this.alreadySent(type, entityId))) {
        this.logger.log(`Skipping duplicate notification ${type} for ${entityType ?? 'entity'} ${entityId}`);
        return { status: NotificationStatus.SKIPPED, skippedDuplicate: true };
      }
      const out = await sender();
      if (out?.skipped) {
        await this.prisma.notificationLog.create({
          data: { type, channel, recipient, status: NotificationStatus.SKIPPED, entityType, entityId },
        });
        return { status: NotificationStatus.SKIPPED };
      }
      await this.prisma.notificationLog.create({
        data: {
          type,
          channel,
          recipient,
          status: NotificationStatus.SENT,
          entityType,
          entityId,
          providerMessageId: out?.messageId,
          sentAt: new Date(),
        },
      });
      return { status: NotificationStatus.SENT };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown notification error';
      this.logger.warn(`Notification ${type} to ${recipient} failed: ${message}`);
      try {
        await this.prisma.notificationLog.create({
          data: { type, channel, recipient, status: NotificationStatus.FAILED, entityType, entityId, error: message },
        });
      } catch (dbErr) {
        this.logger.error(`Could not persist notification log: ${(dbErr as Error)?.message}`);
      }
      return { status: NotificationStatus.FAILED };
    }
  }

  private formatTicketDate(d: unknown): string {
    const dt = d instanceof Date ? d : new Date(String(d ?? ''));
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private formatTicketTime(d: unknown): string {
    const dt = d instanceof Date ? d : new Date(String(d ?? ''));
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  private formatPaise(paise: number): string {
    return `₹${(paise / 100).toFixed(2)}`;
  }

  private ticketUrl(registrationId: string): string {
    const base = (this.config?.get<string>('FRONTEND_URL') || 'http://localhost:5173').replace(/\/$/, '');
    return `${base}/ticket/${registrationId}`;
  }

  private emailFromFormData(formData: unknown): string | null {
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) return null;
    for (const v of Object.values(formData as Record<string, unknown>)) {
      if (typeof v === 'string') {
        const t = v.trim();
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return t.toLowerCase();
      }
    }
    return null;
  }

  private nameFromFormData(formData: unknown, fallback: string): string {
    if (formData && typeof formData === 'object' && !Array.isArray(formData)) {
      const fd = formData as Record<string, unknown>;
      for (const k of ['teamName', 'member1Name', 'fullName', 'participantName', 'name']) {
        const v = fd[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
    }
    return fallback;
  }

  /**
   * Post-confirmation student notifications (email + WhatsApp ticket).
   * Best-effort: never throws, deduped per registration via sendOnce.
   * kind 'confirmation' = free/direct registration email;
   * kind 'ticket' = paid ticket email after verified payment.
   */
  async sendTicketNotifications(input: { registrationId: string; kind: 'confirmation' | 'ticket' }): Promise<void> {
    try {
      const reg = await this.prisma.registration.findUnique({
        where: { registrationId: input.registrationId },
        include: { event: true },
      });
      if (!reg || !reg.event) return;
      const event = reg.event as any;
      let organizerName = 'BePart organizer';
      try {
        const org = await this.prisma.organizer.findUnique({
          where: { id: event.organizerId },
          select: { name: true },
        });
        if (org?.name) organizerName = org.name;
      } catch {
        // organizer name is cosmetic — proceed without it
      }
      const ticketNumber = reg.registrationId;
      const ticketUrl = this.ticketUrl(ticketNumber);
      const date = this.formatTicketDate(event.date);
      const time = this.formatTicketTime(event.date);
      const studentName = this.nameFromFormData(reg.formData, reg.phone || 'Participant');
      const email = this.emailFromFormData(reg.formData);
      const amountPaid =
        typeof (reg as any).totalAmount === 'number' ? this.formatPaise((reg as any).totalAmount) : null;

      if (email && this.emailService) {
        const payload = {
          to: email,
          studentName,
          eventName: event.eventName,
          eventDate: date,
          eventTime: time,
          organizerName,
          ticketNumber,
          ticketUrl,
          amountPaid,
        };
        await this.sendOnce({
          type:
            input.kind === 'ticket' ? NotificationTypes.TICKET_EMAIL : NotificationTypes.REGISTRATION_CONFIRMATION_EMAIL,
          channel: NotificationChannel.EMAIL,
          recipient: email,
          entityType: 'registration',
          entityId: ticketNumber,
          sender: () =>
            input.kind === 'ticket'
              ? this.emailService!.sendTicketEmail(payload)
              : this.emailService!.sendRegistrationConfirmationEmail(payload),
        });
      }

      if (reg.phone && this.whatsappService) {
        await this.sendOnce({
          type: NotificationTypes.TICKET_WHATSAPP,
          channel: NotificationChannel.WHATSAPP,
          recipient: reg.phone,
          entityType: 'registration',
          entityId: ticketNumber,
          sender: () =>
            this.whatsappService!.sendTicketMessage({
              to: reg.phone,
              name: studentName,
              event: event.eventName,
              date,
              time,
              ticketNumber,
              ticketUrl,
            }),
        });
      }
    } catch (err) {
      // Notifications must never break registration/payment flows.
      this.logger.warn(`sendTicketNotifications failed: ${(err as Error)?.message}`);
    }
  }
}
