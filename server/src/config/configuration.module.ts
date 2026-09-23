import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
      // Load .env file; never commit .env to git
      envFilePath: ['.env'],
      expandVariables: true,
    }),
  ],
})
export class ConfigurationModule {}
