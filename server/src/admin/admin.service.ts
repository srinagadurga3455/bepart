import { ConflictException, Injectable } from '@nestjs/common';
import { AdminRepository } from './admin.repo';
import { CreateAdminDto } from './dto/create-admin.dto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminRepo: AdminRepository,
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
    const existing = await this.adminRepo.findUserByEmail(normalizedEmail);
    if (existing) throw new ConflictException('Email already registered');

    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 10);
    const hashed = await bcrypt.hash(dto.password, rounds);

    const result = await this.adminRepo.createAdminTransaction({
      name: dto.name.trim(),
      email: normalizedEmail,
      password: hashed,
      phone: dto.phone?.trim(),
      companyName: dto.companyName.trim(),
      description: dto.description?.trim(),
    });

    // sanitize: remove password already not returned
    return result;
  }
}
