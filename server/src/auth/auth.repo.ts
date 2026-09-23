import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // User queries (auth domain)
  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findFirst({ where: { phone } });
  }

  findUserByEmailOrPhone(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
  }

  findUserByIdWithProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { organizerProfile: true },
    });
  }

  findUserByEmailNormalized(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  }

  // OTP queries
  createOtp(data: { identifier: string; otpHash: string; purpose: any; expiresAt: Date }) {
    return this.prisma.otpVerification.create({ data });
  }

  findLatestValidOtp(identifier: string) {
    return this.prisma.otpVerification.findFirst({
      where: {
        identifier,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  incrementOtpAttempts(id: string) {
    return this.prisma.otpVerification.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  markOtpVerified(id: string) {
    return this.prisma.otpVerification.update({
      where: { id },
      data: { verified: true },
    });
  }
}
