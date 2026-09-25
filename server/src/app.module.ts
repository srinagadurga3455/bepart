import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigurationModule } from './config/configuration.module';
import { DatabaseModule } from './database/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizersModule } from './organizers/organizers.module';
import { EventsModule } from './events/events.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { AdminModule } from './admin/admin.module';
import { WithdrawalsModule } from './withdrawals/withdrawals.module';
import { StorageModule } from './storage/storage.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { PaymentsModule } from './payments/payments.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigurationModule,
    DatabaseModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),
    WhatsappModule,
    AuthModule,
    OrganizersModule,
    EventsModule,
    RegistrationsModule,
    PaymentsModule,
    AdminModule,
    WithdrawalsModule,
    StorageModule,
  ],
  providers: [
    // Global guards: JWT auth first, then role check
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
