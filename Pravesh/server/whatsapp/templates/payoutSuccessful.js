const { bodyParams, imageHeader } = require('../client');

const TEMPLATE_NAME = 'payout_successful';
const REQUIRED_FIELDS = ['to', 'name', 'amount', 'transactionId'];

function validatePayoutSuccessful(body = {}) {
  const missing = REQUIRED_FIELDS.filter((key) => !body[key]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  if (!body.imageUrl && !body.imageId) {
    return 'An image is required: provide "imageUrl" or "imageId" for the image header';
  }
  return null;
}

function buildPayoutSuccessful({ name, amount, transactionId, imageUrl, imageId, language = 'en' }) {
  return {
    name: TEMPLATE_NAME,
    languageCode: language,
    components: [
      imageHeader({ imageUrl, imageId }),
      bodyParams([name, amount, transactionId]),
    ],
  };
}

module.exports = { TEMPLATE_NAME, validatePayoutSuccessful, buildPayoutSuccessful };
