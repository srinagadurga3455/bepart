export function unwrapList(response) {
  const body = response?.data;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

export function formatEventDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function registrantName(formData, fallback = '—') {
  if (!formData || typeof formData !== 'object') return fallback;
  return formData.teamName || formData.member1Name || formData.fullName || fallback;
}

export function formatINR(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '₹0';
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Registration fee comes ONLY from the event's own config (no invented pricing).
export function eventFee(event) {
  if (!event?.paymentRequired) return 0;
  const amount = Number(event?.formStructure?.payment?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

// Per-event finance derived from existing data: collected = registrations × fee.
export function financeByEvent(events, registrations) {
  const counts = {};
  (registrations || []).forEach((r) => {
    counts[r.eventId] = (counts[r.eventId] || 0) + 1;
  });
  const map = {};
  (events || []).forEach((e) => {
    const count = counts[e.id] || 0;
    const fee = eventFee(e);
    map[e.id] = { count, fee, collected: count * fee };
  });
  return map;
}

const OPEN_WITHDRAWAL = ['REQUESTED', 'PROCESSING'];

// Per-event withdrawal position from the organizer's own withdrawal records.
export function withdrawalsByEvent(withdrawals) {
  const map = {};
  (withdrawals || []).forEach((w) => {
    const entry = (map[w.eventId] = map[w.eventId] || { open: null, paidTotal: 0, openTotal: 0, history: [] });
    entry.history.push(w);
    if (w.status === 'PAID') entry.paidTotal += Number(w.amount) || 0;
    else if (OPEN_WITHDRAWAL.includes(w.status)) {
      entry.openTotal += Number(w.amount) || 0;
      if (!entry.open) entry.open = w;
    }
  });
  return map;
}
