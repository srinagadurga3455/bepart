import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsRepository } from './registrations.repo';
import { CouponsModule } from '../coupons/coupons.module';
import { TicketsModule } from '../tickets/tickets.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
@Module({ imports: [CouponsModule, TicketsModule, WhatsappModule], controllers: [RegistrationsController], providers: [RegistrationsService, RegistrationsRepository], exports: [RegistrationsService] })
export class RegistrationsModule {}
