// Rolling-window usage tracking against the Meta messaging limit.
// Persisted to usage.json so counts survive server restarts.
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'usage.json');
const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 7 * DAY_MS;

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(events) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(events));
  } catch (err) {
    console.error('usage save failed:', err.message);
  }
}

// kind: 'sent' | 'received' | 'failed'
function record(kind, meta = {}) {
  const events = load();
  events.push({ t: Date.now(), kind, ...meta });
  save(events.filter((e) => e.t >= Date.now() - RETENTION_MS));
}

function stats() {
  const limit = Number(process.env.MESSAGING_LIMIT || 250);
  const since = Date.now() - DAY_MS;
  const events = load().filter((e) => e.t >= since);

  const sent = events.filter((e) => e.kind === 'sent');
  const templates = sent.filter((e) => e.type === 'template');
  // Limit counts unique users messaged first by the business in 24h (approx).
  const uniqueTemplateRecipients = new Set(templates.map((e) => e.to).filter(Boolean));

  return {
    window: 'rolling 24h',
    limit,
    sent: {
      total: sent.length,
      text: sent.filter((e) => e.type === 'text').length,
      template: templates.length,
    },
    // Approximation of limit consumption (business-initiated conversations).
    limitUsedEstimate: uniqueTemplateRecipients.size,
    limitRemainingEstimate: Math.max(0, limit - uniqueTemplateRecipients.size),
    failed: events.filter((e) => e.kind === 'failed').length,
    received: events.filter((e) => e.kind === 'received').length,
    note: 'Tracking started when this feature was added; earlier messages are not counted.',
  };
}

module.exports = { record, stats };
