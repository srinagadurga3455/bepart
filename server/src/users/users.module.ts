import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repo';

@Module({
  providers: [UsersRepository],
  exports: [UsersRepository],
})
export class UsersModule {}
