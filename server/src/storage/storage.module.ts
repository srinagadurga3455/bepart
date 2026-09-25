import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageRepository } from './storage.repo';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [StorageService, StorageRepository],
  exports: [StorageService, StorageRepository],
})
export class StorageModule {}
