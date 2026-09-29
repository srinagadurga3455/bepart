import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(@Optional() private readonly config?: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.config?.get<string>('WHATSAPP_ACCESS_TOKEN') && this.config?.get<string>('WHATSAPP_PHONE_NUMBER_ID'));
  }

  private apiVersion(): string {
    return this.config?.get<string>('WHATSAPP_API_VERSION') || 'v26.0';
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
    const res = await fetch(`https://graph.facebook.com/${this.apiVersion()}/${phoneNumberId}/messages`, {
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

  /** Legacy OTP hook (kept signature-compatible). Real text when a phone identifier is used. */
  async sendOtp(destination: string, otp: string): Promise<void> {
    if (destination.includes('@')) return; // email identifiers go through SES
    const res = await this.sendTextMessage(destination, `Your BePart verification code is: ${otp}. It expires in 5 minutes.`);
    if (res.skipped) {
      this.logger.log(`[WhatsApp OTP skipped — not configured] To: ${destination}`);
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
}
