// Barrel: single entry point for the WhatsApp module.
const whatsappRoutes = require('./whatsapp.routes');
const webhookRoutes = require('./webhook.routes');

module.exports = { whatsappRoutes, webhookRoutes };
