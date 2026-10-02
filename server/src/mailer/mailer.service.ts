import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  buildOtpEmail,
  isValidEmail,
  maskEmail,
  normalizeEmail,
} from './templates/otp-email.template';

export interface OtpMailOptions {
  appName?: string;
  expiryMinutes?: number;
  logoUrl?: string;
}

export interface MailSendResult {
  delivered: boolean;
  messageId?: string;
  /** Present only when SMTP is not configured (dev fallback). */
  reason?: string;
}

/**
 * Gmail/SMTP delivery — Nest port of Pravesh `smtp/client.js` + `smtp/config.js`.
 *
 * Delivery only: OTP generation, hashing, expiry, attempt limits and
 * single-use verification stay in AuthService + OtpVerification table.
 * Mirrors the Pravesh singleton-transporter pattern (one Nodemailer
 * transporter, STARTTLS on 587, implicit TLS on 465, TLS >= 1.2).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  private cfg(key: string, fallback = ''): string {
    const v = this.configService?.get<string>(key);
    if (v !== undefined && v !== null && v !== '') return v;
    return process.env[key] ?? fallback;
  }

  private get smtpHost(): string {
    return this.cfg('SMTP_HOST');
  }

  private get smtpPort(): number {
    return Number(this.cfg('SMTP_PORT', '587') || 587);
  }

  private get smtpUser(): string {
    return this.cfg('SMTP_USER');
  }

  private get smtpPass(): string {
    return this.cfg('SMTP_PASS');
  }

  private get smtpFrom(): string {
    return this.cfg('SMTP_FROM');
  }

  private get smtpFromName(): string {
    return this.cfg('SMTP_FROM_NAME', 'BePart');
  }

  /** True when Gmail/SMTP credentials are present (mirrors Pravesh isConfigured). */
  isConfigured(): boolean {
    return Boolean(this.smtpHost && this.smtpUser && this.smtpPass && this.smtpFrom);
  }

  /**
   * Presence-only diagnostics: booleans and port, never credential values.
   * Safe to emit in any environment.
   */
  logSmtpPresence(context: string): void {
    this.logger.log(
      `[SMTP ${context}] configured=${this.isConfigured()} ` +
        `host_set=${Boolean(this.smtpHost)} user_set=${Boolean(this.smtpUser)} ` +
        `password_set=${Boolean(this.smtpPass)} from_set=${Boolean(this.smtpFrom)} ` +
        `port=${this.smtpPort}`,
    );
  }

  /** Lazy singleton transporter (mirrors Pravesh getTransporter). */
  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) return this.transporter;
    const port = this.smtpPort;
    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port,
      secure: port === 465,
      auth: { user: this.smtpUser, pass: this.smtpPass },
      requireTLS: port === 587,
      tls: { minVersion: 'TLSv1.2' },
    });
    return this.transporter;
  }

  /** Test-only hook (mirrors Pravesh resetTransporter). */
  resetTransporter(): void {
    this.transporter = null;
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    await this.getTransporter().verify();
    return true;
  }

  /**
   * Send an OTP email. When SMTP is not configured this logs (without the
   * OTP in production) and returns delivered:false so AuthService can fall
   * back to the existing dev behavior. When configured, transport errors
   * throw so the caller can surface delivery failure instead of swallowing it.
   */
  async sendOtpEmail(to: string, otp: string, options: OtpMailOptions = {}): Promise<MailSendResult> {
    const cleanTo = normalizeEmail(to);
    if (!cleanTo || !isValidEmail(cleanTo)) {
      throw new Error('"to" must be a valid email address');
    }
    if (!otp) throw new Error('"otp" is required');

    const isProd = (this.cfg('NODE_ENV', 'development') || 'development') === 'production';
    const appName = options.appName || this.smtpFromName || 'BePart';
    const expiryMinutes = options.expiryMinutes ?? 5;
    const logoUrl = options.logoUrl || this.cfg('SMTP_LOGO_URL') || undefined;

    if (!this.isConfigured()) {
      // Dev/test fallback: preserve the old console behavior but never
      // leak the OTP into production logs.
      this.logSmtpPresence('otp-skip');
      if (isProd) {
        this.logger.log(`SMTP not configured — OTP email to ${cleanTo} skipped`);
      } else {
        this.logger.log(`SMTP not configured — OTP email to ${cleanTo} skipped (otp=${otp})`);
        console.log(`[SMTP OTP MOCK] To: ${cleanTo} OTP: ${otp}`);
      }
      return { delivered: false, reason: 'smtp-not-configured' };
    }

    const { subject, text, html } = buildOtpEmail({ otp, appName, expiryMinutes, logoUrl });
    const from = this.smtpFrom;
    const fromName = this.smtpFromName;
    // Masked recipient in logs: proves which address the mailer attempted
    // without persisting PII. OTP/password/token values are never logged.
    const masked = maskEmail(cleanTo);
    try {
      this.logSmtpPresence('otp-send');
      this.logger.log(`Sending OTP email to ${masked}`);
      const info = await this.getTransporter().sendMail({
        from: fromName ? `"${fromName}" <${from}>` : from,
        to: cleanTo,
        subject,
        text,
        html,
      });
      this.logger.log(`OTP email accepted by SMTP for ${masked} (id hidden)`);
      return { delivered: true, messageId: info?.messageId };
    } catch (e) {
      // Nodemailer errors carry code/responseCode/response (no secrets).
      // Surface them so a recipient-specific rejection (mailbox unknown,
      // suppressed, policy block) is distinguishable from a connection or
      // auth failure. The caller maps this to a generic API error.
      const err = e as any;
      const code = err?.code || err?.responseCode;
      const response = typeof err?.response === 'string' ? err.response : undefined;
      const reason = (e as Error)?.message || 'smtp-send-failed';
      const detail = [code ? `code=${code}` : null, response ? `response=${response}` : null, reason]
        .filter(Boolean)
        .join(' | ');
      this.logger.warn(`OTP email to ${masked} failed: ${detail}`);
      throw new Error(`SMTP send failed: ${detail}`);
    }
  }
}
