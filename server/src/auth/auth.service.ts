import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthRepository } from './auth.repo';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { EmailService } from '../email/email.service';
import { NotificationsService, NotificationTypes } from '../notifications/notifications.service';
import { NotificationChannel } from '@prisma/client';
import { Role as PrismaRole } from '@prisma/client';
import { Role } from '../common/constants/roles';
import { normalizePhone } from '../common/utils/phone';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly OTP_MAX_ATTEMPTS = 5;
  private readonly OTP_RESEND_COOLDOWN_SECONDS = 30;

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly whatsappService: WhatsappService,
    private readonly emailService: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  private sanitizeUser(user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user;
    return rest;
  }

  private signToken(user: { id: string; email: string; role: PrismaRole | Role }): {
    accessToken: string;
  } {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const secret = this.config.get<string>('JWT_SECRET');
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const accessToken = this.jwtService.sign(payload, { secret, expiresIn });
    return { accessToken };
  }

  private normalizeIdentifier(dto: RequestOtpDto | VerifyOtpDto): string {
    if (dto.email) return dto.email.toLowerCase().trim();
    if (dto.phone) return normalizePhone(dto.phone);
    throw new BadRequestException('Either email or phone is required');
  }

  // Phone numbers may be stored/entered in equivalent formats ("+91 987..." vs
  // "987..."). Exact match first; fall back to last-10-digits ONLY when it
  // resolves to exactly one user, otherwise treat as not found.
  private async findUserByPhoneFlexible(normalizedPhone: string): Promise<any> {
    const exact = await this.authRepo.findUserByPhone(normalizedPhone);
    if (exact) return exact;
    const digits = normalizedPhone.replace(/\D/g, '');
    if (digits.length < 10) return null;
    const candidates = await this.authRepo.findUsersByPhoneSuffix(digits.slice(-10));
    if (Array.isArray(candidates) && candidates.length === 1) return candidates[0];
    return null;
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  private purposeForRole(role: string): 'ADMIN_LOGIN' | 'ORGANIZER_LOGIN' | 'STUDENT_LOGIN' {
    if (role === Role.ADMIN) return 'ADMIN_LOGIN';
    if (role === Role.ORGANIZER) return 'ORGANIZER_LOGIN';
    return 'STUDENT_LOGIN';
  }

  async requestOtp(dto: RequestOtpDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }
    const identifier = this.normalizeIdentifier(dto);
    const isEmail = !!dto.email;

    let user: any = null;
    if (isEmail) {
      user = await this.authRepo.findUserByEmail(identifier);
    } else {
      user = await this.findUserByPhoneFlexible(identifier);
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if (user.role !== Role.ADMIN && user.role !== Role.ORGANIZER && user.role !== Role.STUDENT) {
      throw new UnauthorizedException('OTP login is not available for this account');
    }

    // Resend cooldown: one OTP per identifier per 30s (rate-limit friendly).
    const latest = await this.authRepo.findLatestOtp(identifier);
    if (latest && !latest.verified && latest.expiresAt > new Date()) {
      const ageSec = (Date.now() - new Date(latest.createdAt).getTime()) / 1000;
      if (ageSec < this.OTP_RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          `Please wait ${Math.ceil(this.OTP_RESEND_COOLDOWN_SECONDS - ageSec)} seconds before requesting a new OTP`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
    const purpose = this.purposeForRole(user.role);

    await this.authRepo.createOtp({
      identifier,
      otpHash,
      purpose: purpose as any,
      expiresAt,
    });

    // Real delivery: email identifiers via Amazon SES, phone via WhatsApp.
    // The OTP is never returned in the API response. In non-production the
    // OTP is also logged so testing can proceed without provider credentials;
    // production never logs it.
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    if (isEmail) {
      await this.notifications.sendOnce({
        type: NotificationTypes.OTP_EMAIL,
        channel: NotificationChannel.EMAIL,
        recipient: identifier,
        sender: () => this.emailService.sendOtpEmail(identifier, otp, this.OTP_EXPIRY_MINUTES),
      });
      if (!this.emailService.isConfigured() && !isProd) {
        console.log(`[OTP] ${user.role} ${identifier} -> ${otp}`);
      }
    } else {
      await this.notifications.sendOnce({
        type: NotificationTypes.OTP_WHATSAPP,
        channel: NotificationChannel.WHATSAPP,
        recipient: identifier,
        sender: () => this.whatsappService.sendTextMessage(
          identifier,
          `Your BePart verification code is: ${otp}. It expires in ${this.OTP_EXPIRY_MINUTES} minutes.`,
        ),
      });
      if (!this.whatsappService.isConfigured() && !isProd) {
        console.log(`[OTP] ${user.role} ${identifier} -> ${otp}`);
      }
    }

    return { message: 'OTP sent. It expires in 5 minutes.', expiresAt };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Either email or phone is required');
    }
    const identifier = this.normalizeIdentifier(dto);

    const record = await this.authRepo.findLatestValidOtp(identifier);

    if (!record) {
      throw new BadRequestException('OTP expired or not found. Please request a new OTP.');
    }

    if (record.attempts >= this.OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many failed attempts. Please request a new OTP.');
    }

    const valid = await bcrypt.compare(dto.otp, record.otpHash);
    if (!valid) {
      await this.authRepo.incrementOtpAttempts(record.id);
      throw new UnauthorizedException('Invalid OTP');
    }

    // Mark as verified / single-use
    await this.authRepo.markOtpVerified(record.id);

    // Find user by identifier
    let user: any = null;
    // identifier is either email or phone; try both
    if (dto.email) {
      user = await this.authRepo.findUserByEmail(identifier);
    } else {
      user = await this.findUserByPhoneFlexible(identifier);
    }
    // fallback: if we stored phone but user email lookup needed, try phone
    if (!user && dto.phone) {
      user = await this.findUserByPhoneFlexible(identifier);
    }
    // last fallback: try email lookup for phone identifier? try both
    if (!user) {
      user = await this.authRepo.findUserByEmailOrPhone(identifier);
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if (user.role !== Role.ADMIN && user.role !== Role.ORGANIZER && user.role !== Role.STUDENT) {
      throw new UnauthorizedException('OTP login is not available for this account');
    }

    // Optional: ensure purpose matches role
    const expectedPurpose = this.purposeForRole(user.role);
    if (record.purpose !== expectedPurpose) {
      // allow but log mismatch
      this.logger.warn(`OTP purpose ${record.purpose} mismatched user role ${user.role}`);
    }

    const { accessToken } = this.signToken(user);
    return {
      user: this.sanitizeUser(user),
      accessToken,
    };
  }

  // Password login disabled — OTP only for ADMIN/ORGANIZER
  async login(dto: LoginDto) {
    throw new BadRequestException('Password login is disabled. Use POST /api/auth/request-otp and /api/auth/verify-otp');
  }

  async getMe(userId: string) {
    const user = await this.authRepo.findUserByIdWithProfile(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.sanitizeUser(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.authRepo.findUserByEmailNormalized(email);
    if (!user || !user.password) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;
    return this.sanitizeUser(user);
  }
}
