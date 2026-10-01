import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  Alert, Box, Button, Divider, Drawer, FormControl, IconButton, InputLabel, List, ListItemButton,
  Menu, MenuItem, Select, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add, ArrowBack, ArrowDownward, ArrowUpward, CheckCircleOutlined, Delete,
  GroupAdd, InfoOutlined, PreviewOutlined, SaveOutlined, SettingsOutlined, ViewAgenda,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import QuestionCard, { TYPE_META } from './QuestionCard';
import QuestionInspector from './QuestionInspector';
import MemberGroupCard from './MemberGroupCard';
import FormSettingsPanel from './FormSettingsPanel';
import {
  emptyField, emptySection, emptyMemberGroup, newKey, slugify, defaultNewForm,
  findRepeatCandidates, toFormStructure, validateBuilder,
  OPTION_TYPES,
} from '../utils/formBuilderUtils';
import type {
  BuilderField,
  BuilderForm,
  BuilderSection,
} from '../utils/formBuilderUtils';
import type { FormFieldType, FormSettings, FormStructure } from '../../../app/types';
import { StyleControls } from './BuilderStylePanel';

// Add-question menu grouped by category. Only types the backend supports —
// no Number/Date (the validator rejects them).
const TYPE_GROUPS: { heading: string; types: FormFieldType[] }[] = [
  { heading: 'Basic', types: ['text', 'textarea'] },
  { heading: 'Choice', types: ['radio', 'checkbox', 'dropdown'] },
  { heading: 'Contact', types: ['tel', 'email'] },
];
import { BePartMark } from '../../../app/components/BePartBrand';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import EmptyState from '../../../app/components/EmptyState';

type Selection =
  | { kind: 'title' }
  | { kind: 'section' | 'group' | 'question' | 'member'; key: string };

interface ErrorMap {
  title: string | null;
  sections: Record<number, string>;
  questions: Record<string, string>;
  groups: Record<number, string>;
}

interface FieldRef {
  si: number;
  kind: 'q' | 'm';
  key: string;
  label: string;
}

function buildErrorMap(errors: string[], builder: BuilderForm): ErrorMap {
  const map: ErrorMap = { title: null, sections: {}, questions: {}, groups: {} };
  const allFields: FieldRef[] = [];
  builder.sections.forEach((s, si) => {
    (s.fields || []).forEach((f) => allFields.push({ si, kind: 'q', key: f.key, label: (f.label || '').trim() }));
    (s.memberGroup?.fields || []).forEach((f) => allFields.push({ si, kind: 'm', key: f.key, label: (f.label || '').trim() }));
  });
  errors.forEach((msg) => {
    if (msg.startsWith('Form title')) {
      map.title = map.title || msg;
      return;
    }
    let si = -1;
    const secMatch = /^Section (\d+):/.exec(msg);
    if (secMatch) si = parseInt(secMatch[1], 10) - 1;
    if (si < 0) {
      const idx = builder.sections.findIndex((s) => s.title.trim() && msg.startsWith(`${s.title.trim()}:`));
      if (idx >= 0) si = idx;
    }
    if (si < 0 || si >= builder.sections.length) return;
    map.sections[si] = map.sections[si] || msg;
    if (msg.includes('question label is required')) {
      const memberOnly = msg.includes('member question label');
      allFields
        .filter((f) => f.si === si && !f.label && (memberOnly ? f.kind === 'm' : f.kind === 'q'))
        .forEach((f) => { map.questions[f.key] = map.questions[f.key] || msg; });
      return;
    }
    const quoted = /"([^"]+)"/.exec(msg)?.[1];
    if (quoted) {
      const hit = allFields.find((f) => f.si === si && f.label === quoted);
      if (hit) {
        map.questions[hit.key] = map.questions[hit.key] || msg;
        return;
      }
    }
    if (/repeat|member group/i.test(msg)) {
      map.groups[si] = map.groups[si] || msg;
    }
  });
  return map;
}

function normalizeInitial(initial: BuilderForm | null | undefined): BuilderForm {
  // A brand-new form starts as Section 1 "Participant Details" with the two
  // required system fields (Name + Phone Number) already in place.
  if (!initial?.sections?.length) return defaultNewForm();
  const base: BuilderForm = {
    title: initial?.title?.trim() ? initial.title : 'Untitled form',
    description: initial?.description || '',
    sections: initial.sections,
    theme: initial.theme,
  };
  return base;
}

interface FormBuilderProps {
  initial: BuilderForm | null | undefined;
  onSave: (structure: FormStructure) => void;
  saving: boolean;
  onBack?: () => void;
  /** Called when organizer clicks "Change template" — opens the chooser again. */
  onChangeTemplate?: () => void;
  /** Live draft sync: lets the parent preserve edits across Back/forward navigation. */
  onChange?: (draft: BuilderForm) => void;
}

interface FoundField {
  si: number;
  fi: number;
  field: BuilderField;
}

interface DeleteTarget {
  kind: 'question' | 'member' | 'section' | 'group';
  si: number;
  fi?: number;
  label: string;
}

