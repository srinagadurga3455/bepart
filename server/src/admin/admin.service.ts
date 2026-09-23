import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async dashboard() {
    return { message: 'admin dashboard stub', stats: {} };
  }

  async listOrganizers() {
    return [];
  }

  async approveOrganizer(_id: string) {
    return { message: 'approve stub' };
  }

  async listEvents() {
    return [];
  }

  async createAdmin(dto: CreateAdminDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new ConflictException('Email already registered');

    const existingAdminByEmail = await this.prisma.admin.findFirst({ where: { companyName: dto.companyName.trim() } }).catch(() => null);
    // Not unique, just check User email

    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 10);
    const hashed = await bcrypt.hash(dto.password, rounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email: normalizedEmail,
          password: hashed,
          phone: dto.phone?.trim(),
          role: Role.ADMIN,
          isActive: true,
        },
      });

      const admin = await tx.admin.create({
        data: {
          id: user.id,
          companyName: dto.companyName.trim(),
          description: dto.description?.trim(),
          status: 'ACTIVE',
        },
      });

      return { user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }, admin };
    });

    // sanitize: remove password already not returned
    return result;
  }
}
