// Generic display formatting (dates, currency) shared by the admin and
// organizer features. Pure functions; owned by the app layer.
//
// Money convention: the backend stores amounts in Int PAISE (50000 = Rs.500),
// while humans type RUPEES. Use formatPaise() for backend amounts and
// formatINR() for rupee values (event fees, dialog inputs).

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * An event is completed once its scheduled conducting date/time has passed.
 * Uses the event's `date` field only — never `closingTime` (registration
 * deadline, always earlier). The model has no end time, so the scheduled
 * start instant is the completion cutoff: a currently-happening event stays
 * active until that instant passes. Comparing epoch millis is timezone-safe
 * because both sides are absolute instants. Invalid/missing dates fail open
 * (not completed) so bad data never hides an event.
 */
export function isEventCompleted(
  date: string | Date | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!date) return false;
  const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= nowMs;
}

export function formatINR(n: number | string): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '\u20B90';
  return '\u20B9' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/** Format a backend paise amount (Int) as rupees for display. */
export function formatPaise(n: number | string | null | undefined): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return '\u20B90';
  return formatINR(v / 100);
}

/** Convert a human-entered rupee value to backend paise (Int). */
export function rupeesToPaise(rupees: number | string): number {
  const v = Number(rupees);
  if (!Number.isFinite(v) || v <= 0) throw new Error('Amount must be greater than 0.');
  return Math.round(v * 100);
}

/** Convert a backend paise amount to rupees for math/display inputs. */
export function paiseToRupees(paise: number | string | null | undefined): number {
  const v = Number(paise);
  if (!Number.isFinite(v)) return 0;
  return v / 100;
}
