import type { FormDataRecord } from '../types';

// Best-effort display name for a registration, from common answer fields.
// Shared by organizer, participant and ticket views — never hardcoded per page.
export function registrantName(formData: FormDataRecord | null | undefined, fallback = '—'): string {
  if (!formData || typeof formData !== 'object') return fallback;
  const raw: unknown =
    formData.teamName || formData.member1Name || formData.fullName || fallback;
  return typeof raw === 'string' ? raw : fallback;
}
