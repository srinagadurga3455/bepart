import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repo';
import { EventPolicy } from './policies/event-policy';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [CouponsModule],
  controllers: [EventsController],
  providers: [EventsService, EventsRepository, EventPolicy],
  exports: [EventsService],
})
export class EventsModule {}
