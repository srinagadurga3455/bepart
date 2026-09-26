import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repo';
import { CouponsRepository } from '../coupons/coupons.repo';
import { CouponsService } from '../coupons/coupons.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, CouponsRepository, CouponsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
