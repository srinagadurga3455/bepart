import { Module } from '@nestjs/common';
import { TicketsRepository } from './tickets.repo';
import { TicketsService } from './tickets.service';
import { CheckinController, TicketsController } from './tickets.controller';

@Module({
  controllers: [TicketsController, CheckinController],
  providers: [TicketsService, TicketsRepository],
  exports: [TicketsService, TicketsRepository],
})
export class TicketsModule {}
