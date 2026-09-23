import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByIdWithOrganizerProfile(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { organizerProfile: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByPhone(phone: string) {
    return this.prisma.user.findFirst({ where: { phone } });
  }

  findFirstByPhone(phone: string) {
    return this.prisma.user.findFirst({ where: { phone } });
  }

  findFirstByEmailOrPhone(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
  }

  create(data: any) {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: any) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
