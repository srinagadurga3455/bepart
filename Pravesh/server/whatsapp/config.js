const API_BASE = 'https://graph.facebook.com';
const DEFAULT_API_VERSION = 'v26.0';
const DEFAULT_LANGUAGE = 'en_US';

function getConfig() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiVersion = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;

  if (!phoneNumberId || !accessToken) {
    throw new Error(
      'WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in server/.env'
    );
  }

  return { phoneNumberId, accessToken, apiVersion };
}

function isConfigured() {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

module.exports = { API_BASE, DEFAULT_API_VERSION, DEFAULT_LANGUAGE, getConfig, isConfigured };
