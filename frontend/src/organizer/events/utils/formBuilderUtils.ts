// Builder-side model <-> stored Event.formStructure conversion.
// Stored format is NEVER extended: sections [{id,title,description?,fields[]}]
// plus member groups expanded to member1..memberN fields. The builder only
// changes how organizers SEE and EDIT that same structure.

import type {
  FormFieldDef,
  FormFieldType,
  FormSectionDef,
  FormStructure,
  FormTheme,
} from '../../../app/types';

/** A stored/builder question with the builder's ephemeral React key. */
export interface BuilderField extends FormFieldDef {
  key: string;
  /** Optional help text shown under the question (persisted, rendered by participants). */
  description?: string;
  /** System participant fields (Name/Phone): fixed stored name, always
   *  required, cannot be deleted. Labels stay editable. */
  system?: 'name' | 'phone';
}

/** Canonical stored names for the two system fields. The ticket flow reads
 *  top-level `phone`, and ticket display prefers `fullName`. */
export const SYSTEM_NAME_FIELD = 'fullName';
export const SYSTEM_PHONE_FIELD = 'phone';

export interface BuilderMemberGroup {
  repeatFrom: string;
  fields: BuilderField[];
}

export interface BuilderSection {
  key: string;
  id: string;
  title: string;
  description: string;
  fields: BuilderField[];
  memberGroup: BuilderMemberGroup | null;
}

export interface BuilderForm {
  title: string;
  description: string;
  sections: BuilderSection[];
  /** Optional visual theme (persisted on the stored formStructure). */
  theme?: FormTheme;
}

export interface RepeatCandidate {
  sectionTitle: string;
  field: BuilderField;
}

export const BUILDER_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Short Answer' },
  { value: 'textarea', label: 'Long Answer' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
];

export const OPTION_TYPES: string[] = ['dropdown', 'radio', 'checkbox'];
export const MAX_MEMBER_GROUPS = 10;

