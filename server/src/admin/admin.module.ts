import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repo';
@Module({ controllers: [AdminController], providers: [AdminService, AdminRepository], exports: [AdminService] })
export class AdminModule {}
