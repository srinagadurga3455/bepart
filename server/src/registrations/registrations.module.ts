import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsRepository } from './registrations.repo';
import { CouponsModule } from '../coupons/coupons.module';
@Module({ imports: [CouponsModule], controllers: [RegistrationsController], providers: [RegistrationsService, RegistrationsRepository], exports: [RegistrationsService] })
export class RegistrationsModule {}
