import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface TicketEmailInput {
  to: string;
  studentName: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  organizerName: string;
  ticketNumber: string;
  ticketUrl: string;
  amountPaid?: string | null;
}

export interface SettlementEmailInput {
  to: string;
  organizerName: string;
  eventName: string;
  amount: string;
  settlementId: string;
  extra?: string;
  reviewUrl?: string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title: string, intro: string, bodyRows: string, footer: string): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
  <div style="font-size: 20px; font-weight: 800; color: #2557F5; margin-bottom: 4px;">BePart</div>
  <h2 style="margin: 0 0 8px; color: #111827;">${escapeHtml(title)}</h2>
  <p style="color: #4b5563; margin: 0 0 16px;">${escapeHtml(intro)}</p>
  ${bodyRows}
  <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">${escapeHtml(footer)}</p>
</div>`.trim();
}

function row(label: string, value: unknown): string {
  return `<p style="margin: 4px 0; color: #111827; font-size: 14px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

/**
 * Transactional email over Amazon SES (API, not SMTP).
 * When SES is not configured, sends are skipped with a warning — callers
 * decide the fallback. Never throws for missing config; throws only on real
 * provider failures so NotificationLog can record FAILED accurately.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: SESClient | null = null;

  constructor(@Optional() private readonly config?: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config?.get<string>('AWS_REGION') &&
      this.config?.get<string>('AWS_ACCESS_KEY_ID') &&
      this.config?.get<string>('AWS_SECRET_ACCESS_KEY') &&
      this.config?.get<string>('SES_FROM_EMAIL')
    );
  }

  private getClient(): SESClient | null {
    if (!this.isConfigured()) return null;
    if (!this.client) {
      this.client = new SESClient({
        region: this.config!.get<string>('AWS_REGION'),
        credentials: {
          accessKeyId: this.config!.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.config!.get<string>('AWS_SECRET_ACCESS_KEY')!,
        },
      });
    }
    return this.client;
  }

  async sendEmail(input: SendEmailInput): Promise<{ messageId?: string; skipped: boolean }> {
    const to = input.to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('"to" must be a valid email address');
    const ses = this.getClient();
    if (!ses) {
      this.logger.warn(`SES not configured — skipping email to ${to}: ${input.subject}`);
      return { skipped: true };
    }
    const from = this.config!.get<string>('SES_FROM_EMAIL')!;
    const res = await ses.send(
      new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: input.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: input.text, Charset: 'UTF-8' },
            ...(input.html ? { Html: { Data: input.html, Charset: 'UTF-8' } } : {}),
          },
        },
      }),
    );
    return { messageId: res.MessageId, skipped: false };
  }

  async sendOtpEmail(to: string, otp: string, expiryMinutes = 5): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `${otp} is your BePart verification code`;
    const text = [
      `Your BePart verification code is: ${otp}`,
      ``,
      `This code expires in ${expiryMinutes} minute(s).`,
      `If you did not request this code, you can safely ignore this email.`,
    ].join('\n');
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
  <div style="font-size: 20px; font-weight: 800; color: #2557F5; margin-bottom: 8px;">BePart</div>
  <h2 style="margin: 0 0 8px;">BePart verification code</h2>
  <p style="color: #4b5563; margin: 0 0 16px;">Use the code below to complete verification. It expires in ${expiryMinutes} minute(s).</p>
  <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px;">${escapeHtml(otp)}</div>
  <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">If you did not request this code, you can safely ignore this email.</p>
</div>`.trim();
    return this.sendEmail({ to, subject, text, html });
  }

  async sendRegistrationConfirmationEmail(input: TicketEmailInput): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `Registration confirmed: ${input.eventName}`;
    const text = [
      `Hi ${input.studentName},`,
      ``,
      `Your registration for ${input.eventName} is confirmed.`,
      `Date: ${input.eventDate} at ${input.eventTime}`,
      `Organizer: ${input.organizerName}`,
      `Ticket: ${input.ticketNumber}`,
      `View your ticket: ${input.ticketUrl}`,
    ].join('\n');
    const html = shell(
      'Registration confirmed',
      `Hi ${input.studentName}, your registration for ${input.eventName} is confirmed.`,
      [
        row('Event', input.eventName),
        row('Date', `${input.eventDate} at ${input.eventTime}`),
        row('Organizer', input.organizerName),
        row('Ticket', input.ticketNumber),
        input.amountPaid ? row('Amount paid', input.amountPaid) : '',
        `<p style="margin: 12px 0 0;"><a href="${escapeHtml(input.ticketUrl)}" style="color: #2557F5; font-weight: 700;">View your ticket</a></p>`,
      ].join(''),
      'Show this ticket (QR) at the entry gate for check-in.',
    );
    return this.sendEmail({ to: input.to, subject, text, html });
  }

  async sendTicketEmail(input: TicketEmailInput): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `Your BePart ticket: ${input.eventName} (${input.ticketNumber})`;
    const text = [
      `Hi ${input.studentName},`,
      ``,
      `Here is your ticket for ${input.eventName}.`,
      `Date: ${input.eventDate} at ${input.eventTime}`,
      `Organizer: ${input.organizerName}`,
      `Ticket: ${input.ticketNumber}`,
      `View your ticket: ${input.ticketUrl}`,
    ].join('\n');
    const html = shell(
      'Your BePart ticket',
      `Hi ${input.studentName}, here is your ticket for ${input.eventName}.`,
      [
        row('Event', input.eventName),
        row('Date', `${input.eventDate} at ${input.eventTime}`),
        row('Organizer', input.organizerName),
        row('Ticket', input.ticketNumber),
        `<p style="margin: 12px 0 0;"><a href="${escapeHtml(input.ticketUrl)}" style="color: #2557F5; font-weight: 700;">View your ticket</a></p>`,
      ].join(''),
      'Show this ticket (QR) at the entry gate for check-in.',
    );
    return this.sendEmail({ to: input.to, subject, text, html });
  }

  async sendSettlementRequestedEmail(input: SettlementEmailInput & { availableBalance: string }): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `BePart settlement request: ${input.eventName} (${input.amount})`;
    const text = [
      `A new settlement request needs review.`,
      ``,
      `Organizer: ${input.organizerName}`,
      `Event: ${input.eventName}`,
      `Requested amount: ${input.amount}`,
      `Available balance: ${input.availableBalance}`,
      `Settlement ID: ${input.settlementId}`,
      input.reviewUrl ? `Review: ${input.reviewUrl}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    const html = shell(
      'Settlement request',
      'A new settlement request needs review.',
      [
        row('Organizer', input.organizerName),
        row('Event', input.eventName),
        row('Requested amount', input.amount),
        row('Available balance', input.availableBalance),
        row('Settlement ID', input.settlementId),
        input.reviewUrl
          ? `<p style="margin: 12px 0 0;"><a href="${escapeHtml(input.reviewUrl)}" style="color: #2557F5; font-weight: 700;">Review request</a></p>`
          : '',
      ].join(''),
      'BePart settlements',
    );
    return this.sendEmail({ to: input.to, subject, text, html });
  }

  async sendSettlementApprovedEmail(input: SettlementEmailInput): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `BePart settlement approved: ${input.eventName}`;
    const text = [
      `Hi ${input.organizerName},`,
      ``,
      `Your settlement request for ${input.eventName} has been approved and is being processed.`,
      `Amount: ${input.amount}`,
      `Settlement ID: ${input.settlementId}`,
      input.extra ? input.extra : '',
    ]
      .filter(Boolean)
      .join('\n');
    const html = shell(
      'Settlement approved',
      `Hi ${input.organizerName}, your settlement request for ${input.eventName} has been approved and is being processed.`,
      [row('Amount', input.amount), row('Settlement ID', input.settlementId), input.extra ? row('Note', input.extra) : ''].join(''),
      'The transfer will be completed externally and recorded in BePart.',
    );
    return this.sendEmail({ to: input.to, subject, text, html });
  }

  async sendSettlementRejectedEmail(input: SettlementEmailInput & { reason: string }): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `BePart settlement update: ${input.eventName}`;
    const text = [
      `Hi ${input.organizerName},`,
      ``,
      `Your settlement request for ${input.eventName} was rejected.`,
      `Amount: ${input.amount}`,
      `Reason: ${input.reason}`,
      `Settlement ID: ${input.settlementId}`,
    ].join('\n');
    const html = shell(
      'Settlement rejected',
      `Hi ${input.organizerName}, your settlement request for ${input.eventName} was rejected.`,
      [row('Amount', input.amount), row('Reason', input.reason), row('Settlement ID', input.settlementId)].join(''),
      'You can submit a new request from your organizer dashboard.',
    );
    return this.sendEmail({ to: input.to, subject, text, html });
  }

  async sendSettlementPaidEmail(
    input: SettlementEmailInput & { utr: string; paidAt: string },
  ): Promise<{ messageId?: string; skipped: boolean }> {
    const subject = `BePart settlement completed: ${input.amount}`;
    const text = [
      `Hi ${input.organizerName},`,
      ``,
      `Your settlement has been completed.`,
      `Settlement: ${input.settlementId}`,
      `Amount paid: ${input.amount}`,
      `UTR: ${input.utr}`,
      `Payment date: ${input.paidAt}`,
    ].join('\n');
    const html = shell(
      'Settlement completed',
      `Hi ${input.organizerName}, your settlement has been completed.`,
      [
        row('Settlement', input.settlementId),
        row('Amount paid', input.amount),
        row('UTR', input.utr),
        row('Payment date', input.paidAt),
      ].join(''),
      'The payment proof is available on your organizer dashboard.',
    );
    return this.sendEmail({ to: input.to, subject, text, html });
  }
}
