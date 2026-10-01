const express = require('express');
const { sendTextMessage, markAsReadWithTyping } = require('./whatsapp.service');
const { record } = require('./usage');

const router = express.Router();

const TYPING_PAUSE_MS = 2000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getWebhookValue(req) {
  return req.body?.entry?.[0]?.changes?.[0]?.value;
}

function buildSupportReply() {
  const supportUrl = process.env.WHATSAPP_SUPPORT_URL || 'https://example.com/support';
  return (
    `Thanks for messaging us! Please contact our support team here ` +
    `to raise any questions: ${supportUrl}`
  );
}

function logIncoming(msg) {
  console.log('Incoming WhatsApp message:', {
    from: msg.from,
    type: msg.type,
    text: msg.text?.body,
    timestamp: msg.timestamp,
  });
}

async function autoReply(msg) {
  if (!msg.from) return;
  try {
    // Blue ticks on sender's message + "typing..." indicator
    if (msg.id) {
      try {
        await markAsReadWithTyping(msg.id);
      } catch (readErr) {
        console.error(`mark-read failed for ${msg.from}:`, readErr.message);
      }
      // Pause so the user actually sees "typing..." before the reply lands
      await delay(TYPING_PAUSE_MS);
    }
    await sendTextMessage(msg.from, buildSupportReply());
    console.log(`Auto-replied to ${msg.from}`);
  } catch (err) {
    // Never break the webhook ack on reply failures
    console.error(`Auto-reply failed for ${msg.from}:`, err.message);
  }
}

// Meta webhook verification:
// GET /webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Receive incoming messages / status updates
// POST /webhook
router.post('/webhook', async (req, res) => {
  console.log('[Webhook] Received event:', JSON.stringify(req.body, null, 2));
  
  const entry = getWebhookValue(req);

  for (const msg of entry?.messages || []) {
    logIncoming(msg);
    if (msg.from) record('received', { from: msg.from });
  }
  for (const msg of entry?.messages || []) {
    await autoReply(msg);
  }

  if (entry?.statuses?.length) {
    console.log('WhatsApp status update:', JSON.stringify(entry.statuses, null, 2));
  }

  // Always ack quickly so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');
});

module.exports = router;
