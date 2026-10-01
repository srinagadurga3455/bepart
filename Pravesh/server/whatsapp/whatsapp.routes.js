const express = require('express');
const { sendTextMessage, sendTemplateMessage } = require('./whatsapp.service');
const { isConfigured, DEFAULT_API_VERSION } = require('./config');
const { buildTemplateComponents } = require('./client');
const { asyncHandler } = require('./middleware');
const { validateTicketDetails, buildTicketDetails } = require('./templates/ticketDetails');
const { validatePayoutRequest, buildPayoutRequest } = require('./templates/payoutRequest');
const { validatePayoutSuccessful, buildPayoutSuccessful } = require('./templates/payoutSuccessful');
const { stats } = require('./usage');

const router = express.Router();

// Shared handler for single-template endpoints: validate -> build -> send.
function templateRoute(validate, build) {
  return asyncHandler(async (req, res) => {
    const validationError = validate(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }
    const { name, languageCode, components } = build(req.body);
    const result = await sendTemplateMessage(req.body.to, name, { languageCode, components });
    res.json({ success: true, result });
  });
}

// POST /whatsapp/send  { "to": "9198XXXXXXXX", "message": "hello" }
router.post(
  '/send',
  asyncHandler(async (req, res) => {
    const { to, message } = req.body || {};
    if (!to || !message) {
      return res.status(400).json({ error: '"to" and "message" are required' });
    }
    const result = await sendTextMessage(to, message);
    res.json({ success: true, result });
  })
);

// Generic template sender.
// POST /whatsapp/send-template
// { "to": "9198XXXXXXXX", "template": "name", "language": "en",
//   "bodyVariables": ["a", "b"], "headerDocumentUrl": "https://.../x.pdf",
//   "buttonVariables": ["abc"] }
router.post(
  '/send-template',
  asyncHandler(async (req, res) => {
    const {
      to,
      template,
      language = 'en_US',
      bodyVariables = [],
      headerDocumentUrl,
      headerDocumentId,
      buttonVariables = [],
    } = req.body || {};
    if (!to || !template) {
      return res.status(400).json({ error: '"to" and "template" are required' });
    }

    const components = buildTemplateComponents({
      headerDocumentUrl,
      headerDocumentId,
      bodyVariables,
      buttonVariables,
    });

    const result = await sendTemplateMessage(to, template, {
      languageCode: language,
      components: components.length ? components : undefined,
    });
    res.json({ success: true, result });
  })
);

// POST /whatsapp/send-ticket-details
// { "to": "917569190056", "name": "Arjun", "event": "InnovateX 2026",
//   "date": "25 September 2026", "time": "10:00 AM - 4:00 PM",
//   "venue": "IIT Bombay", "ticketId": "7f3c9e21-...", "language": "en" }
router.post('/send-ticket-details', templateRoute(validateTicketDetails, buildTicketDetails));

// POST /whatsapp/send-payout-request
// { "to": "9198XXXXXXXX", "amount": "1000", "organizer": "Swapanth Vakapalli",
//   "event": "TTD workshop", "requestId": "PAY-1024",
//   "payoutKey": "12345678-...", "language": "en" }
router.post('/send-payout-request', templateRoute(validatePayoutRequest, buildPayoutRequest));

// POST /whatsapp/send-payout-successful
// { "to": "9198XXXXXXXX", "name": "Swapanth", "amount": "199",
//   "transactionId": "618234567891", "imageUrl": "https://.../x.jpg", "language": "en" }
router.post('/send-payout-successful', templateRoute(validatePayoutSuccessful, buildPayoutSuccessful));

// GET /whatsapp/usage — rolling-24h counts vs the messaging limit
router.get('/usage', (req, res) => {
  res.json(stats());
});

// GET /whatsapp/status (never leaks the token)
router.get('/status', (req, res) => {
  res.json({
    configured: isConfigured(),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    apiVersion: process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION,
  });
});

module.exports = router;
