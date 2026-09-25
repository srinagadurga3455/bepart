import type {
  EventItem,
  FormDataRecord,
  RegistrationItem,
  WithdrawalItem,
  WithdrawalStatus,
} from '../../../app/types';

export function registrantName(formData: FormDataRecord | null | undefined, fallback = '—'): string {
  if (!formData || typeof formData !== 'object') return fallback;
  const raw: unknown =
    formData.teamName || formData.member1Name || formData.fullName || fallback;
  return typeof raw === 'string' ? raw : fallback;
}

// Registration fee comes ONLY from the event's own config (no invented pricing).
export function eventFee(event: EventItem | null | undefined): number {
  if (!event?.paymentRequired) return 0;
  const amount = Number(event?.formStructure?.payment?.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export interface EventFinance {
  count: number;
  fee: number;
  collected: number;
}

// Per-event finance derived from existing data: collected = registrations × fee.
export function financeByEvent(
  events: EventItem[],
  registrations: RegistrationItem[]
): Record<number, EventFinance> {
  const counts: Record<number, number> = {};
  (registrations || []).forEach((r) => {
    counts[r.eventId] = (counts[r.eventId] || 0) + 1;
  });
  const map: Record<number, EventFinance> = {};
  (events || []).forEach((e) => {
    const count = counts[e.id] || 0;
    const fee = eventFee(e);
    map[e.id] = { count, fee, collected: count * fee };
  });
  return map;
}

const OPEN_WITHDRAWAL: WithdrawalStatus[] = ['REQUESTED', 'PROCESSING'];

export interface WithdrawalPosition {
  open: WithdrawalItem | null;
  paidTotal: number;
  openTotal: number;
  history: WithdrawalItem[];
}

// Per-event withdrawal position from the organizer's own withdrawal records.
export function withdrawalsByEvent(withdrawals: WithdrawalItem[]): Record<number, WithdrawalPosition> {
  const map: Record<number, WithdrawalPosition> = {};
  (withdrawals || []).forEach((w) => {
    const entry: WithdrawalPosition = (map[w.eventId] =
      map[w.eventId] || { open: null, paidTotal: 0, openTotal: 0, history: [] });
    entry.history.push(w);
    if (w.status === 'PAID') entry.paidTotal += Number(w.amount) || 0;
    else if (OPEN_WITHDRAWAL.includes(w.status)) {
      entry.openTotal += Number(w.amount) || 0;
      if (!entry.open) entry.open = w;
    }
  });
  return map;
}
