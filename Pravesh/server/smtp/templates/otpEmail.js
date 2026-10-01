const REQUIRED_FIELDS = ['to'];

function validateOtpInput(body = {}) {
  const missing = REQUIRED_FIELDS.filter((key) => !body[key]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.to || '').trim())) {
    return '"to" must be a valid email address';
  }
  return null;
}

function buildOtpEmail({ otp, appName = 'Pravesh', expiryMinutes = 10, logoUrl } = {}) {
  const subject = `${otp} is your ${appName} verification code`;
  const text = [
    `Your ${appName} verification code is: ${otp}`,
    ``,
    `This code expires in ${expiryMinutes} minute(s).`,
    `If you did not request this code, you can safely ignore this email.`,
  ].join('\n');

  const logo = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(appName)}" style="max-height: 48px; margin-bottom: 16px;" />`
    : '';

  const html = `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
  ${logo}
  <h2 style="margin: 0 0 8px;">${escapeHtml(appName)} verification code</h2>
  <p style="color: #4b5563; margin: 0 0 16px;">Use the code below to complete verification. It expires in ${expiryMinutes} minute(s).</p>
  <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; text-align: center; padding: 16px; background: #f3f4f6; border-radius: 8px;">${escapeHtml(String(otp))}</div>
  <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">If you did not request this code, you can safely ignore this email.</p>
</div>`.trim();

  return { subject, text, html };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { validateOtpInput, buildOtpEmail };
