import { Module } from '@nestjs/common';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsRepository } from './withdrawals.repo';
import { StorageModule } from '../storage/storage.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [StorageModule, WhatsappModule],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService, WithdrawalsRepository],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
