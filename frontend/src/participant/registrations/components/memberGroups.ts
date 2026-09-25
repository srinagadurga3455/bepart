// Helpers for team-based forms where Section 2 member groups are shown
// dynamically from a "number of members" dropdown in an earlier section.
//
// Data-driven convention (no event-specific logic):
// - The count field is the first dropdown whose options are all integers.
// - A member field is any field whose name starts with "member" + digits
//   (e.g. member1Name, member2RegNo); the digits are the 1-based group index.
// - If no count field exists, every field stays visible (legacy behaviour).

export function findCountFieldName(formStructure) {
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
export function getMemberGroupIndex(fieldName) {
  const m = /^member(\d+)/i.exec(String(fieldName || ''));
  return m ? parseInt(m[1], 10) : 0;
}

export function getSelectedCount(values, countFieldName) {
  if (!countFieldName) return Number.POSITIVE_INFINITY;
  const n = parseInt(values?.[countFieldName], 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isFieldVisible(field, selectedCount) {
  const g = getMemberGroupIndex(field?.name);
  if (!g) return true;
  return g <= selectedCount;
}

export function getVisibleFields(section, selectedCount) {
  return (section?.fields || []).filter((f) => isFieldVisible(f, selectedCount));
}

// Visible member-group fields are required once their group is selected,
// even when the seed marks later groups optional (so smaller teams still
// pass backend validation). Non-member fields keep their own flag.
export function withDynamicRequired(field, selectedCount) {
  if (getMemberGroupIndex(field?.name) > 0 && isFieldVisible(field, selectedCount)) {
    return { ...field, required: true };
  }
  return field;
}

// Drop values of member groups beyond the selected count before submit,
// so hidden groups are never validated or stored. Kept values in form
// state are preserved, so re-expanding restores them.
export function stripHiddenMemberValues(formData, selectedCount) {
  const out = { ...(formData || {}) };
  Object.keys(out).forEach((key) => {
    const g = getMemberGroupIndex(key);
    if (g > 0 && g > selectedCount) delete out[key];
  });
  return out;
}
