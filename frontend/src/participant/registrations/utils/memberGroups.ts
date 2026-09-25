import type { FormDataRecord, FormFieldDef, FormSectionDef, FormStructure } from '../../../app/types';

export function findCountFieldName(
  formStructure: FormStructure | null | undefined
): string | null {
  for (const section of formStructure?.sections || []) {
    for (const field of section.fields || []) {
      if (
        field?.type === 'dropdown' &&
        Array.isArray(field.options) &&
        field.options.length > 0 &&
        field.options.every((o) => /^\d+$/.test(String(o)))
      ) {
        return field.name;
      }
    }
  }
  return null;
}

// 0 = not a member field, otherwise the 1-based group index.
export function getMemberGroupIndex(fieldName: string | null | undefined): number {
  const m = /^member(\d+)/i.exec(String(fieldName || ''));
  return m ? parseInt(m[1], 10) : 0;
}

export function getSelectedCount(
  values: FormDataRecord | null | undefined,
  countFieldName: string | null | undefined
): number {
  if (!countFieldName) return Number.POSITIVE_INFINITY;
  const n = parseInt(String(values?.[countFieldName] ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isFieldVisible(
  field: FormFieldDef | null | undefined,
  selectedCount: number
): boolean {
  const g = getMemberGroupIndex(field?.name);
  if (!g) return true;
  return g <= selectedCount;
}

export function getVisibleFields(
  section: FormSectionDef | null | undefined,
  selectedCount: number
): FormFieldDef[] {
  return (section?.fields || []).filter((f) => isFieldVisible(f, selectedCount));
}

// Visible member-group fields are required once their group is selected,
// even when the seed marks later groups optional (so smaller teams still
// pass backend validation). Non-member fields keep their own flag.
export function withDynamicRequired(field: FormFieldDef, selectedCount: number): FormFieldDef {
  if (getMemberGroupIndex(field?.name) > 0 && isFieldVisible(field, selectedCount)) {
    return { ...field, required: true };
  }
  return field;
}

// Drop values of member groups beyond the selected count before submit,
// so hidden groups are never validated or stored. Kept values in form
// state are preserved, so re-expanding restores them.
export function stripHiddenMemberValues(
  formData: FormDataRecord | null | undefined,
  selectedCount: number
): FormDataRecord {
  const out: FormDataRecord = { ...(formData || {}) };
  Object.keys(out).forEach((key) => {
    const g = getMemberGroupIndex(key);
    if (g > 0 && g > selectedCount) delete out[key];
  });
  return out;
}
