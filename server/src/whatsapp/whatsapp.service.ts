import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { MetaWhatsappProvider } from './whatsapp.provider';
import {
  PAYOUT_REJECTED_TEMPLATE,
  PAYOUT_REQUEST_TEMPLATE,
  PAYOUT_SUCCESSFUL_TEMPLATE,
  TICKET_DETAILS_TEMPLATE,
  buildPayoutRejectedComponents,
  buildPayoutRequestComponents,
  buildPayoutSuccessfulBodyOnly,
  buildPayoutSuccessfulComponents,
  buildTicketDetailsComponents,
} from './templates/payout-templates';

export interface TicketReadyInput {
  registrationId: string;
}

export type NotifyStatus = 'sent' | 'duplicate' | 'skipped' | 'failed';

export interface NotifyResult {
  status: NotifyStatus;
  ticketId?: string;
  reason?: string;
}

export interface PayoutNotifyResult {
  attempted: number;
  sent: number;
  failed: number;
}

/** Max send attempts per ticket before giving up (retryFailed honors this). */
export const MAX_DELIVERY_ATTEMPTS = 3;
/** Stale PENDING rows older than this are eligible for retryFailed pickup. */
export const STALE_PENDING_MS = 15 * 60 * 1000;

/** Registration phones are stored canonical (last 10 digits, Indian mobiles). */
export function toMetaRecipient(phone: unknown): string | null {
  const digits = String(phone ?? '').replace(/[^\d]/g, '');
  if (!/^\d{10,15}$/.test(digits)) return null;
  return digits.length === 10 ? `91${digits}` : digits;
}

/** Only public HTTPS URLs can be used as WhatsApp image headers (never local://). */
export function isPublicHttpsUrl(url: unknown): boolean {
  return typeof url === 'string' && /^https:\/\//i.test(url.trim());
}

function registrantName(formData: any): string {
  const fd = formData && typeof formData === 'object' ? formData : {};
  const name = fd.teamName || fd.member1Name || fd.fullName;
  return typeof name === 'string' && name.trim() ? name.trim() : 'there';
}

