const { sendMail, normalizeEmail } = require('./client');
const { getConfig } = require('./config');
const { buildOtpEmail } = require('./templates/otpEmail');

// In-memory OTP store: email -> { otp, expiresAt, attempts }.
// NOTE: use Redis/DB for multi-instance deployments.
const otpStore = new Map();

function generateOtp(length) {
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += String(Math.floor(Math.random() * 10));
  }
  return otp;
}

function timingSafeEqual(a, b) {
  const sa = String(a);
  const sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}

async function sendEmail(to, subject, { text, html } = {}) {
  const cleanTo = normalizeEmail(to);
  if (!cleanTo) throw new Error('"to" email is required');
  if (!subject) throw new Error('"subject" is required');

  return sendMail({ to: cleanTo, subject, text, html, type: 'custom' });
}

async function sendOtp(to, options = {}) {
  const cleanTo = normalizeEmail(to);
  if (!cleanTo) throw new Error('"to" email is required');

  const cfg = getConfig();
  const length = Number(options.length || cfg.otpLength);
  const ttlSec = Number(options.expiryMinutes ? options.expiryMinutes * 60 : cfg.otpTtlSec);
  const appName = options.appName || cfg.fromName || 'Pravesh';
  const logoUrl = options.logoUrl || process.env.SMTP_LOGO_URL || undefined;

  const otp = generateOtp(length);
  otpStore.set(cleanTo, {
    otp: String(otp),
    expiresAt: Date.now() + ttlSec * 1000,
    attempts: 0,
  });

  const { subject, text, html } = buildOtpEmail({
    otp,
    appName,
    expiryMinutes: Math.max(1, Math.round(ttlSec / 60)),
    logoUrl,
  });

  console.log(`[SMTP OTP] Generated OTP for ${cleanTo} (expires in ${Math.round(ttlSec / 60)} min)`);

  const result = await sendMail({ to: cleanTo, subject, text, html, type: 'otp' });

  const out = { ...result, expiresInSec: ttlSec };
  // Dev/testing convenience only — never enable in production.
  if (cfg.otpReturnForTest) out.otp = otp;
  return out;
}

function verifyOtp(to, otp) {
  const cleanTo = normalizeEmail(to);
  const maxAttempts = Number(process.env.SMTP_OTP_MAX_ATTEMPTS || 5);
  const entry = otpStore.get(cleanTo);

  if (!entry) return { ok: false, reason: 'no_otp', message: 'No OTP requested for this email' };
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanTo);
    return { ok: false, reason: 'expired', message: 'OTP has expired. Please request a new one.' };
  }

  entry.attempts += 1;
  if (entry.attempts > maxAttempts) {
    otpStore.delete(cleanTo);
    return { ok: false, reason: 'too_many_attempts', message: 'Too many attempts. Please request a new OTP.' };
  }

  if (!timingSafeEqual(entry.otp, String(otp || '').trim())) {
    return {
      ok: false,
      reason: 'mismatch',
      message: 'Invalid OTP',
      attemptsLeft: maxAttempts - entry.attempts,
    };
  }

  otpStore.delete(cleanTo);
  return { ok: true, message: 'OTP verified' };
}

module.exports = { sendEmail, sendOtp, verifyOtp, generateOtp, _otpStore: otpStore };
