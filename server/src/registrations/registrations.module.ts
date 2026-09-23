import { Module } from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsRepository } from './registrations.repo';
@Module({ controllers: [RegistrationsController], providers: [RegistrationsService, RegistrationsRepository], exports: [RegistrationsService] })
export class RegistrationsModule {}