export default function FormBuilder({ initial, onSave, saving, onBack, onChangeTemplate, onChange }: FormBuilderProps) {
  const [builder, setBuilderState] = useState<BuilderForm>(() => normalizeInitial(initial));
  // Keep the parent's draft in sync (local state only — no API calls here) so
  // remounts from Back/forward navigation restore every edit.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  useEffect(() => {
    onChangeRef.current?.(builder);
  }, [builder]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuSection, setMenuSection] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveRequested, setSaveRequested] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [propsOpen, setPropsOpen] = useState(false);
  // 'style' | 'settings' tab in the right panel
  const [rightTab, setRightTab] = useState<'style' | 'settings'>('style');
  // Active tab while an item is selected: 'properties' (inspector) plus the
  // always-visible 'style' | 'settings'. Tab switches never touch `selected`.
  const [selTab, setSelTab] = useState<'properties' | 'style' | 'settings'>('properties');
  // Add-actions (add/duplicate question, section, group…) keep the organizer
  // on their current tab so Style/Settings content is never hidden by the
  // auto-selection of the new item. Plain clicks still open Properties.
  const keepTabRef = useRef(false);
  const selectKeepTab = (sel: Selection) => {
    keepTabRef.current = true;
    setSelected(sel);
  };
  const { enqueueSnackbar } = useSnackbar();

  const errorMap = buildErrorMap(errors, builder);

  // Dirty tracking: every mutation marks unsaved changes.
  const setBuilder = (next: BuilderForm) => {
    setBuilderState(next);
    setDirty(true);
  };

  const updateSettings = (settings: FormSettings) => {
    setBuilder({ ...builder, settings });
  };

  // Honest save indicator: "Saving…" while parent works, "All changes saved"
  // once its saving run completes after we requested a save.
  const prevSaving = useRef(saving);
  useEffect(() => {
    if (prevSaving.current && !saving && saveRequested) {
      setSaveRequested(false);
      setDirty(false);
      setSavedAt(new Date());
    }
    prevSaving.current = saving;
  }, [saving, saveRequested]);

  const findSectionIdx = (key: string): number => builder.sections.findIndex((s) => s.key === key);
  const findQuestion = (key: string): FoundField | null => {
    for (let si = 0; si < builder.sections.length; si++) {
      const fi = (builder.sections[si].fields || []).findIndex((f) => f.key === key);
      if (fi >= 0) return { si, fi, field: builder.sections[si].fields[fi] };
    }
    return null;
  };
  const findMember = (key: string): FoundField | null => {
    for (let si = 0; si < builder.sections.length; si++) {
      const fields = builder.sections[si].memberGroup?.fields || [];
      const fi = fields.findIndex((f) => f.key === key);
      if (fi >= 0) return { si, fi, field: fields[fi] };
    }
    return null;
  };

  const targetSi = (() => {
    if (!selected) return builder.sections.length - 1;
    if (selected.kind === 'section' || selected.kind === 'group') {
      const idx = findSectionIdx(selected.key);
      return idx >= 0 ? idx : builder.sections.length - 1;
    }
    if (selected.kind === 'question') {
      const hit = findQuestion(selected.key);
      return hit ? hit.si : builder.sections.length - 1;
    }
    if (selected.kind === 'member') {
      const hit = findMember(selected.key);
      return hit ? hit.si : builder.sections.length - 1;
    }
    return builder.sections.length - 1;
  })();

  const updateSection = (idx: number, patch: Partial<BuilderSection>) => {
    const sections = [...builder.sections];
    sections[idx] = { ...sections[idx], ...patch };
    setBuilder({ ...builder, sections });
  };

  const moveSection = (idx: number, dir: number) => {
    const sections = [...builder.sections];
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    [sections[idx], sections[j]] = [sections[j], sections[idx]];
    setBuilder({ ...builder, sections });
  };

  const removeSection = (idx: number) => {
    setBuilder({ ...builder, sections: builder.sections.filter((_, i) => i !== idx) });
    setSelected(null);
  };

  const updateField = (si: number, fi: number, updated: BuilderField) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].fields];
    fields[fi] = updated;
    sections[si] = { ...sections[si], fields };
    setBuilder({ ...builder, sections });
  };

  const insertField = (si: number, fi: number, field: BuilderField) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].fields];
    fields.splice(fi, 0, field);
    sections[si] = { ...sections[si], fields };
    setBuilder({ ...builder, sections });
  };

  const moveField = (si: number, fi: number, dir: number) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].fields];
    const j = fi + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[fi], fields[j]] = [fields[j], fields[fi]];
    sections[si] = { ...sections[si], fields };
    setBuilder({ ...builder, sections });
  };

  const removeField = (si: number, fi: number) => {
    const sections = [...builder.sections];
    sections[si] = { ...sections[si], fields: sections[si].fields.filter((_, i) => i !== fi) };
    setBuilder({ ...builder, sections });
    setSelected(null);
  };

  const duplicateField = (si: number, fi: number) => {
    const src = builder.sections[si].fields[fi];
    // A duplicate is a fresh regular question: never inherit the system lock
    // or the canonical stored name, or two fields would collide on save.
    const copy: BuilderField = { ...src, key: newKey(), name: '', system: undefined, options: [...(src.options || [])] };
    insertField(si, fi + 1, copy);
    selectKeepTab({ kind: 'question', key: copy.key });
    setFocusKey(copy.key);
    enqueueSnackbar('Question duplicated.', { variant: 'success' });
  };

  const ensureSection = (): BuilderForm => {
    if (builder.sections.length > 0) return builder;
    const section = emptySection(0);
    const next = { ...builder, sections: [section] };
    setBuilder(next);
    return next;
  };

  const addQuestion = (si: number = targetSi, type: FormFieldType = 'text') => {
    const base = ensureSection();
    const idx = si >= 0 && si < base.sections.length ? si : base.sections.length - 1;
    const field: BuilderField = { ...emptyField(), key: newKey(), type, options: OPTION_TYPES.includes(type) ? ['Option 1'] : [] };
    const sections = [...base.sections];
    sections[idx] = { ...sections[idx], fields: [...(sections[idx].fields || []), field] };
    setBuilder({ ...base, sections });
    selectKeepTab({ kind: 'question', key: field.key });
    setFocusKey(field.key);
    requestAnimationFrame(() => {
      document.querySelector(`[data-card-key="q:${field.key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  // On small screens the inspector is a bottom sheet — open it shortly after
  // the organizer picks something to edit. No-op on desktop (sheet hidden).
  useEffect(() => {
    if (!selected || typeof window === 'undefined' || window.innerWidth >= 1280) return;
    const t = window.setTimeout(() => setPropsOpen(true), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const addGroup = (si: number = targetSi) => {
    const base = ensureSection();
    const idx = si >= 0 && si < base.sections.length ? si : base.sections.length - 1;
    if (base.sections[idx].memberGroup) {
      selectKeepTab({ kind: 'group', key: base.sections[idx].key });
      return;
    }
    const sections = [...base.sections];
    sections[idx] = { ...sections[idx], memberGroup: emptyMemberGroup() };
    setBuilder({ ...base, sections });
    selectKeepTab({ kind: 'group', key: sections[idx].key });
    requestAnimationFrame(() => {
      document.querySelector(`[data-card-key="g:${sections[idx].key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const removeGroup = (si: number) => {
    updateSection(si, { memberGroup: null });
    setSelected(null);
  };

  const updateMemberField = (si: number, fi: number, updated: BuilderField) => {
    const sections = [...builder.sections];
    const fields = [...(sections[si].memberGroup?.fields || [])];
    fields[fi] = updated;
    sections[si] = { ...sections[si], memberGroup: { ...sections[si].memberGroup!, fields } };
    setBuilder({ ...builder, sections });
  };

  const duplicateMemberField = (si: number, fi: number) => {
    const src = builder.sections[si].memberGroup!.fields[fi];
    const copy: BuilderField = { ...src, key: newKey(), name: '', system: undefined, options: [...(src.options || [])] };
    const sections = [...builder.sections];
    const fields = [...sections[si].memberGroup!.fields];
    fields.splice(fi + 1, 0, copy);
    sections[si] = { ...sections[si], memberGroup: { ...sections[si].memberGroup!, fields } };
    setBuilder({ ...builder, sections });
    selectKeepTab({ kind: 'member', key: copy.key });
    setFocusKey(copy.key);
    enqueueSnackbar('Question duplicated.', { variant: 'success' });
  };

  const removeMemberField = (si: number, fi: number) => {
    const sections = [...builder.sections];
    sections[si] = {
      ...sections[si],
      memberGroup: {
        ...sections[si].memberGroup!,
        fields: sections[si].memberGroup!.fields.filter((_, i) => i !== fi),
      },
    };
    setBuilder({ ...builder, sections });
    selectKeepTab({ kind: 'group', key: sections[si].key });
  };

  const moveMemberField = (si: number, fi: number, dir: number) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].memberGroup!.fields];
    const j = fi + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[fi], fields[j]] = [fields[j], fields[fi]];
    sections[si] = { ...sections[si], memberGroup: { ...sections[si].memberGroup!, fields } };
    setBuilder({ ...builder, sections });
  };

  const addSection = () => {
    const section = emptySection(builder.sections.length);
    setBuilder({ ...builder, sections: [...builder.sections, section] });
    selectKeepTab({ kind: 'section', key: section.key });
    setFocusKey(section.key);
    requestAnimationFrame(() => {
      document.getElementById(`builder-section-${builder.sections.length}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const confirmDelete = () => {
    const t = deleteTarget;
    if (!t) return;
    if (t.kind === 'question' && t.fi !== undefined) removeField(t.si, t.fi);
    else if (t.kind === 'member' && t.fi !== undefined) removeMemberField(t.si, t.fi);
    else if (t.kind === 'section') removeSection(t.si);
    else if (t.kind === 'group') removeGroup(t.si);
    setDeleteTarget(null);
  };

  const build = (): FormStructure | null => {
    const errs = validateBuilder(builder);
    setErrors(errs);
    if (errs.length > 0) return null;
    return toFormStructure(builder);
  };

  const handleSave = () => {
    const structure = build();
    if (structure) {
      setSaveRequested(true);
      onSave(structure);
    }
  };

  const openAddMenu = (e: ReactMouseEvent<HTMLElement>, si?: number) => {
    setMenuSection(si ?? targetSi);
    setMenuAnchor(e.currentTarget);
  };
  const closeAddMenu = () => {
    setMenuAnchor(null);
    setMenuSection(null);
  };
  const menuAddQuestion = (type: FormFieldType) => {
    const si = menuSection ?? targetSi;
    closeAddMenu();
    addQuestion(si, type);
  };

  const scrollToSection = (si: number) => {
    document.getElementById(`builder-section-${si}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const titleActive = !selected || selected.kind === 'title' || !builder.title.trim() || errorMap.title;

  // ---- properties panel content (keyed wrapper below fades on switch) ----
  const panelKey = !selected || selected.kind === 'title'
    ? 'form'
    : selected.kind === 'section' || selected.kind === 'group'
      ? `s:${selected.key}`
      : `q:${selected.key}`;
  // The Properties tab only applies to a real item selection (the form title
  // has no inspector). Track the selected item id so a NEW selection opens
  // Properties (existing workflow) while tab switches never clear it.
  const hasItemSelected = !!selected && selected.kind !== 'title';
  const selectedId = hasItemSelected ? panelKey : null;
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedId) {
      prevSelectedIdRef.current = null;
      return;
    }
    if (selectedId !== prevSelectedIdRef.current) {
      if (keepTabRef.current) keepTabRef.current = false;
      else setSelTab('properties');
      prevSelectedIdRef.current = selectedId;
    }
  }, [selectedId]);
  const selectedQuestion = selected?.kind === 'question' ? findQuestion(selected.key) : null;
  const selectedMember = selected?.kind === 'member' ? findMember(selected.key) : null;
  const selectedSectionIdx = selected && (selected.kind === 'section' || selected.kind === 'group')
    ? findSectionIdx(selected.key)
    : -1;

  // Inspector branches render for a selection; `styleOnly` skips straight to
  // the Style controls (Typography, Theme, header image) so the Style tab can
  // render them without depending on — or disturbing — the selection.
  const renderProperties = (styleOnly = false) => {
    if (!styleOnly) {
    if (selectedQuestion) {
      const { si, fi, field } = selectedQuestion;
      return (
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
            QUESTION
          </Typography>
          <QuestionInspector
            field={field}
            onChange={(updated) => updateField(si, fi, updated)}
            onDelete={() => setDeleteTarget({ kind: 'question', si, fi, label: field.label || 'Untitled question' })}
            onDuplicate={() => duplicateField(si, fi)}
          />
        </Box>
      );
    }
    if (selectedMember) {
      const { si, fi, field } = selectedMember;
      return (
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
            TEAM MEMBER FIELD
          </Typography>
          <QuestionInspector
            field={field}
            onChange={(updated) => updateMemberField(si, fi, updated)}
            onDelete={() => setDeleteTarget({ kind: 'member', si, fi, label: field.label || 'Untitled question' })}
            onDuplicate={() => duplicateMemberField(si, fi)}
            deleteLabel="Delete field"
          />
        </Box>
      );
    }
    if (selected?.kind === 'group') {
      const gsi = findSectionIdx(selected.key);
      const sec = gsi >= 0 ? builder.sections[gsi] : null;
      const group = sec?.memberGroup;
      if (!sec || !group) {
        return (
          <Box>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
              TEAM MEMBERS
            </Typography>
            <Typography variant="body2" color="text.secondary">This group no longer exists.</Typography>
          </Box>
        );
      }
      const candidates = findRepeatCandidates(builder.sections, gsi).map((c) => ({
        ...c,
        value: c.field.name?.trim() || slugify(c.field.label),
      }));
      return (
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
            TEAM MEMBERS
          </Typography>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>Team member group</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mb: 2, lineHeight: 1.6 }}>
            Defined once here — participants automatically see one set per team member they select.
          </Typography>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.secondary', mb: 1 }}>
            NUMBER OF MEMBERS
          </Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Repeat based on</InputLabel>
            <Select
              label="Repeat based on"
              value={group.repeatFrom || ''}
              onChange={(e) => updateSection(gsi, { memberGroup: { ...group, repeatFrom: e.target.value } })}
              displayEmpty
            >
              <MenuItem value="" disabled>
                <Typography component="span" color="text.secondary" sx={{ fontSize: 13.5 }}>
                  Number question (e.g. Number of Team Members)
                </Typography>
              </MenuItem>
              {candidates.map((c) => (
                <MenuItem key={`${c.sectionTitle}-${c.field.label}`} value={c.value} sx={{ fontSize: 13.5 }}>
                  {c.field.label} ({c.sectionTitle})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: 'text.secondary', mb: 1 }}>
            MEMBER FIELDS ({group.fields.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: 2 }}>
            {group.fields.map((f) => (
              <Box
                key={f.key}
                onClick={() => setSelected({ kind: 'member', key: f.key })}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1, border: '1px solid', borderColor: 'divider',
                  borderRadius: 2, px: 1.5, py: 1, cursor: 'pointer', '&:hover': { borderColor: 'text.disabled' },
                }}
              >
                <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0 }}>
                  {f.label?.trim() || 'Untitled question'}
                </Typography>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
                  {TYPE_META[f.type]?.label || f.type}
                </Typography>
              </Box>
            ))}
          </Box>
          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<Add fontSize="small" />}
            onClick={() => {
              const f = { ...emptyField(), key: newKey() };
              updateSection(gsi, { memberGroup: { ...group, fields: [...group.fields, f] } });
              selectKeepTab({ kind: 'member', key: f.key });
              setFocusKey(f.key);
            }}
          >
            Add member field
          </Button>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 2, p: 1.5, bgcolor: '#FEF2F2' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'error.main', mb: 1 }}>
              DANGER ZONE
            </Typography>
            <Button fullWidth variant="outlined" size="small" startIcon={<Delete fontSize="small" />} color="error"
              onClick={() => setDeleteTarget({ kind: 'group', si: gsi, label: 'Team member group' })}>
              Remove group
            </Button>
          </Box>
        </Box>
      );
    }
    if (selectedSectionIdx >= 0 && selected?.kind === 'section') {
      const sec = builder.sections[selectedSectionIdx];
      return (
        <Box>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
            SECTION
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
            CONTENT
          </Typography>
          <TextField label="Section title" value={sec.title} onChange={(e) => updateSection(selectedSectionIdx, { title: e.target.value })}
            fullWidth size="small" sx={{ mb: 2 }} />
          <TextField label="Description" value={sec.description || ''} onChange={(e) => updateSection(selectedSectionIdx, { description: e.target.value })}
            fullWidth size="small" multiline rows={2} sx={{ mb: 1 }} />
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
            POSITION
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Button fullWidth variant="outlined" size="small" startIcon={<ArrowUpward fontSize="small" />}
              disabled={selectedSectionIdx === 0} onClick={() => moveSection(selectedSectionIdx, -1)}>
              Move Up
            </Button>
            <Button fullWidth variant="outlined" size="small" startIcon={<ArrowDownward fontSize="small" />}
              disabled={selectedSectionIdx === builder.sections.length - 1} onClick={() => moveSection(selectedSectionIdx, 1)}>
              Move Down
            </Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 2, p: 1.5, bgcolor: '#FEF2F2' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'error.main', mb: 1 }}>
              DANGER ZONE
            </Typography>
            <Button fullWidth variant="outlined" size="small" startIcon={<Delete fontSize="small" />} color="error"
              onClick={() => setDeleteTarget({ kind: 'section', si: selectedSectionIdx, label: sec.title || `Section ${selectedSectionIdx + 1}` })}>
              Delete section
            </Button>
          </Box>
        </Box>
      );
    }
    }
  // Style tab: shared component (also used on Preview & Publish) bound to the
  // same builder theme — one source of truth, never duplicated or reset.
  return (
    <StyleControls
      theme={builder.theme}
      onThemeChange={(patch) => setBuilder({ ...builder, theme: { ...(builder.theme || {}), ...patch } })}
    />
  );
  };

  // Right-panel tab state: with an item selected the organizer gets
  // Properties (+ Style + Settings); otherwise Style + Settings. Every tab
  // reads the same `builder` state, so adding/editing/deleting questions can
  // never hide or reset another tab's content.
  const activeTab = hasItemSelected ? selTab : rightTab;
  const handlePanelTab = (_e: unknown, v: 'properties' | 'style' | 'settings' | null) => {
    if (!v) return;
    if (hasItemSelected) setSelTab(v);
    else if (v !== 'properties') setRightTab(v);
  };
  const renderPanelContent = () => {
    if (activeTab === 'properties' && hasItemSelected) return renderProperties();
    if (activeTab === 'settings') {
      return (
        <FormSettingsPanel
          settings={builder.settings || {}}
          onChange={updateSettings}
        />
      );
    }
    return renderProperties(true);
  };

  // Editor container: Header / Main content / Bottom navigation. The container
  // fills the viewport below the sticky topbar + step breadcrumb so Main gets
  // a bounded flex area (required for independent column scrolls). Bottom
  // navigation is a direct child here — outside every scroll region.
  return (
    <Box sx={{
      bgcolor: '#F7F8FA', borderRadius: 3, border: '1px solid', borderColor: '#ECEEF4',
      display: 'flex', flexDirection: 'column',
      height: { xs: 'auto', lg: 'calc(100vh - 140px)' },
      minHeight: 480,
    }}>
      {/* ── Top bar: title + template + save status only. Navigation lives in
          the bottom bar ([Back] [Preview]) to avoid duplicate actions. ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2 }, py: 1, bgcolor: '#fff', borderBottom: '1px solid', borderColor: '#ECEEF4', position: 'sticky', top: 0, zIndex: 5, flexWrap: 'wrap' }}>
        <BePartMark size={26} fontSize={15} />
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, ml: 0.5, maxWidth: { xs: 120, sm: 280 } }}>
          {builder.title.trim() || 'Create Form'}
        </Typography>
        {onChangeTemplate && (
          <Tooltip title="Pick a different template — your current questions will be replaced">
            <Button
              size="small"
              variant="outlined"
              onClick={onChangeTemplate}
              sx={{ fontSize: 11, fontWeight: 700, borderRadius: 999, px: 1.5, py: 0.5, ml: 0.5, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Change template
            </Button>
          </Tooltip>
        )}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 12, color: saving ? 'primary.main' : dirty ? 'warning.main' : 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75, mr: 0.5 }}>
            {saving ? (
              <><SaveOutlined sx={{ fontSize: 14 }} /> Saving…</>
            ) : dirty ? (
              <><SaveOutlined sx={{ fontSize: 14 }} /> Unsaved changes</>
            ) : (
              <><CheckCircleOutlined sx={{ fontSize: 14, color: 'success.main' }} /> {savedAt ? 'All changes saved' : 'Saved'}</>
            )}
          </Typography>
          <Tooltip title="Form settings">
            <IconButton size="small" aria-label="Open form settings" onClick={() => { setRightTab('settings'); setSelTab('settings'); setPropsOpen(true); }} sx={{ display: { xs: 'inline-flex', lg: 'none' } }}>
              <SettingsOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Main content: Sections sidebar | scrollable question editor |
          scrollable Properties/Style/Settings sidebar. Flexes to fill the
          container; each column scrolls internally instead of clipping. ── */}
      <Box sx={{
        display: 'flex', alignItems: 'stretch',
        flex: { xs: 'none', lg: 1 }, minHeight: 0,
      }}>
        {/* ── Left nav ── */}
        <Box sx={{
          width: 224, flexShrink: 0, bgcolor: '#fff', borderRight: '1px solid', borderColor: '#ECEEF4',
          p: 1.5, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5,
          minHeight: 0, height: { xs: 'auto', lg: '100%' }, overflowY: { xs: 'visible', lg: 'auto' },
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'text.secondary', px: 1, mb: 0.5 }}>
            SECTIONS
          </Typography>
          <List dense disablePadding>
            {builder.sections.map((s, si) => {
              const qCount = (s.fields || []).length + (s.memberGroup ? s.memberGroup.fields.length : 0);
              return (
                <ListItemButton
                  key={s.key}
                  selected={selected?.kind === 'section' && selected.key === s.key}
                  onClick={() => { setSelected({ kind: 'section', key: s.key }); scrollToSection(si); }}
                  sx={{ borderRadius: 2, mb: 0.25, py: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13 }}>
                      <Box component="span" sx={{ color: 'text.secondary', fontWeight: 700, mr: 1 }}>
                        {String(si + 1).padStart(2, '0')}
                      </Box>
                      <Box component="span" sx={{ fontWeight: 600 }}>
                        {s.title.trim() || 'Untitled section'}
                      </Box>
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', ml: 3.5 }}>
                      {qCount} question{qCount === 1 ? '' : 's'}
                    </Typography>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
          <Button size="small" startIcon={<ViewAgenda fontSize="small" />} onClick={addSection} sx={{ mt: 1, justifyContent: 'flex-start', color: 'text.secondary' }}>
            Add section
          </Button>
        </Box>

        {/* ── Canvas (independent scroll on desktop) ── */}
        <Box sx={{
          flex: 1, minWidth: 0, minHeight: 0, p: { xs: 1.25, sm: 2.25 }, maxWidth: 720, mx: 'auto', width: '100%',
          height: { xs: 'auto', lg: '100%' }, overflowY: { xs: 'visible', lg: 'auto' },
        }}>
          {/* Form header */}
          <Box
            data-card-key="t"
            onClick={() => setSelected({ kind: 'title' })}
            sx={{
              bgcolor: '#fff', borderRadius: 3, border: '1px solid',
              borderColor: errorMap.title ? 'error.main' : '#ECEEF4',
              borderTop: '8px solid', borderTopColor: 'primary.main',
              px: 2.5, py: 2.25, mb: 1.5, cursor: 'text',
              boxShadow: !selected || selected.kind === 'title' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {titleActive ? (
              <>
                <TextField
                  value={builder.title}
                  onChange={(e) => setBuilder({ ...builder, title: e.target.value })}
                  placeholder="Untitled form"
                  autoFocus={focusKey === 'title'}
                  variant="standard"
                  fullWidth
                  error={!!errorMap.title}
                  slotProps={{ input: { sx: { fontSize: 22, fontWeight: 700 } } }}
                  sx={{ '& .MuiInput-underline:before': { borderBottomColor: 'transparent' }, '&:hover .MuiInput-underline:before': { borderBottomColor: 'divider' } }}
                />
                <TextField
                  value={builder.description}
                  onChange={(e) => setBuilder({ ...builder, description: e.target.value })}
                  placeholder="Form description — participants see this first"
                  variant="standard"
                  fullWidth
                  multiline
                  slotProps={{ input: { sx: { fontSize: 14 } } }}
                  sx={{ mt: 1, '& .MuiInput-underline:before': { borderBottomColor: 'transparent' }, '&:hover .MuiInput-underline:before': { borderBottomColor: 'divider' } }}
                />
                {errorMap.title && (
                  <Typography sx={{ fontSize: 12.5, color: 'error.main', mt: 1 }}>{errorMap.title}</Typography>
                )}
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25 }}>
                  {builder.title}
                </Typography>
                {builder.description?.trim() ? (
                  <Typography sx={{ fontSize: 14, color: 'text.secondary', mt: 1 }}>
                    {builder.description}
                  </Typography>
                ) : null}
              </>
            )}
          </Box>

          {/* What participants see */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, px: 0.5 }}>
            <InfoOutlined sx={{ fontSize: 14, color: 'text.disabled' }} />
            <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
              Participant details required for ticket delivery are included automatically.
            </Typography>
          </Box>

          {errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2, bgcolor: '#fff' }} onClose={() => setErrors([])}>
              <Typography gutterBottom sx={{ fontWeight: 600 }}>Fix the following before continuing:</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </Box>
            </Alert>
          )}

          {builder.sections.map((section, si) => {
            const secSelected = selected?.kind === 'section' && selected.key === section.key;
            const secActive = secSelected || !section.title.trim() || errorMap.sections[si];
            const candidates = findRepeatCandidates(builder.sections, si).map((c) => ({
              ...c,
              value: c.field.name?.trim() || slugify(c.field.label),
            }));
            return (
              <Box key={section.key} id={`builder-section-${si}`} sx={{ mb: 2.25, scrollMarginTop: 120 }}>
                {si > 0 && <Divider sx={{ mb: 2.25, borderColor: '#dadce0' }} />}
                <Box data-card-key={`s:${section.key}`}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: { xs: 0.5, sm: 1 } }}>
                    <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => setSelected({ kind: 'section', key: section.key })}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'text.secondary' }}>
                        SECTION {si + 1}
                      </Typography>
                      {secActive ? (
                        <>
                          <TextField
                            value={section.title}
                            onChange={(e) => updateSection(si, { title: e.target.value })}
                            placeholder="Section title"
                            autoFocus={focusKey === section.key}
                            variant="standard"
                            fullWidth
                            error={!!errorMap.sections[si]}
                            slotProps={{ input: { sx: { fontSize: 19, fontWeight: 600 } } }}
                            sx={{ '& .MuiInput-underline:before': { borderBottomColor: 'transparent' }, '&:hover .MuiInput-underline:before': { borderBottomColor: 'divider' } }}
                          />
                          <TextField
                            value={section.description}
                            onChange={(e) => updateSection(si, { description: e.target.value })}
                            placeholder="Description (optional)"
                            variant="standard"
                            fullWidth
                            multiline
                            slotProps={{ input: { sx: { fontSize: 13.5 } } }}
                            sx={{ mt: 0.5, '& .MuiInput-underline:before': { borderBottomColor: 'transparent' }, '&:hover .MuiInput-underline:before': { borderBottomColor: 'divider' } }}
                          />
                        </>
                      ) : (
                        <>
                          <Typography sx={{ fontSize: 19, fontWeight: 600, cursor: 'text' }}>
                            {section.title}
                          </Typography>
                          {section.description?.trim() ? (
                            <Typography sx={{ fontSize: 13.5, color: 'text.secondary', cursor: 'text' }}>
                              {section.description}
                            </Typography>
                          ) : null}
                        </>
                      )}
                      {errorMap.sections[si] && !secActive && (
                        <Typography sx={{ fontSize: 12.5, color: 'error.main', mt: 0.5 }}>{errorMap.sections[si]}</Typography>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexShrink: 0, pt: 2.5, opacity: secSelected ? 1 : 0, transition: 'opacity 0.15s', '&:hover': { opacity: 1 }, '&:focus-within': { opacity: 1 } }}>
                      <Tooltip title="Move section up">
                        <span>
                          <IconButton size="small" aria-label={`Move section ${si + 1} up`} disabled={si === 0} onClick={() => moveSection(si, -1)}>
                            <ArrowUpward fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Move section down">
                        <span>
                          <IconButton size="small" aria-label={`Move section ${si + 1} down`} disabled={si === builder.sections.length - 1} onClick={() => moveSection(si, 1)}>
                            <ArrowDownward fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete section">
                        <span>
                          <IconButton size="small" aria-label={`Delete section ${si + 1}`} disabled={builder.sections.length <= 1} onClick={() => setDeleteTarget({ kind: 'section', si, label: section.title || `Section ${si + 1}` })}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                </Box>

                <Box sx={{ mt: 1.5 }}>
                  {(section.fields || []).length === 0 && !section.memberGroup && (
                    <Typography sx={{ fontSize: 13.5, color: 'text.disabled', px: 0.5, pb: 1 }}>
                      No questions yet
                    </Typography>
                  )}
                  {(section.fields || []).map((field, fi) => (
                    <Box key={field.key} data-card-key={`q:${field.key}`}>
                      <QuestionCard
                        field={field}
                        selected={selected?.kind === 'question' && selected.key === field.key}
                        autoFocusLabel={focusKey === field.key}
                        error={errorMap.questions[field.key] || null}
                        onSelect={() => setSelected({ kind: 'question', key: field.key })}
                        onChange={(updated) => updateField(si, fi, updated)}
                        onDelete={() => setDeleteTarget({ kind: 'question', si, fi, label: field.label || 'Untitled question' })}
                        onDuplicate={() => duplicateField(si, fi)}
                        onMoveUp={() => moveField(si, fi, -1)}
                        onMoveDown={() => moveField(si, fi, 1)}
                        canMoveUp={fi > 0}
                        canMoveDown={fi < section.fields.length - 1}
                      />
                    </Box>
                  ))}

                  {section.memberGroup && (
                    <Box data-card-key={`g:${section.key}`}>
                      <MemberGroupCard
                        group={section.memberGroup}
                        candidates={candidates}
                        selected={selected?.kind === 'group' && selected.key === section.key}
                        selectedMemberKey={selected?.kind === 'member' ? selected.key : null}
                        focusKey={focusKey}
                        error={errorMap.groups[si] || null}
                        onSelect={() => setSelected({ kind: 'group', key: section.key })}
                        onSelectMember={(key) => setSelected({ kind: 'member', key })}
                        onChange={(group) => updateSection(si, { memberGroup: group })}
                        onRemove={() => setDeleteTarget({ kind: 'group', si, label: 'Team member group' })}
                        onAddField={() => {
                          const f = { ...emptyField(), key: newKey() };
                          updateSection(si, { memberGroup: { ...section.memberGroup!, fields: [...section.memberGroup!.fields, f] } });
                          selectKeepTab({ kind: 'member', key: f.key });
                          setFocusKey(f.key);
                        }}
                        onFieldChange={(fi, updated) => updateMemberField(si, fi, updated)}
                        onFieldDuplicate={(fi) => duplicateMemberField(si, fi)}
                        onFieldDelete={(fi) => {
                          const f = section.memberGroup!.fields[fi];
                          setDeleteTarget({ kind: 'member', si, fi, label: f?.label || 'Untitled question' });
                        }}
                        onFieldMove={(fi, dir) => moveMemberField(si, fi, dir)}
                      />
                    </Box>
                  )}

                  {/* Creation lives in the fixed bottom bar — not repeated per section. */}
                </Box>
              </Box>
            );
          })}

          {builder.sections.length === 0 ? (
            <Box sx={{ textAlign: 'center' }}>
              <EmptyState
                icon={ViewAgenda}
                title="Start building your registration form"
                description="Add questions to collect the information your event needs."
              />
              <Button variant="contained" startIcon={<Add />} onClick={(e) => openAddMenu(e)} sx={{ borderRadius: 999, boxShadow: 'none', mt: 2 }}>
                Add Question
              </Button>
            </Box>
          ) : null}

          {/* Creation bar — stays visible at the bottom of the scrollable
              question editor while scrolling (above the bottom nav bar). */}
          <Box
            sx={{
              position: 'sticky',
              bottom: 0,
              zIndex: 4,
              mt: 2,
              py: 1.5,
              bgcolor: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(8px)',
              borderTop: '1px solid',
              borderColor: '#ECEEF4',
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Button variant="contained" startIcon={<Add />} onClick={(e) => openAddMenu(e)}
              sx={{ borderRadius: 999, boxShadow: 'none' }}>
              Add Question
            </Button>
            <Button variant="outlined" startIcon={<ViewAgenda />} onClick={addSection} sx={{ borderRadius: 999 }}>
              Section
            </Button>
            <Button
              variant="outlined"
              startIcon={<GroupAdd />}
              onClick={() => addGroup()}
              disabled={targetSi >= 0 && !!builder.sections[targetSi]?.memberGroup}
              sx={{ borderRadius: 999 }}
            >
              Team Group
            </Button>
          </Box>
        </Box>

        {/* ── Right properties panel (fixed; own scroll, never pushed by questions) ── */}
        <Box sx={{
          width: 300, flexShrink: 0, bgcolor: '#fff', borderLeft: '1px solid', borderColor: '#ECEEF4',
          display: { xs: 'none', lg: 'flex' }, flexDirection: 'column',
          minHeight: 0, height: { xs: 'auto', lg: '100%' },
        }}>
          {/* Tab bar at top of right panel — Style/Settings are always present;
              Properties appears while an item is selected. Switching tabs never
              clears the selection or resets any tab's content. */}
          <Tabs
            value={activeTab}
            onChange={handlePanelTab}
            sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 40, px: 1 }}
          >
            {hasItemSelected && (
              <Tab value="properties" label="Properties" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40, py: 0.5 }} />
            )}
            <Tab value="style" label="Style" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40, py: 0.5 }} />
            <Tab value="settings" label="Settings" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40, py: 0.5 }} />
          </Tabs>
          <Box sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>
            <Box
              key={hasItemSelected ? `${panelKey}:${selTab}` : rightTab}
              sx={{
                '@keyframes fbPanelIn': {
                  from: { opacity: 0, transform: 'translateX(6px)' },
                  to: { opacity: 1, transform: 'translateX(0)' },
                },
                animation: 'fbPanelIn 0.2s ease',
              }}
            >
              {renderPanelContent()}
            </Box>
          </Box>
        </Box>
      </Box>

          {/* ── Bottom navigation: dedicated bar at the absolute bottom of the
          editor container, OUTSIDE the scrollable question area. Back aligns
          left, Preview aligns right; stable while the center scrolls
          and unaffected by either side panel. ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
        px: { xs: 1.5, sm: 2.5 }, py: 1.5,
        borderTop: '1px solid', borderColor: '#ECEEF4', bgcolor: '#fff',
        borderRadius: '0 0 12px 12px',
      }}>
        {onBack ? (
          <Button variant="outlined" size="large" startIcon={<ArrowBack fontSize="small" />} onClick={onBack} disabled={saving}
            sx={{ px: 4, fontWeight: 600, borderRadius: 2 }}>
            Back
          </Button>
        ) : <Box />}
        <Button variant="contained" size="large" endIcon={<PreviewOutlined fontSize="small" />} onClick={handleSave} disabled={saving}
          sx={{ px: 4, fontWeight: 600, borderRadius: 2, boxShadow: 'none' }}>
          {saving ? 'Saving…' : 'Preview'}
        </Button>
      </Box>

      {/* Properties bottom sheet — mobile/tablet only (desktop uses the side panel). */}
      <Drawer anchor="bottom" open={propsOpen} onClose={() => setPropsOpen(false)}
        sx={{ display: { xs: 'block', lg: 'none' } }}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80vh' } } }}>
        <Box sx={{ p: 2.5, pb: 4 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 2 }} />
          {/* Tab switcher in drawer — same persistent tabs as the side panel */}
          <Tabs value={activeTab} onChange={handlePanelTab} sx={{ mb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            {hasItemSelected && (
              <Tab value="properties" label="Properties" sx={{ fontSize: 12, fontWeight: 700 }} />
            )}
            <Tab value="style" label="Style" sx={{ fontSize: 12, fontWeight: 700 }} />
            <Tab value="settings" label="Settings" sx={{ fontSize: 12, fontWeight: 700 }} />
          </Tabs>
          {renderPanelContent()}
          <Button fullWidth variant="contained" onClick={() => setPropsOpen(false)} sx={{ mt: 2, borderRadius: 999, boxShadow: 'none' }}>
            Done
          </Button>
        </Box>
      </Drawer>

      {/* Add-question type popover, grouped by category. Only backend-supported types. */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeAddMenu}
        slotProps={{ paper: { sx: { borderRadius: 3, minWidth: 250, p: 0.75 } } }}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', px: 1.5, pt: 0.75, pb: 1 }}>
          ADD QUESTION
        </Typography>
        {TYPE_GROUPS.map((g) => (
          <Box key={g.heading}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: 'text.secondary', px: 1.5, pt: 1, pb: 0.5 }}>
              {g.heading}
            </Typography>
            {g.types.map((t) => {
              const Icon = TYPE_META[t]?.icon;
              const label = TYPE_META[t]?.label || t;
              return (
                <MenuItem key={t} onClick={() => menuAddQuestion(t)} sx={{ borderRadius: 2, py: 1 }}>
                  {Icon && <Icon sx={{ fontSize: 19, color: 'text.secondary', mr: 1.5 }} />}
                  <Typography sx={{ fontSize: 14 }}>{label}</Typography>
                </MenuItem>
              );
            })}
          </Box>
        ))}
      </Menu>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.kind === 'section' ? 'Delete section?' : deleteTarget?.kind === 'group' ? 'Remove team member group?' : 'Delete question?'}
        description={deleteTarget ? `“${deleteTarget.label}” will be removed along with its configuration. This cannot be undone.` : ''}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </Box>
  );
}
