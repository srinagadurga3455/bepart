import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  // User queries (auth domain)
  // Case-insensitive on purpose: request identifiers are normalized to
  // lowercase, but stored rows may predate normalization (e.g. a seeded
  // ADMIN_EMAIL that kept its original case), and Postgres unique text
  // matches are case-sensitive. An exact match here would 401 a valid user
  // — and only for the differently-cased recipient. Email is unique, so at
  // most one row matches either way.
  findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    });
  }

  findUserByPhone(phone: string) {
    return this.prisma.user.findFirst({ where: { phone } });
  }

  // Suffix lookup for equivalent phone formats (e.g. stored "+91..." vs entered "987...").
  // Caller must require exactly one match to avoid ambiguous identity resolution.
  findUsersByPhoneSuffix(suffix: string) {
    return this.prisma.user.findMany({ where: { phone: { endsWith: suffix } } });
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

  findLatestOtp(identifier: string) {
    return this.prisma.otpVerification.findFirst({
      where: { identifier },
      orderBy: { createdAt: 'desc' },
    });
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
