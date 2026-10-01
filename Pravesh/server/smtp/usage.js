// Rolling-window usage tracking for outbound email.
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
    console.error('smtp usage save failed:', err.message);
  }
}

// kind: 'sent' | 'failed'
function record(kind, meta = {}) {
  const events = load();
  events.push({ t: Date.now(), kind, ...meta });
  save(events.filter((e) => e.t >= Date.now() - RETENTION_MS));
}

function stats() {
  const since = Date.now() - DAY_MS;
  const events = load().filter((e) => e.t >= since);

  const sent = events.filter((e) => e.kind === 'sent');

  return {
    window: 'rolling 24h',
    sent: {
      total: sent.length,
      otp: sent.filter((e) => e.type === 'otp').length,
      custom: sent.filter((e) => e.type === 'custom').length,
    },
    failed: events.filter((e) => e.kind === 'failed').length,
    note: 'Tracking started when this feature was added; earlier emails are not counted.',
  };
}

module.exports = { record, stats };
