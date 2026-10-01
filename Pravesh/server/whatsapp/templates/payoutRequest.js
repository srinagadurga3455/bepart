const { bodyParams, urlButton } = require('../client');

const TEMPLATE_NAME = 'payout_request';
const REQUIRED_FIELDS = ['to', 'amount', 'organizer', 'event', 'requestId'];

function validatePayoutRequest(body = {}) {
  const missing = REQUIRED_FIELDS.filter((key) => !body[key]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

function buildPayoutRequest({ amount, organizer, event, requestId, payoutKey, language = 'en' }) {
  return {
    name: TEMPLATE_NAME,
    languageCode: language,
    components: [
      bodyParams([amount, organizer, event, requestId]),
      urlButton(0, [payoutKey || requestId]),
    ],
  };
}

module.exports = { TEMPLATE_NAME, validatePayoutRequest, buildPayoutRequest };