function formatEventDate(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

function formatEventTime(d: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(d);
}

/** Display paise storage as ₹ string for WhatsApp body params. */
function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export interface WhatsAppSendResult {
  messageId?: string;
  skipped: boolean;
}

interface TemplateComponent {
  type: string;
  parameters?: Array<Record<string, unknown>>;
  sub_type?: string;
  index?: number;
}

const bodyParams = (values: unknown[]): TemplateComponent => ({
  type: 'body',
  parameters: values.map((v) => ({ type: 'text', text: String(v ?? '') })),
});

const urlButton = (index: number, values: unknown[]): TemplateComponent => ({
  type: 'button',
  sub_type: 'url',
  index,
  parameters: values.map((v) => ({ type: 'text', text: String(v ?? '') })),
});

/**
 * Meta WhatsApp Cloud API client (ported from the proven Pravesh
 * notification microservice: graph API post + ticket/payout templates).
 * When WhatsApp is not configured, sends are skipped with a warning so
 * payments/tickets/settlements keep working — callers record SKIPPED.
 * Provider failures throw so NotificationLog records FAILED accurately.
 * The access token never leaves the server.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly meta?: MetaWhatsappProvider,
  ) {}

  /** Alias so recovery-side code using `configService` keeps working. */
  private get configService(): ConfigService | undefined {
    return this.config;
  }

  isConfigured(): boolean {
    return !!(this.config?.get<string>('WHATSAPP_ACCESS_TOKEN') && this.config?.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
  }

  /**
   * Normalize to international format without '+' (Cloud API requirement).
   * Indian 10-digit mobiles get the 91 prefix.
   */
  toInternationalFormat(to: string): string {
    const digits = String(to || '').replace(/\D/g, '');
    if (digits.length === 10) return `91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
    return digits;
  }

  private async postMessage(payload: Record<string, unknown>): Promise<string | undefined> {
    const accessToken = this.config?.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config?.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken || !phoneNumberId) {
      this.logger.warn(`WhatsApp not configured — skipping message to ${(payload as any)?.to}`);
      throw new Error('WhatsApp is not configured');
    }
    const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) {
      throw new Error(data?.error?.message || `WhatsApp API error: ${res.status}`);
    }
    return data?.messages?.[0]?.id;
  }

  async sendTextMessage(to: string, body: string): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp not configured — skipping text to ${to}`);
      return { skipped: true };
    }
    const messageId = await this.postMessage({ to: this.toInternationalFormat(to), type: 'text', text: { body } });
    return { messageId, skipped: false };
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    components: TemplateComponent[] = [],
    languageCode = 'en',
  ): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp not configured — skipping template ${templateName} to ${to}`);
      return { skipped: true };
    }
    const messageId = await this.postMessage({
      to: this.toInternationalFormat(to),
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    });
    return { messageId, skipped: false };
  }

  /** Legacy OTP hook (kept signature-compatible). Real text when a phone identifier is used. Never throws; OTP values stay out of production logs. */
  async sendOtp(destination: string, otp: string): Promise<void> {
    if (destination.includes('@')) return; // email identifiers go through SES
    try {
      const res = await this.sendTextMessage(destination, `Your BePart verification code is: ${otp}. It expires in 5 minutes.`);
      if (res.skipped) {
        this.logger.log(`[WhatsApp OTP skipped — not configured] To: ${destination}`);
      } else if (process.env.NODE_ENV === 'production') {
        this.logger.log('[WhatsApp OTP] dispatch suppressed in production (value hidden)');
      }
    } catch (err) {
      // Delivery must never break callers — record and swallow.
      this.logger.warn(`WhatsApp OTP send failed (value hidden): ${(err as Error)?.message}`);
    }
  }

  async sendTicketMessage(input: {
    to: string;
    name: string;
    event: string;
    date: string;
    time: string;
    ticketNumber: string;
    ticketUrl: string;
  }): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp not configured — skipping ticket message to ${input.to}`);
      return { skipped: true };
    }
    // Approved `ticket_details` template (body: name/event/date/time/ticket + URL button).
    // Falls back to free-form text when the template is not approved on the account.
    try {
      return await this.sendTemplateMessage(input.to, 'ticket_details', [
        bodyParams([input.name, input.event, input.date, input.time, input.ticketNumber]),
        urlButton(0, [input.ticketNumber]),
      ]);
    } catch (err) {
      this.logger.warn(`ticket_details template failed, falling back to text: ${(err as Error)?.message}`);
      return this.sendTextMessage(
        input.to,
        [
          `BePart: Your registration for ${input.event} is confirmed.`,
          ``,
          `Ticket: ${input.ticketNumber}`,
          `Date: ${input.date} at ${input.time}`,
          ``,
          `View your ticket:`,
          input.ticketUrl,
        ].join('\n'),
      );
    }
  }

  async sendSettlementRequestNotification(input: {
    to: string;
    organizer: string;
    event: string;
    amount: string;
    availableBalance: string;
    settlementId: string;
    reviewUrl?: string;
  }): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp not configured — skipping settlement-request notify to ${input.to}`);
      return { skipped: true };
    }
    try {
      return await this.sendTemplateMessage(input.to, 'payout_request', [
        bodyParams([input.amount, input.organizer, input.event, input.settlementId]),
        urlButton(0, [input.settlementId]),
      ]);
    } catch (err) {
      this.logger.warn(`payout_request template failed, falling back to text: ${(err as Error)?.message}`);
      return this.sendTextMessage(
        input.to,
        [
          `BePart Settlement Request`,
          ``,
          `Organizer: ${input.organizer}`,
          `Event: ${input.event}`,
          `Requested Amount: ${input.amount}`,
          `Available Balance: ${input.availableBalance}`,
          `Settlement ID: ${input.settlementId}`,
          input.reviewUrl ? `Review: ${input.reviewUrl}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
    }
  }

  async sendSettlementApprovedNotification(input: {
    to: string;
    organizer: string;
    event: string;
    amount: string;
    settlementId: string;
  }): Promise<WhatsAppSendResult> {
    return this.sendTextMessage(
      input.to,
      [
        `BePart: Your settlement request for ${input.event} has been approved and is being processed.`,
        ``,
        `Amount: ${input.amount}`,
        `Settlement ID: ${input.settlementId}`,
      ].join('\n'),
    );
  }

  async sendSettlementRejectedNotification(input: {
    to: string;
    organizer: string;
    event: string;
    amount: string;
    reason: string;
    settlementId: string;
  }): Promise<WhatsAppSendResult> {
    return this.sendTextMessage(
      input.to,
      [
        `BePart: Your settlement request for ${input.event} was rejected.`,
        ``,
        `Amount: ${input.amount}`,
        `Reason: ${input.reason}`,
        `Settlement ID: ${input.settlementId}`,
      ].join('\n'),
    );
  }

  async sendSettlementPaidNotification(input: {
    to: string;
    amount: string;
    utr: string;
    paidAt: string;
    settlementId: string;
  }): Promise<WhatsAppSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(`WhatsApp not configured — skipping settlement-paid notify to ${input.to}`);
      return { skipped: true };
    }
    try {
      return await this.sendTemplateMessage(input.to, 'payout_successful', [
        bodyParams([input.settlementId, input.amount, input.utr]),
      ]);
    } catch (err) {
      this.logger.warn(`payout_successful template failed, falling back to text: ${(err as Error)?.message}`);
      return this.sendTextMessage(
        input.to,
        [
          `BePart Settlement Completed`,
          ``,
          `Settlement: ${input.settlementId}`,
          `Amount Paid: ${input.amount}`,
          `UTR: ${input.utr}`,
          `Payment Date: ${input.paidAt}`,
          ``,
          `Your settlement has been completed.`,
        ].join('\n'),
      );
    }
  }

  private cfg(key: string, fallback = ''): string {
    const v = this.configService?.get<string>(key);
    if (v !== undefined && v !== null && v !== '') return v;
    return process.env[key] ?? fallback;
  }

  private get accessToken(): string {
    return this.cfg('WHATSAPP_ACCESS_TOKEN');
  }

  private get phoneNumberId(): string {
    return this.cfg('WHATSAPP_PHONE_NUMBER_ID');
  }

  private get apiVersion(): string {
    return this.cfg('WHATSAPP_API_VERSION', 'v21.0') || 'v21.0';
  }

  /** Pravesh ticket_details contract (legacy WHATSAPP_TEMPLATE_NAME as fallback). */
  private get ticketTemplate(): string {
    return (
      this.cfg('WHATSAPP_TICKET_TEMPLATE') ||
      this.cfg('WHATSAPP_TEMPLATE_NAME') ||
      TICKET_DETAILS_TEMPLATE
    );
  }

  private get templateLanguage(): string {
    return this.cfg('WHATSAPP_TEMPLATE_LANGUAGE', 'en') || 'en';
  }

  private get payoutRequestTemplate(): string {
    return this.cfg('WHATSAPP_PAYOUT_REQUEST_TEMPLATE') || PAYOUT_REQUEST_TEMPLATE;
  }

  private get payoutSuccessTemplate(): string {
    return this.cfg('WHATSAPP_PAYOUT_SUCCESS_TEMPLATE') || PAYOUT_SUCCESSFUL_TEMPLATE;
  }

  private get payoutRejectTemplate(): string {
    return this.cfg('WHATSAPP_PAYOUT_REJECT_TEMPLATE') || PAYOUT_REJECTED_TEMPLATE;
  }

  private get adminFallbackNumber(): string {
    return this.cfg('ADMIN_WHATSAPP_NUMBER');
  }

  private get provider(): MetaWhatsappProvider {
    // Always provided by WhatsappModule; the fallback keeps direct
    // instantiation (scripts/tests) working without a module context.
    return this.meta ?? new MetaWhatsappProvider();
  }

  /**
   * Send the ticket-confirmation template for a freshly created ticket.
   * Safe to call from payment/registration flows: it NEVER throws, never
   * touches payment/registration/ticket rows, and a second call for the same
   * ticket is a no-op thanks to the unique ticketId delivery record.
   */
  async notifyTicketReady(input: TicketReadyInput): Promise<NotifyResult> {
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        this.logger.log('WhatsApp not configured (WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID missing) — skipping ticket notification');
        return { status: 'skipped', reason: 'whatsapp-not-configured' };
      }
      const registration = await this.prisma.registration.findUnique({
        where: { registrationId: input.registrationId },
        include: { event: true, ticket: true },
      });
      const ticket = (registration as any)?.ticket;
      if (!registration || !ticket) {
        this.logger.warn(`WhatsApp notify skipped: no ticket yet for registration ${input.registrationId}`);
        return { status: 'skipped', reason: 'no-ticket-yet' };
      }
      if (ticket.status === 'CANCELLED') {
        this.logger.log(`WhatsApp notify skipped: ticket ${ticket.id} is cancelled`);
        return { status: 'skipped', ticketId: ticket.id, reason: 'ticket-cancelled' };
      }
      return await this.claimAndSend(ticket.id, String((registration as any).phone ?? ''), registration, ticket);
    } catch (e) {
      // Delivery must never break payment/ticket creation.
      this.logger.warn(`WhatsApp notify failed (ticket kept valid): ${(e as Error)?.message}`);
      return { status: 'failed', reason: (e as Error)?.message || 'unknown-error' };
    }
  }

  /**
   * Re-attempt FAILED deliveries (bounded by MAX_DELIVERY_ATTEMPTS) plus stale
   * PENDING rows left by crashed workers. Retry-ready without any queue infra:
   * wire to a scheduler later if needed. Never throws.
   */
  async retryFailed(limit = 25): Promise<{ attempted: number; sent: number }> {
    let attempted = 0;
    let sent = 0;
    try {
      if (!this.accessToken || !this.phoneNumberId) return { attempted, sent };
      const staleSince = new Date(Date.now() - STALE_PENDING_MS);
      const rows = await this.prisma.whatsappDelivery.findMany({
        where: {
          OR: [
            { status: 'FAILED', attempts: { lt: MAX_DELIVERY_ATTEMPTS } },
            { status: 'PENDING', updatedAt: { lt: staleSince } },
          ],
        },
        orderBy: { updatedAt: 'asc' },
        take: Math.max(1, Math.min(limit, 100)),
      });
      for (const row of rows as any[]) {
        attempted += 1;
        try {
          const ticket = await this.prisma.ticket.findUnique({
            where: { id: row.ticketId },
            include: { registration: { include: { event: true } } },
          });
          const registration = (ticket as any)?.registration;
          if (!ticket || !registration || ticket.status === 'CANCELLED') continue;
          const r = await this.attemptSend(row, String(registration.phone ?? ''), registration, ticket);
          if (r === 'sent') sent += 1;
        } catch (e) {
          this.logger.warn(`WhatsApp retry failed for ticket ${row.ticketId}: ${(e as Error)?.message}`);
        }
      }
    } catch (e) {
      this.logger.warn(`WhatsApp retryFailed aborted: ${(e as Error)?.message}`);
    }
    return { attempted, sent };
  }

  /** Claim the one delivery row for a ticket, then send unless already SENT. */
  private async claimAndSend(
    ticketId: string,
    phone: string,
    registration: any,
    ticket: any,
  ): Promise<NotifyResult> {
    let row: any;
    try {
      row = await this.prisma.whatsappDelivery.create({
        data: { ticketId, phone, status: 'PENDING' },
      });
    } catch (e: any) {
      // Unique ticketId race: another trigger already claimed this ticket.
      if (e?.code !== 'P2002') throw e;
      row = await this.prisma.whatsappDelivery.findUnique({ where: { ticketId } });
      if (!row) throw e;
    }
    if (row.status === 'SENT') {
      return { status: 'duplicate', ticketId };
    }
    if (row.status === 'FAILED' && (row.attempts ?? 0) >= MAX_DELIVERY_ATTEMPTS) {
      return { status: 'failed', ticketId, reason: 'max-attempts-reached' };
    }
    const outcome = await this.attemptSend(row, phone, registration, ticket);
    if (outcome === 'sent') return { status: 'sent', ticketId };
    if (outcome === 'duplicate') return { status: 'duplicate', ticketId };
    return { status: 'failed', ticketId, reason: outcome };
  }

  /**
   * One ticket send attempt against an existing row. Uses the Pravesh
   * `ticket_details` contract: body [name, event, date, time, venue] +
   * URL button [ticket code]. Returns 'sent' or an error reason.
   */
  private async attemptSend(row: any, phone: string, registration: any, ticket: any): Promise<string> {
    const to = toMetaRecipient(phone);
    if (!to) {
      await this.markFailed(row.id, 'missing-or-invalid-phone');
      return 'missing-or-invalid-phone';
    }
    const event = registration.event || {};
    const eventDate = event.date ? new Date(event.date) : null;
    const validDate = eventDate && !isNaN(eventDate.getTime()) ? eventDate : null;
    // BePart events carry no venue column; fall back through known aliases.
    const venue = String(
      (event as any).venue ?? (event as any).location ?? (event as any).address ?? 'See ticket',
    );
    const components = buildTicketDetailsComponents({
      name: registrantName(registration.formData),
      event: String(event.eventName || 'your event'),
      date: validDate ? formatEventDate(validDate) : '—',
      time: validDate ? formatEventTime(validDate) : '—',
      venue,
      ticketId: String(ticket.code),
    });
    await this.prisma.whatsappDelivery.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 }, phone: String(phone) },
    });
    try {
      const result = await this.provider.sendTemplate(
        {
          accessToken: this.accessToken,
          phoneNumberId: this.phoneNumberId,
          apiVersion: this.apiVersion,
        },
        {
          to,
          templateName: this.ticketTemplate,
          languageCode: this.templateLanguage,
          components,
        },
      );
      await this.prisma.whatsappDelivery.update({
        where: { id: row.id },
        data: { status: 'SENT', providerMessageId: result.providerMessageId, lastError: null },
      });
      this.logger.log(`WhatsApp ticket confirmation sent (ticket ${ticket.id}, provider id hidden)`);
      return 'sent';
    } catch (e) {
      const reason = ((e as Error)?.message || 'send-failed').slice(0, 1000);
      await this.prisma.whatsappDelivery.update({
        where: { id: row.id },
        data: { status: 'FAILED', lastError: reason },
      });
      this.logger.warn(`WhatsApp send failed for ticket ${ticket.id}: ${reason}`);
      return reason;
    }
  }

  private async markFailed(rowId: string, reason: string): Promise<void> {
    await this.prisma.whatsappDelivery.update({
      where: { id: rowId },
      data: { status: 'FAILED', lastError: reason },
    });
  }

  // ── Payout notifications (side effects only — never throw) ──

  /** Active admin recipients from the DB (Admin.phone + ADMIN User phones), fallback env last. */
  private async getAdminRecipients(): Promise<string[]> {
    const out: string[] = [];
    const seen = new Set<string>();
    const push = (raw: unknown) => {
      const to = toMetaRecipient(raw);
      if (to && !seen.has(to)) {
        seen.add(to);
        out.push(to);
      }
    };
    try {
      const admins = await (this.prisma as any).admin?.findMany?.({
        where: { status: { in: ['ACTIVE', 'APPROVED'] } },
        select: { phone: true },
      });
      for (const a of admins ?? []) push((a as any)?.phone);
    } catch (e) {
      this.logger.warn(`Admin phone lookup failed: ${(e as Error)?.message}`);
    }
    try {
      const users = await (this.prisma as any).user?.findMany?.({
        where: { role: 'ADMIN', isActive: true },
        select: { phone: true },
      });
      for (const u of users ?? []) push((u as any)?.phone);
    } catch (e) {
      this.logger.warn(`Admin user phone lookup failed: ${(e as Error)?.message}`);
    }
    // Documented fallback only when the DB yields no admin phone.
    if (out.length === 0 && this.adminFallbackNumber) push(this.adminFallbackNumber);
    return out;
  }

  /** Organizer recipient: Organizer.phone first, then linked User.phone. */
  private async getOrganizerRecipient(organizerId: string): Promise<string | null> {
    try {
      const org = await (this.prisma as any).organizer?.findUnique?.({
        where: { id: organizerId },
        include: { user: { select: { phone: true } } },
      });
      return toMetaRecipient((org as any)?.phone ?? (org as any)?.user?.phone ?? null);
    } catch (e) {
      this.logger.warn(`Organizer phone lookup failed: ${(e as Error)?.message}`);
      return null;
    }
  }

  private notifyDb(): any {
    return (this.prisma as any).withdrawalNotification;
  }

  private async recordPayoutSend(
    withdrawalId: string,
    kind: 'PAYOUT_REQUEST' | 'PAYOUT_SUCCESS' | 'PAYOUT_REJECTED',
    to: string,
    template: string,
    send: () => Promise<{ providerMessageId: string }>,
  ): Promise<boolean> {
    const db = this.notifyDb();
    let row: any = null;
    try {
      if (!this.accessToken || !this.phoneNumberId) {
        this.logger.log(`WhatsApp not configured — skipping ${kind} for withdrawal ${withdrawalId}`);
        return false;
      }
      row = await db.create({ data: { withdrawalId, kind, to, template, status: 'PENDING' } });
      await db.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
      const result = await send();
      await db.update({
        where: { id: row.id },
        data: { status: 'SENT', providerMessageId: result.providerMessageId, lastError: null },
      });
      this.logger.log(`WhatsApp ${kind} sent for withdrawal ${withdrawalId} (provider id hidden)`);
      return true;
    } catch (e) {
      const reason = ((e as Error)?.message || 'send-failed').slice(0, 1000);
      try {
        if (row?.id) {
          await db.update({ where: { id: row.id }, data: { status: 'FAILED', lastError: reason } });
        } else {
          await db.create({
            data: { withdrawalId, kind, to, template, status: 'FAILED', attempts: 0, lastError: reason },
          });
        }
      } catch {
        // Audit write itself failed — business op already succeeded; just log.
      }
      this.logger.warn(`WhatsApp ${kind} failed for withdrawal ${withdrawalId}: ${reason}`);
      return false;
    }
  }

  private payoutConfig() {
    return {
      accessToken: this.accessToken,
      phoneNumberId: this.phoneNumberId,
      apiVersion: this.apiVersion,
    };
  }

  private async loadWithdrawalForNotify(id: string): Promise<any | null> {
    try {
      return await (this.prisma as any).withdrawal?.findUnique?.({
        where: { id },
        include: {
          event: { select: { id: true, eventName: true } },
          organizer: { select: { id: true, name: true, phone: true, upiId: true } },
        },
      });
    } catch (e) {
      this.logger.warn(`Withdrawal lookup failed for notify ${id}: ${(e as Error)?.message}`);
      return null;
    }
  }

  /**
   * Notify active admins that an organizer created a payout request.
   * Call AFTER the withdrawal row is persisted. Never throws.
   */
  async notifyPayoutRequest(withdrawalId: string): Promise<PayoutNotifyResult> {
    const res: PayoutNotifyResult = { attempted: 0, sent: 0, failed: 0 };
    try {
      const w = await this.loadWithdrawalForNotify(withdrawalId);
      if (!w) return res;
      const recipients = await this.getAdminRecipients();
      if (recipients.length === 0) {
        this.logger.warn(`No admin WhatsApp recipient for payout request ${withdrawalId} — skipping`);
        return res;
      }
      const components = buildPayoutRequestComponents({
        amount: formatPaise(Number(w.amount ?? 0)),
        organizer: String(w.organizer?.name ?? 'Organizer'),
        event: String(w.event?.eventName ?? 'event'),
        requestId: String(w.id),
      });
      for (const to of recipients) {
        res.attempted += 1;
        const ok = await this.recordPayoutSend(withdrawalId, 'PAYOUT_REQUEST', to, this.payoutRequestTemplate, () =>
          this.provider.sendTemplate(this.payoutConfig(), {
            to,
            templateName: this.payoutRequestTemplate,
            languageCode: this.templateLanguage,
            components,
          }),
        );
        if (ok) res.sent += 1;
        else res.failed += 1;
      }
    } catch (e) {
      this.logger.warn(`notifyPayoutRequest failed (request kept): ${(e as Error)?.message}`);
    }
    return res;
  }

  /**
   * Notify the organizer that their payout was paid. Uses the Pravesh
   * `payout_successful` image-header contract when a public HTTPS proof URL
   * exists; otherwise falls back to body-only (local:// never sent).
   * Call AFTER the PAID transition is persisted. Never throws.
   */
  async notifyPayoutSuccess(withdrawalId: string): Promise<PayoutNotifyResult> {
    const res: PayoutNotifyResult = { attempted: 0, sent: 0, failed: 0 };
    try {
      const w = await this.loadWithdrawalForNotify(withdrawalId);
      if (!w) return res;
      const to = await this.getOrganizerRecipient(String(w.organizerId ?? w.organizer?.id ?? ''));
      if (!to) {
        this.logger.warn(`No organizer WhatsApp recipient for payout ${withdrawalId} — skipping`);
        return res;
      }
      const params = {
        name: String(w.organizer?.name ?? 'Organizer'),
        amount: formatPaise(Number(w.amount ?? 0)),
        transactionId: String(w.transactionId ?? ''),
      };
      const proofUrl = typeof w.proofUrl === 'string' ? w.proofUrl.trim() : '';
      const components = isPublicHttpsUrl(proofUrl)
        ? buildPayoutSuccessfulComponents({ ...params, imageUrl: proofUrl })
        : buildPayoutSuccessfulBodyOnly(params);
      if (!isPublicHttpsUrl(proofUrl)) {
        this.logger.warn(
          `Payout ${withdrawalId} proof is not a public HTTPS URL — sending body-only payout_successful`,
        );
      }
      res.attempted += 1;
      const ok = await this.recordPayoutSend(withdrawalId, 'PAYOUT_SUCCESS', to, this.payoutSuccessTemplate, () =>
        this.provider.sendTemplate(this.payoutConfig(), {
          to,
          templateName: this.payoutSuccessTemplate,
          languageCode: this.templateLanguage,
          components,
        }),
      );
      if (ok) res.sent += 1;
      else res.failed += 1;
    } catch (e) {
      this.logger.warn(`notifyPayoutSuccess failed (payout kept PAID): ${(e as Error)?.message}`);
    }
    return res;
  }

  /**
   * Notify the organizer that their payout was rejected (reason required).
   * Call AFTER the REJECTED transition is persisted. Never throws.
   */
  async notifyPayoutRejected(withdrawalId: string): Promise<PayoutNotifyResult> {
    const res: PayoutNotifyResult = { attempted: 0, sent: 0, failed: 0 };
    try {
      const w = await this.loadWithdrawalForNotify(withdrawalId);
      if (!w) return res;
      const to = await this.getOrganizerRecipient(String(w.organizerId ?? w.organizer?.id ?? ''));
      if (!to) {
        this.logger.warn(`No organizer WhatsApp recipient for rejected payout ${withdrawalId} — skipping`);
        return res;
      }
      const components = buildPayoutRejectedComponents({
        organizerName: String(w.organizer?.name ?? 'Organizer'),
        amount: formatPaise(Number(w.amount ?? 0)),
        requestId: String(w.id),
        reason: String(w.rejectionReason ?? 'No reason provided').slice(0, 500),
      });
      res.attempted += 1;
      const ok = await this.recordPayoutSend(withdrawalId, 'PAYOUT_REJECTED', to, this.payoutRejectTemplate, () =>
        this.provider.sendTemplate(this.payoutConfig(), {
          to,
          templateName: this.payoutRejectTemplate,
          languageCode: this.templateLanguage,
          components,
        }),
      );
      if (ok) res.sent += 1;
      else res.failed += 1;
    } catch (e) {
      this.logger.warn(`notifyPayoutRejected failed (rejection kept): ${(e as Error)?.message}`);
    }
    return res;
  }

  /**
   * Re-attempt FAILED payout notifications (bounded). Never throws.
   */
  async retryFailedPayoutNotifications(limit = 25): Promise<{ attempted: number; sent: number }> {
    let attempted = 0;
    let sent = 0;
    try {
      if (!this.accessToken || !this.phoneNumberId) return { attempted, sent };
      const staleSince = new Date(Date.now() - STALE_PENDING_MS);
      const rows = await this.notifyDb().findMany({
        where: {
          OR: [
            { status: 'FAILED', attempts: { lt: MAX_DELIVERY_ATTEMPTS } },
            { status: 'PENDING', updatedAt: { lt: staleSince } },
          ],
        },
        orderBy: { updatedAt: 'asc' },
        take: Math.max(1, Math.min(limit, 100)),
      });
      for (const row of rows as any[]) {
        attempted += 1;
        try {
          if (row.kind === 'PAYOUT_REQUEST') {
            const r = await this.notifyPayoutRequest(String(row.withdrawalId));
            sent += r.sent;
          } else if (row.kind === 'PAYOUT_SUCCESS') {
            const r = await this.notifyPayoutSuccess(String(row.withdrawalId));
            sent += r.sent;
          } else if (row.kind === 'PAYOUT_REJECTED') {
            const r = await this.notifyPayoutRejected(String(row.withdrawalId));
            sent += r.sent;
          }
        } catch (e) {
          this.logger.warn(`Payout retry failed for withdrawal ${row.withdrawalId}: ${(e as Error)?.message}`);
        }
      }
    } catch (e) {
      this.logger.warn(`retryFailedPayoutNotifications aborted: ${(e as Error)?.message}`);
    }
    return { attempted, sent };
  }
}
