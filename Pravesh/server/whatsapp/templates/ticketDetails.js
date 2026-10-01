const { bodyParams, urlButton } = require('../client');

const TEMPLATE_NAME = 'ticket_details';
const REQUIRED_FIELDS = ['to', 'name', 'event', 'date', 'time', 'venue'];

function validateTicketDetails(body = {}) {
  const missing = REQUIRED_FIELDS.filter((key) => !body[key]);
  if (missing.length) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  if (!body.ticketId) {
    return 'Missing required fields: ticketId (for the View My Ticket button)';
  }
  return null;
}

function buildTicketDetails({ name, event, date, time, venue, ticketId, language = 'en' }) {
  return {
    name: TEMPLATE_NAME,
    languageCode: language,
    components: [bodyParams([name, event, date, time, venue]), urlButton(0, [ticketId])],
  };
}

module.exports = { TEMPLATE_NAME, validateTicketDetails, buildTicketDetails };
