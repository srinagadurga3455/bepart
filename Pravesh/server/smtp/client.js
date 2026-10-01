const nodemailer = require('nodemailer');
const { getConfig } = require('./config');
const { record } = require('./usage');

let transporter = null;

function normalizeEmail(to) {
  return String(to || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Singleton transporter (mirrors whatsapp client.js being the single place
// that talks to the provider — here the SES / Mail-Manager SMTP endpoint).
function getTransporter() {
  if (transporter) return transporter;

  const { host, port, user, pass, secure } = getConfig();

  transporter = nodemailer.createTransport({
    host,
    port,
    secure, // true for 465, false for 587 (STARTTLS)
    auth: { user, pass },
    // SES SMTP on 587 requires STARTTLS; enforce upgrade when available.
    requireTLS: port === 587,
    tls: { minVersion: 'TLSv1.2' },
  });

  return transporter;
}

function resetTransporter() {
  transporter = null;
}

// Single place that sends mail via SMTP.
async function sendMail({ to, subject, text, html, type = 'custom' }) {
  const cleanTo = normalizeEmail(to);

  if (!cleanTo || !isValidEmail(cleanTo)) {
    throw new Error('"to" must be a valid email address');
  }
  if (!subject) throw new Error('"subject" is required');
  if (!text && !html) throw new Error('either "text" or "html" body is required');

  const { from, fromName } = getConfig();
  const mailOptions = {
    from: fromName ? `"${fromName}" <${from}>` : from,
    to: cleanTo,
    subject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  };

  console.log(`[SMTP] Sending (${type}) to ${cleanTo}:`, subject);

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[SMTP] Sent (${type}) to ${cleanTo}:`, info.messageId);
    record('sent', { type, to: cleanTo });
    return { messageId: info.messageId, accepted: info.accepted, response: info.response };
  } catch (err) {
    record('failed', { type, to: cleanTo });
    throw new Error(`SMTP send failed: ${err.message}`);
  }
}

async function verifyConnection() {
  return getTransporter().verify();
}

module.exports = {
  normalizeEmail,
  isValidEmail,
  getTransporter,
  resetTransporter,
  sendMail,
  verifyConnection,
};
