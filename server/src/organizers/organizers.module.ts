import { Module } from '@nestjs/common';
import { OrganizersService } from './organizers.service';
import { OrganizersController } from './organizers.controller';
import { OrganizersRepository } from './organizers.repo';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [OrganizersController],
  providers: [OrganizersService, OrganizersRepository],
  exports: [OrganizersService],
})
export class OrganizersModule {}
