import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repo';
import { LoginDto } from './dto/login.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Role as PrismaRole } from '@prisma/client';
import { Role } from '../common/constants/roles';
import { normalizePhone } from '../common/utils/phone';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly OTP_EXPIRY_MINUTES = 5;
  private readonly OTP_MAX_ATTEMPTS = 5;

  constructor(
    private readonly authRepo: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly whatsappService: WhatsappService,
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
    return Math.floor(100000 + Math.random() * 900000).toString();
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
    if (user.role !== Role.ADMIN && user.role !== Role.ORGANIZER) {
      throw new UnauthorizedException('OTP login only for ADMIN and ORGANIZER');
    }

    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
    const purpose = user.role === Role.ADMIN ? 'ADMIN_LOGIN' : 'ORGANIZER_LOGIN';

    await this.authRepo.createOtp({
      identifier,
      otpHash,
      purpose: purpose as any,
      expiresAt,
    });

    // Log to console for dev/testing
    const roleLabel = user.role;
    console.log(`[OTP] ${roleLabel} ${identifier} -> ${otp}`);
    this.logger.log(`[OTP] ${roleLabel} ${identifier} -> ${otp}`);

    // Mock WhatsApp delivery
    await this.whatsappService.sendOtp(identifier, otp);

    return { message: 'OTP sent. Check server console (development mock).', expiresAt };
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
    if (user.role !== Role.ADMIN && user.role !== Role.ORGANIZER) {
      throw new UnauthorizedException('OTP login only for ADMIN and ORGANIZER');
    }

    // Optional: ensure purpose matches role
    const expectedPurpose = user.role === Role.ADMIN ? 'ADMIN_LOGIN' : 'ORGANIZER_LOGIN';
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
