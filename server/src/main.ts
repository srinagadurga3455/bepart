import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Security: Helmet headers
  app.use(helmet());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS - production safe: allow APP_URL + FRONTEND_URL + Render domains
  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const allowedOrigins = [
    appUrl,
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
  ].filter(Boolean) as string[];

  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser (no origin) and Razorpay webhook (no origin)
    if (!origin) return callback(null, true);
    // Allow Render subdomains and listed origins
    if (allowedOrigins.includes(origin) || origin.endsWith('.onrender.com') || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    // In production, log but allow if APP_URL is Render
    callback(null, allowedOrigins.length === 0 ? true : false);
  };

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // API prefix
  const apiPrefix = configService.get<string>('API_PREFIX', 'api');
  app.setGlobalPrefix(apiPrefix);

  // Swagger - must be after global prefix; with prefix 'api', docs path 'docs' => /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pravesh API')
    .setDescription('Campus Event Ticketing Platform - Clean Core (Auth, Organizers, Events, Registrations)')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter JWT token' },
      'JWT-auth',
    )
    .addTag('auth', 'Authentication')
    .addTag('organizers', 'Organizer onboarding & approval')
    .addTag('events', 'Event lifecycle')
    .addTag('registrations', 'Student registrations')
    .addTag('admin', 'Admin operations')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // Swagger is not affected by global prefix, so use `${apiPrefix}/docs` to expose at /api/docs (keeps global prefix api for APIs)
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'Pravesh API Docs',
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Pravesh server running on ${appUrl}/${apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`Swagger docs at ${appUrl}/${apiPrefix}/docs`);
}
bootstrap();
