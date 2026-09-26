import { Module } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CouponsController } from './coupons.controller';
import { EventCouponsController } from './event-coupons.controller';
import { CouponsRepository } from './coupons.repo';

@Module({
  controllers: [CouponsController, EventCouponsController],
  providers: [CouponsService, CouponsRepository],
  exports: [CouponsService, CouponsRepository],
})
export class CouponsModule {}
