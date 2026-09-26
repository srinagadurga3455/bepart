import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Required - Phase 1
  DATABASE_URL: Joi.string().uri().required().description('PostgreSQL connection string'),
  JWT_SECRET: Joi.string().min(16).required().description('JWT signing secret, min 16 chars'),
  JWT_EXPIRES_IN: Joi.string().default('7d').description('JWT expiry e.g. 7d, 1h'),
  PORT: Joi.number().port().default(3000),
  APP_URL: Joi.string().uri().default('http://localhost:3000').description('Public app URL'),

  // Optional with defaults
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PREFIX: Joi.string().default('api'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(10),

  // Optional auth
  JWT_REFRESH_SECRET: Joi.string().allow('').optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  FRONTEND_URL: Joi.string().uri().allow('').optional().description('Frontend/mobile app URL for CORS'),
  STORAGE_PROVIDER: Joi.string().valid('local', 's3').default('local'),
  ADMIN_EMAIL: Joi.string().email({ tlds: { allow: ['local', 'com', 'org', 'net', 'io'] } }).allow('').optional(),
  ADMIN_PASSWORD: Joi.string().allow('').optional(),
  AZURE_STORAGE_CONNECTION_STRING: Joi.string().allow('').optional(),
  AZURE_STORAGE_CONTAINER: Joi.string().default('event-posters'),
  RAZORPAY_KEY_ID: Joi.string().required().description('Razorpay Key ID'),
  RAZORPAY_SECRET: Joi.string().required().description('Razorpay Secret Key'),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().required().description('Razorpay Webhook Secret'),
});

export type EnvConfig = {
  NODE_ENV: string;
  PORT: number;
  API_PREFIX: string;
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  APP_URL: string;
};
