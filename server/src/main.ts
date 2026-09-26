import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { appValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true, // Enable raw body for webhook signature verification
  });
  const configService = app.get(ConfigService);

  // Security: Helmet headers
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Serve local uploads as static files: http://localhost:3000/uploads/...
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(appValidationPipe);

  // CORS - production safe: allow APP_URL + FRONTEND_URL
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const allowedOrigins = [
    configService.get<string>('APP_URL', 'http://localhost:3000'),
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
  ].filter(Boolean) as string[];

  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser (no origin) and server-to-server requests
    if (!origin) return callback(null, true);
    // Allow only explicitly configured origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow localhost variants
    if (configService.get('NODE_ENV') === 'development' && origin.startsWith('http://localhost')) {
      return callback(null, true);
    }
    callback(new Error('CORS: Origin not allowed'), false);
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
}
bootstrap();
