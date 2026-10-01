import { Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { MetaWhatsappProvider } from './whatsapp.provider';

@Module({
  providers: [WhatsappService, MetaWhatsappProvider],
  exports: [WhatsappService],
})
export class WhatsappModule {}
