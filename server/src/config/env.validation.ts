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

  // Razorpay (optional until Razorpay is enabled; required at runtime for order/webhook flows)
  RAZORPAY_KEY_ID: Joi.string().allow('').optional().description('Razorpay Key ID'),
  RAZORPAY_KEY_SECRET: Joi.string().allow('').optional().description('Razorpay Key Secret'),
  RAZORPAY_SECRET: Joi.string().allow('').optional().description('Legacy alias for RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').optional().description('Razorpay Webhook Secret'),

  // WhatsApp ticket confirmations via Meta WhatsApp Cloud API (backend only;
  // never exposed to the frontend). Leave empty until enabled.
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').optional().description('Meta WhatsApp Cloud API access token'),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').optional().description('Meta WhatsApp phone number ID'),
  WHATSAPP_API_VERSION: Joi.string().default('v21.0').description('Meta Graph API version'),
  WHATSAPP_TEMPLATE_NAME: Joi.string().default('bepart_ticket_confirmation').description('Legacy ticket template name (fallback for WHATSAPP_TICKET_TEMPLATE)'),
  WHATSAPP_TEMPLATE_LANGUAGE: Joi.string().default('en').description('Template language code'),
  // Pravesh template contracts (exact names must be approved in Meta dashboard).
  WHATSAPP_TICKET_TEMPLATE: Joi.string().default('ticket_details').description('Ticket confirmation template (Pravesh ticket_details contract)'),
  WHATSAPP_PAYOUT_REQUEST_TEMPLATE: Joi.string().default('payout_request').description('Payout request template (Pravesh payout_request contract)'),
  WHATSAPP_PAYOUT_SUCCESS_TEMPLATE: Joi.string().default('payout_successful').description('Payout success template (Pravesh payout_successful contract, image header)'),
  WHATSAPP_PAYOUT_REJECT_TEMPLATE: Joi.string().default('payout_rejected').description('Payout rejection template (same body-param convention)'),
  // Fallback admin recipient for payout-request notifications. Primary source
  // is the database (active Admin/User phones); this is used only when no
  // admin phone is found. Never commit a real number.
  ADMIN_WHATSAPP_NUMBER: Joi.string().allow('').optional().description('Fallback admin WhatsApp recipient (digits, intl format)'),

  // Gmail/SMTP OTP delivery (Pravesh smtp/ reference; delivery only — OTP
  // generation/verification stays in the OtpVerification table). Leave empty
  // until enabled; never commit real credentials.
  SMTP_HOST: Joi.string().allow('').optional().description('SMTP host (e.g. smtp.gmail.com)'),
  SMTP_PORT: Joi.number().port().default(587).description('SMTP port (587 STARTTLS, 465 implicit TLS)'),
  SMTP_USER: Joi.string().allow('').optional().description('SMTP username'),
  SMTP_PASS: Joi.string().allow('').optional().description('SMTP password / Gmail app password'),
  SMTP_FROM: Joi.string().email().allow('').optional().description('Verified sender email'),
  SMTP_FROM_NAME: Joi.string().default('BePart').description('Sender display name'),
  SMTP_LOGO_URL: Joi.string().uri().allow('').optional().description('Optional logo URL for OTP email'),
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
