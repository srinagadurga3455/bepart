// Generic display formatting (dates, currency) shared by the admin and
// organizer features. Pure functions; owned by the app layer.
//
// Money convention: the backend stores amounts in Int PAISE (50000 = Rs.500),
// while humans type RUPEES. Use formatPaise() for backend amounts and
// formatINR() for rupee values (event fees, dialog inputs).

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '\u2014';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