export function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function slugify(label: string | null | undefined, fallback = 'field'): string {
  const words = String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback;
  return words[0] + words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function lowerFirst(s: string): string {
  const t = String(s || '');
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function upperFirst(s: string): string {
  const t = String(s || '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function stripMemberLabel(label: string | null | undefined, n: number): string {
  return String(label || '').replace(new RegExp(`^member\\s*${n}\\s*`, 'i'), '').trim();
}

interface NumericOptionsField {
  type?: string;
  options?: unknown;
}

function isNumericOptions(field: NumericOptionsField | null | undefined): boolean {
  return (
    field?.type === 'dropdown' &&
    Array.isArray(field.options) &&
    field.options.length > 0 &&
    field.options.every((o: unknown) => /^\d+$/.test(String(o).trim()))
  );
}

function groupCountFromField(field: NumericOptionsField): number {
  if (!isNumericOptions(field)) return 0;
  const options = Array.isArray(field?.options) ? field.options : [];
  const nums = options
    .map((o: unknown) => parseInt(String(o).trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return 0;
  return Math.min(MAX_MEMBER_GROUPS, Math.max(...nums));
}

export function emptyField(): BuilderField {
  return { key: newKey(), name: '', label: '', type: 'text', required: true, options: [] };
}

function systemNameField(): BuilderField {
  return {
    key: newKey(), name: SYSTEM_NAME_FIELD, label: 'Name', type: 'text',
    required: true, description: '', options: [], system: 'name',
  };
}

function systemPhoneField(): BuilderField {
  return {
    key: newKey(), name: SYSTEM_PHONE_FIELD, label: 'Phone Number', type: 'tel',
    required: true, description: '', options: [], system: 'phone',
  };
}

/** A fresh form always starts as Section 1 "Participant Details" with the
 *  two required system fields, so organizers never have to create them. */
export function defaultNewForm(): BuilderForm {
  return {
    title: 'Untitled form',
    description: '',
    sections: [{
      key: newKey(),
      id: `section_${Date.now().toString(36)}_0`,
      title: 'Participant Details',
      description: '',
      fields: [systemNameField(), systemPhoneField()],
      memberGroup: null,
    }],
  };
}

export function emptySection(index = 0): BuilderSection {
  return {
    key: newKey(), id: `section_${Date.now().toString(36)}_${index}`, title: '', description: '', fields: [], memberGroup: null,
  };
}

export function emptyMemberGroup(): BuilderMemberGroup {
  return { repeatFrom: '', fields: [{ ...emptyField(), label: 'Name' }, { ...emptyField(), label: 'Registration Number' }, { ...emptyField(), label: 'Branch', type: 'dropdown', options: [] }, { ...emptyField(), label: 'Section', type: 'dropdown', options: [] }] };
}

// Dropdown questions usable as a repeat source: dropdowns in earlier sections
// (or earlier in the same section).
export function findRepeatCandidates(
  builderSections: BuilderSection[],
  sectionIndex: number,
  fieldIndex = Infinity
): RepeatCandidate[] {
  const out: RepeatCandidate[] = [];
  builderSections.forEach((section, si) => {
    (section.fields || []).forEach((field, fi) => {
      if (field.type !== 'dropdown') return;
      if (si > sectionIndex) return;
      if (si === sectionIndex && fi >= fieldIndex) return;
      out.push({ sectionTitle: section.title || `Section ${si + 1}`, field });
    });
  });
  return out;
}

// ---- collapse: stored formStructure -> builder model ----

interface DetectedGroups {
  byN: Map<number, { field: FormFieldDef; suffix: string }[]>;
  maxN: number;
}

function detectMemberGroups(storedFields: FormFieldDef[] | undefined): DetectedGroups | null {
  const byN = new Map<number, { field: FormFieldDef; suffix: string }[]>();
  for (const f of storedFields || []) {
    const m = /^member(\d+)(.+)$/i.exec(String(f?.name || ''));
    if (!m) continue;
    const n = parseInt(m[1], 10);
    let list = byN.get(n);
    if (!list) {
      list = [];
      byN.set(n, list);
    }
    list.push({ field: f, suffix: m[2] });
  }
  if (!byN.has(1)) return null;
  const maxN = Math.max(...byN.keys());
  for (let n = 1; n <= maxN; n++) {
    if (!byN.has(n)) return null; // must be consecutive from 1
  }
  const sig = (list: { suffix: string }[]): string => list.map((x) => x.suffix.toLowerCase()).join('|');
  const first = sig(byN.get(1) || []);
  for (let n = 2; n <= maxN; n++) {
    if (sig(byN.get(n) || []) !== first) return null;
  }
  return { byN, maxN };
}

export function toBuilderForm(formStructure: FormStructure | null | undefined): BuilderForm {
  const storedSections: FormSectionDef[] = formStructure?.sections || [];
  const builderSections: BuilderSection[] = storedSections.map((s) => ({
    key: newKey(),
    id: s.id,
    title: s.title || '',
    description: s.description || '',
    fields: [],
    memberGroup: null,
  }));

  storedSections.forEach((s, si) => {
    const detected = detectMemberGroups(s.fields);
    // regular fields = stored fields not part of the collapsed groups
    const memberNames = new Set<string>();
    if (detected) {
      for (const [, list] of detected.byN) list.forEach(({ field }) => memberNames.add(field.name));
    }
    const regularStored = (s.fields || []).filter((f) => !memberNames.has(f.name));
    if (detected) {
      const groupOne = detected.byN.get(1) || [];
      const baseFields: BuilderField[] = groupOne.map(({ field, suffix }) => ({
        key: newKey(),
        name: lowerFirst(suffix),
        label: stripMemberLabel(field.label, 1) || suffix,
        type: field.type,
        required: !!field.required,
        description: (field as { description?: string }).description || '',
        system: detectSystem(field as { name?: string; type?: string }),
        options: Array.isArray(field.options) ? [...field.options] : [],
      }));
      // find repeat source: first all-numeric dropdown in earlier sections,
      // then in the same section (groups are stored after their section's
      // regular fields, so same-section sources are valid too)
      let repeatFrom = '';
      const pools: FormFieldDef[][] = [];
      for (let pi = 0; pi < si; pi++) pools.push(builderSections[pi].fields || []);
      pools.push(regularStored);
      for (const pool of pools) {
        const cand = pool.find((f) => isNumericOptions(f));
        if (cand) { repeatFrom = cand.name; break; }
      }
      builderSections[si].memberGroup = { repeatFrom, fields: baseFields };
    }
    builderSections[si].fields = (s.fields || [])
      .filter((f) => !memberNames.has(f.name))
      .map((f) => ({
        key: newKey(),
        name: f.name,
        label: f.label || '',
        type: f.type,
        required: f.required !== false,
        description: (f as { description?: string }).description || '',
        system: detectSystem(f as { name?: string; type?: string }),
        options: Array.isArray(f.options) ? [...f.options] : [],
      }));
  });

  return {
    title: formStructure?.title || '',
    description: formStructure?.description || '',
    sections: builderSections,
    theme: formStructure?.theme ? { ...formStructure.theme } : undefined,
  };
}

// ---- expand: builder model -> stored formStructure ----

function cleanOptions(field: NumericOptionsField): string[] {
  const options = Array.isArray(field?.options) ? field.options : [];
  return options.map((o: unknown) => String(o || '').trim()).filter(Boolean);
}

function storedField(name: string, def: BuilderField, required: boolean | undefined): FormFieldDef {
  // System fields keep their canonical stored names and stay required no
  // matter how the label was edited — the ticket flow depends on them.
  const sysName = def.system === 'name' ? SYSTEM_NAME_FIELD : def.system === 'phone' ? SYSTEM_PHONE_FIELD : null;
  const out: FormFieldDef = {
    name: sysName || name,
    label: def.label.trim(),
    type: def.type,
    required: def.system ? true : !!required,
  };
  if (OPTION_TYPES.includes(def.type)) out.options = cleanOptions(def);
  const desc = (def as { description?: string }).description?.trim();
  if (desc) (out as { description?: string }).description = desc;
  return out;
}

/** Reattach system flags when loading a stored form: canonical Name/Phone
 *  fields (by stored name + type) are treated as system fields. */
export function detectSystem(def: { name?: string; type?: string }): 'name' | 'phone' | undefined {
  if ((def.name === SYSTEM_NAME_FIELD || def.name === 'name') && def.type === 'text') return 'name';
  if (def.name === SYSTEM_PHONE_FIELD && def.type === 'tel') return 'phone';
  return undefined;
}

export function toFormStructure(builder: BuilderForm): FormStructure {
  const usedNames = new Set<string>();
  const takeName = (base: string): string => {
    let name = slugify(base, 'field');
    let i = 2;
    while (usedNames.has(name)) {
      name = `${slugify(base, 'field')}_${i}`;
      i += 1;
    }
    usedNames.add(name);
    return name;
  };

  // Pass 1: resolve stable stored names for every regular field first, so a
  // repeat source resolves even for freshly created (unnamed) questions.
  const resolvedNames: string[][] = builder.sections.map((section) =>
    (section.fields || []).map((f) => {
      const name = f.name?.trim() || takeName(f.label);
      usedNames.add(name);
      return name;
    }),
  );

  const sections: FormSectionDef[] = builder.sections.map((section, si) => {
    const fields: FormFieldDef[] = [];
    // regular fields first (repeat sources must exist before member groups)
    (section.fields || []).forEach((f, fi) => {
      fields.push(storedField(resolvedNames[si][fi], f, f.required));
    });
    // expand member group into member1..memberN
    if (section.memberGroup) {
      const g = section.memberGroup;
      const lookup: { def: BuilderField; storedName: string }[] = [];
      builder.sections.forEach((s, idx) => {
        if (idx > si) return;
        (s.fields || []).forEach((f, fi) => {
          lookup.push({ def: f, storedName: resolvedNames[idx][fi] });
        });
      });
      const src = lookup.find((x) => x.storedName === g.repeatFrom)
        || lookup.find((x) => slugify(x.def.label) === g.repeatFrom);
      let count = src ? groupCountFromField({ ...src.def, options: cleanOptions(src.def) }) : 0;
      if (count < 1) count = 1;
      const baseKeys = (g.fields || []).map((f) => ({ key: slugify(f.label, 'member'), def: f }));
      for (let n = 1; n <= count; n++) {
        for (const { key, def } of baseKeys) {
          const suffix = upperFirst(key);
          const name = `member${n}${suffix}`;
          usedNames.add(name);
          // Only group 1 inherits required; later groups stay optional so smaller
          // teams pass backend validation (participant UI enforces them when shown).
          fields.push({
            name,
            label: `Member ${n} ${def.label.trim()}`,
            type: def.type,
            required: n === 1 ? !!def.required : false,
            ...((def as { description?: string }).description?.trim() ? { description: (def as { description?: string }).description!.trim() } : {}),
            ...(OPTION_TYPES.includes(def.type) ? { options: cleanOptions(def) } : {}),
          });
        }
      }
    }
    return {
      id: section.id || `section_${si + 1}`,
      title: section.title.trim(),
      ...(section.description?.trim() ? { description: section.description.trim() } : {}),
      fields,
    };
  });

  return {
    title: builder.title.trim(),
    ...(builder.description?.trim() ? { description: builder.description.trim() } : {}),
    sections,
    ...(builder.theme && Object.keys(builder.theme).length > 0 ? { theme: { ...builder.theme } } : {}),
  };
}

export function validateBuilder(builder: BuilderForm): string[] {
  const errors: string[] = [];
  if (!builder.title.trim()) errors.push('Form title is required.');
  if (builder.sections.length === 0) errors.push('Add at least one section.');
  builder.sections.forEach((section, si) => {
    const label = section.title.trim() || `Section ${si + 1}`;
    if (!section.title.trim()) errors.push(`Section ${si + 1}: title is required.`);
    const hasFields = (section.fields || []).length > 0;
    const hasGroup = !!section.memberGroup && section.memberGroup.fields.length > 0;
    if (!hasFields && !hasGroup) errors.push(`${label}: add at least one question or a team member group.`);
    const checkField = (f: BuilderField, prefix: string): void => {
      if (!f.label.trim()) errors.push(`${label}: ${prefix} question label is required.`);
      if (OPTION_TYPES.includes(f.type) && cleanOptions(f).length === 0) {
        errors.push(`${label}: "${f.label.trim() || 'untitled question'}" needs at least one option.`);
      }
    };
    (section.fields || []).forEach((f) => checkField(f, ''));
    if (section.memberGroup) {
      const group = section.memberGroup;
      if (!group.repeatFrom) errors.push(`${label}: team member group needs a "repeat based on" question.`);
      (group.fields || []).forEach((f) => checkField(f, 'member'));
      // repeat source must resolve to a numeric dropdown
      const lookup: BuilderField[] = [];
      builder.sections.forEach((s, idx) => {
        if (idx > si) return;
        (s.fields || []).forEach((f) => lookup.push(f));
      });
      const src = lookup.find((f) => f.name === group.repeatFrom)
        || lookup.find((f) => slugify(f.label) === group.repeatFrom);
      if (group.repeatFrom && !src) {
        errors.push(`${label}: repeat source not found. Pick a dropdown question from an earlier section.`);
      } else if (src && !isNumericOptions({ ...src, options: cleanOptions(src) })) {
        errors.push(`${label}: repeat source must be a dropdown with numeric options (e.g. 1, 2, 3, 4, 5).`);
      }
    }
  });
  return errors;
}
