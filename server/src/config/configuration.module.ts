import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './env.validation';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      // Load .env file from server root; never commit .env to git
      envFilePath: [envPath],
      expandVariables: true,
    }),
  ],
})
export class ConfigurationModule {}
