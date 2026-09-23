import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  createAdminTransaction(data: { name: string; email: string; password: string; phone?: string; companyName: string; description?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email,
          password: data.password,
          phone: data.phone?.trim(),
          role: Role.ADMIN,
          isActive: true,
        },
      });

      const admin = await tx.admin.create({
        data: {
          id: user.id,
          companyName: data.companyName.trim(),
          description: data.description?.trim(),
          status: 'ACTIVE',
        },
      });

      return { user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }, admin };
    });
  }
}
