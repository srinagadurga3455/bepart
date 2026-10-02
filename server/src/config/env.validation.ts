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
  // TEMPORARY test-only OTP logging (Render logs) while SMTP/SES delivery is
  // deferred. Explicitly gated: TEST_OTP_MODE=true + ADMIN_EMAIL match only.
  // Default false = production behavior unchanged. Disable after testing.
  TEST_OTP_MODE: Joi.boolean().truthy('true').falsy('false').default(false),
  AZURE_STORAGE_CONNECTION_STRING: Joi.string().allow('').optional(),
  AZURE_STORAGE_CONTAINER: Joi.string().default('event-posters'),

  // Cloudflare R2 event posters (optional; uploads fall back to mock URLs when unset).
  // R2_ENDPOINT must be account-level with NO bucket suffix:
  // https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_ACCOUNT_ID: Joi.string().allow('').optional(),
  R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  R2_BUCKET_NAME: Joi.string().default('bepart'),
  R2_ENDPOINT: Joi.string().uri().allow('').optional().description('Account-level R2 S3 endpoint, no bucket suffix'),
  R2_PUBLIC_URL: Joi.string().uri().allow('').optional().description('Public base URL serving the R2 bucket (r2.dev or custom domain)'),

  // Razorpay (optional until Razorpay is enabled; required at runtime for order/webhook flows)
  RAZORPAY_KEY_ID: Joi.string().allow('').optional().description('Razorpay Key ID'),
  RAZORPAY_KEY_SECRET: Joi.string().allow('').optional().description('Razorpay Key Secret'),
  RAZORPAY_SECRET: Joi.string().allow('').optional().description('Legacy alias for RAZORPAY_KEY_SECRET'),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').optional().description('Razorpay Webhook Secret'),

  // Amazon SES transactional email (optional; sends are skipped with a warning when unset)
  AWS_REGION: Joi.string().allow('').optional().description('AWS region for SES, e.g. ap-south-1'),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
  SES_FROM_EMAIL: Joi.string().email().allow('').optional().description('Verified SES sender identity'),

  // Meta WhatsApp Cloud API (optional; sends are skipped with a warning when unset;
  // backend only, never exposed to the frontend)
  WHATSAPP_ACCESS_TOKEN: Joi.string().allow('').optional().description('Meta WhatsApp Cloud API access token'),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().allow('').optional().description('Meta WhatsApp phone number ID'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: Joi.string().allow('').optional(),
  WHATSAPP_API_VERSION: Joi.string().default('v26.0').description('Meta Graph API version'),
  WHATSAPP_TEMPLATE_NAME: Joi.string().default('bepart_ticket_confirmation').description('Legacy ticket template name (fallback for WHATSAPP_TICKET_TEMPLATE)'),
  WHATSAPP_TEMPLATE_LANGUAGE: Joi.string().default('en').description('Template language code'),
  // Pravesh template contracts (exact names must be approved in Meta dashboard).
  WHATSAPP_TICKET_TEMPLATE: Joi.string().default('ticket_details').description('Ticket confirmation template (Pravesh ticket_details contract)'),
  WHATSAPP_PAYOUT_REQUEST_TEMPLATE: Joi.string().default('payout_request').description('Payout request template (Pravesh payout_request contract)'),
  WHATSAPP_PAYOUT_SUCCESS_TEMPLATE: Joi.string().default('payout_successful').description('Payout success template (Pravesh payout_successful contract, image header)'),
  WHATSAPP_PAYOUT_REJECT_TEMPLATE: Joi.string().default('payout_rejected').description('Payout rejection template (same body-param convention)'),
  // Fallback admin recipient for payout-request / settlement notifications.
  // Primary source is the database (active Admin/User phones); this is used
  // only when no admin phone is found. Never commit a real number.
  ADMIN_WHATSAPP_NUMBER: Joi.string().allow('').optional().description('Fallback admin WhatsApp recipient (digits, intl format) for settlement/payout alerts'),

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
