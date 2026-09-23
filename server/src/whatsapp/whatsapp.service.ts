import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  async sendOtp(destination: string, otp: string): Promise<void> {
    // MOCK — do not call external service. Just log.
    // This method will be replaced later with real WhatsApp API.
    this.logger.log(`[WhatsApp OTP MOCK]\nTo: ${destination}\nOTP: ${otp}`);
    console.log(`[WhatsApp OTP MOCK]\nTo: ${destination}\nOTP: ${otp}`);
  }
}
