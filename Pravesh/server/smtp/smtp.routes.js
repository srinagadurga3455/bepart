const express = require('express');
const { sendEmail, sendOtp, verifyOtp } = require('./smtp.service');
const { isConfigured } = require('./config');
const { verifyConnection } = require('./client');
const { asyncHandler } = require('./middleware');
const { validateOtpInput } = require('./templates/otpEmail');
const { stats } = require('./usage');

const router = express.Router();

// POST /smtp/send  { "to": "user@example.com", "subject": "Hello", "text": "hi", "html": "<p>hi</p>" }
router.post(
  '/send',
  asyncHandler(async (req, res) => {
    const { to, subject, text, message, html } = req.body || {};
    if (!to || !subject || (!text && !message && !html)) {
      return res
        .status(400)
        .json({ error: '"to", "subject" and "text" (or "message"/"html") are required' });
    }
    const result = await sendEmail(to, subject, { text: text || message, html });
    res.json({ success: true, result });
  })
);

// Dedicated OTP sender (generates + stores + emails the code).
// POST /smtp/send-otp
// { "to": "user@example.com", "length": 6, "expiryMinutes": 10, "appName": "Pravesh", "logoUrl": "https://..." }
router.post(
  '/send-otp',
  asyncHandler(async (req, res) => {
    const validationError = validateOtpInput(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const { to, length, expiryMinutes, appName, logoUrl } = req.body || {};
    const result = await sendOtp(to, { length, expiryMinutes, appName, logoUrl });
    res.json({ success: true, to, expiresInSec: result.expiresInSec, result });
  })
);

// POST /smtp/verify-otp  { "to": "user@example.com", "otp": "123456" }
router.post('/verify-otp', (req, res) => {
  const { to, otp } = req.body || {};
  if (!to || !otp) {
    return res.status(400).json({ success: false, error: '"to" and "otp" are required' });
  }
  const outcome = verifyOtp(to, otp);
  if (!outcome.ok) {
    return res.status(400).json({ success: false, ...outcome });
  }
  res.json({ success: true, ...outcome });
});

// GET /smtp/usage — rolling-24h counts
router.get('/usage', (req, res) => {
  res.json(stats());
});

// GET /smtp/status (never leaks the password)
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    let connected = false;
    let connectionError = null;
    if (isConfigured()) {
      try {
        await verifyConnection();
        connected = true;
      } catch (err) {
        connectionError = err.message;
      }
    }
    res.json({
      configured: isConfigured(),
      host: process.env.SMTP_HOST || null,
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || null,
      from: process.env.SMTP_FROM || null,
      connected,
      ...(connectionError ? { connectionError } : {}),
    });
  })
);

module.exports = router;
