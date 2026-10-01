const DEFAULT_PORT = 587;
const DEFAULT_OTP_LENGTH = 6;
const DEFAULT_OTP_TTL_SEC = 10 * 60; // 10 minutes
const DEFAULT_OTP_MAX_ATTEMPTS = 5;

function getConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || DEFAULT_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const fromName = process.env.SMTP_FROM_NAME || 'Pravesh';

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in server/.env'
    );
  }
  if (!from) {
    throw new Error(
      'SMTP_FROM is required (must be a verified SES / Mail-Manager identity). Set SMTP_FROM in server/.env'
    );
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    fromName,
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    otpLength: Number(process.env.SMTP_OTP_LENGTH || DEFAULT_OTP_LENGTH),
    otpTtlSec: Number(process.env.SMTP_OTP_TTL_SEC || DEFAULT_OTP_TTL_SEC),
    otpMaxAttempts: Number(process.env.SMTP_OTP_MAX_ATTEMPTS || DEFAULT_OTP_MAX_ATTEMPTS),
    // When true, /send-otp echoes the OTP back in the JSON response (dev/testing only).
    otpReturnForTest: String(process.env.SMTP_OTP_RETURN_FOR_TEST || '').toLowerCase() === 'true',
  };
}

function isConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );
}

module.exports = {
  DEFAULT_PORT,
  DEFAULT_OTP_LENGTH,
  DEFAULT_OTP_TTL_SEC,
  DEFAULT_OTP_MAX_ATTEMPTS,
  getConfig,
  isConfigured,
};
