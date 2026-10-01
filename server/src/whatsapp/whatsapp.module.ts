import { Global, Module } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { MetaWhatsappProvider } from './whatsapp.provider';

@Global()
@Module({
  providers: [WhatsappService, MetaWhatsappProvider],
  exports: [WhatsappService],
})
export class WhatsappModule {}
