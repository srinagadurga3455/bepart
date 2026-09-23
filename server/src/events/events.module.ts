import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsRepository } from './events.repo';
import { EventPolicy } from './policies/event-policy';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [EventsController],
  providers: [EventsService, EventsRepository, EventPolicy],
  exports: [EventsService],
})
export class EventsModule {}
