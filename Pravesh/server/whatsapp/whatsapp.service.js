const { normalizePhone, postMessage } = require('./client');
const { DEFAULT_LANGUAGE } = require('./config');

async function sendTextMessage(to, body) {
  const cleanTo = normalizePhone(to);

  if (!cleanTo) throw new Error('"to" phone number is required');
  if (!body) throw new Error('"message" text is required');

  return postMessage({ to: cleanTo, type: 'text', text: { body } });
}

async function sendTemplateMessage(to, templateName, options = {}) {
  const cleanTo = normalizePhone(to);

  // options can be a language string ('en_US') or { languageCode, components }
  const { languageCode = DEFAULT_LANGUAGE, components } =
    typeof options === 'string' ? { languageCode: options } : options;

  if (!cleanTo) throw new Error('"to" phone number is required');
  if (!templateName) throw new Error('"template" name is required');

  const template = { name: templateName, language: { code: languageCode } };
  if (components) template.components = components;

  return postMessage({ to: cleanTo, type: 'template', template });
}

// Marks an inbound message as read (blue ticks on sender's phone)
// and shows a "typing..." indicator (dismissed on reply or after ~25s).
async function markAsReadWithTyping(messageId) {
  if (!messageId) throw new Error('"message_id" is required');

  return postMessage({
    status: 'read',
    message_id: messageId,
    typing_indicator: { type: 'text' },
  });
}

module.exports = { sendTextMessage, sendTemplateMessage, markAsReadWithTyping };
