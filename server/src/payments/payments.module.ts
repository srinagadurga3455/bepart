import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repo';
import { CouponsRepository } from '../coupons/coupons.repo';
import { CouponsService } from '../coupons/coupons.service';
import { TicketsModule } from '../tickets/tickets.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [TicketsModule, WhatsappModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, CouponsRepository, CouponsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
