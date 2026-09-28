import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  Alert, Box, Button, Divider, Drawer, FormControl, IconButton, InputLabel, List, ListItemButton,
  Menu, MenuItem, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import {
  Add, ArrowBack, ArrowDownward, ArrowUpward, CheckCircleOutlined, Delete,
  GroupAdd, InfoOutlined, PreviewOutlined, SaveOutlined, SettingsOutlined, UploadOutlined, ViewAgenda,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import QuestionCard, { TYPE_META } from './QuestionCard';
import QuestionInspector from './QuestionInspector';
import MemberGroupCard from './MemberGroupCard';
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
import type { FormFieldType, FormStructure, FormTheme } from '../../../app/types';

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
  onPreview: (structure: FormStructure) => void;
  saving: boolean;
  onBack?: () => void;
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

export default function FormBuilder({ initial, onSave, onPreview, saving, onBack }: FormBuilderProps) {
  const [builder, setBuilderState] = useState<BuilderForm>(() => normalizeInitial(initial));
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
  const [uploadingImage, setUploadingImage] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const errorMap = buildErrorMap(errors, builder);

  // Dirty tracking: every mutation marks unsaved changes.
  const setBuilder = (next: BuilderForm) => {
    setBuilderState(next);
    setDirty(true);
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
    setSelected({ kind: 'question', key: copy.key });
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
    setSelected({ kind: 'question', key: field.key });
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
      setSelected({ kind: 'group', key: base.sections[idx].key });
      return;
    }
    const sections = [...base.sections];
    sections[idx] = { ...sections[idx], memberGroup: emptyMemberGroup() };
    setBuilder({ ...base, sections });
    setSelected({ kind: 'group', key: sections[idx].key });
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
    setSelected({ kind: 'member', key: copy.key });
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
    setSelected({ kind: 'group', key: sections[si].key });
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
    setSelected({ kind: 'section', key: section.key });
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

  const handlePreview = () => {
    const structure = build();
    if (structure) onPreview(structure);
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
  const selectedQuestion = selected?.kind === 'question' ? findQuestion(selected.key) : null;
  const selectedMember = selected?.kind === 'member' ? findMember(selected.key) : null;
  const selectedSectionIdx = selected && (selected.kind === 'section' || selected.kind === 'group')
    ? findSectionIdx(selected.key)
    : -1;

  const renderProperties = () => {
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
              setSelected({ kind: 'member', key: f.key });
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
  const setTheme = (patch: Partial<FormTheme>) =>
    setBuilder({ ...builder, theme: { ...(builder.theme || {}), ...patch } });
  const theme = builder.theme || {};
  const handleHeaderImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('Please choose an image file.', { variant: 'warning' });
      return;
    }
    setUploadingImage(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setTheme({ headerImageUrl: canvas.toDataURL('image/jpeg', 0.82) });
        enqueueSnackbar('Header image updated.', { variant: 'success' });
      } catch {
        enqueueSnackbar('Could not process that image.', { variant: 'error' });
      } finally {
        URL.revokeObjectURL(url);
        setUploadingImage(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setUploadingImage(false);
      enqueueSnackbar('Could not read that image.', { variant: 'error' });
    };
    img.src = url;
  };
    const THEME_OPTIONS: { v: NonNullable<FormTheme['theme']>; label: string; hint: string }[] = [
      { v: 'light', label: 'Light', hint: 'Clean white form' },
      { v: 'bepart', label: 'BePart', hint: 'Brand blue accents' },
      { v: 'dark', label: 'Dark', hint: 'Dark stage, light text' },
    ];
    const activeTheme = theme.theme || 'light';
    return (
      <Box>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
          FORM STYLE
        </Typography>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
          HEADER
        </Typography>
        <TextField label="Header image URL (optional)" value={theme.headerImageUrl && theme.headerImageUrl.startsWith('data:') ? '' : (theme.headerImageUrl || '')}
          onChange={(e) => setTheme({ headerImageUrl: e.target.value.trim() || undefined })}
          placeholder="https://… or upload below"
          fullWidth size="small" sx={{ mb: 1.5 }} helperText="Cover shown at the top of the participant form" />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" component="label" startIcon={<UploadOutlined />} disabled={uploadingImage} sx={{ borderRadius: 2 }}>
            {uploadingImage ? 'Processing…' : theme.headerImageUrl ? 'Change image' : 'Upload image'}
            <input type="file" hidden accept="image/*" onChange={(e) => handleHeaderImageFile(e.target.files?.[0])} />
          </Button>
          {theme.headerImageUrl ? (
            <Button size="small" onClick={() => setTheme({ headerImageUrl: undefined })}>Remove</Button>
          ) : null}
        </Box>
        {theme.headerImageUrl ? (
          <Box sx={{ mb: 1.5 }}>
            <Box component="img" src={theme.headerImageUrl} alt="Form header preview"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              sx={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'block' }} />
          </Box>
        ) : null}

        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
          TYPOGRAPHY
        </Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Question typeface</InputLabel>
          <Select label="Question typeface" value={theme.questionFont || 'default'}
            onChange={(e) => setTheme({ questionFont: e.target.value as FormTheme['questionFont'] })}>
            <MenuItem value="default">Sans</MenuItem>
            <MenuItem value="serif">Serif</MenuItem>
            <MenuItem value="mono">Mono</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Question size</InputLabel>
          <Select label="Question size" value={theme.questionSize || 'md'}
            onChange={(e) => setTheme({ questionSize: e.target.value as FormTheme['questionSize'] })}>
            <MenuItem value="sm">12</MenuItem>
            <MenuItem value="md">14</MenuItem>
            <MenuItem value="lg">16</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>Answer typeface</InputLabel>
          <Select label="Answer typeface" value={theme.answerFont || 'default'}
            onChange={(e) => setTheme({ answerFont: e.target.value as FormTheme['answerFont'] })}>
            <MenuItem value="default">Sans</MenuItem>
            <MenuItem value="serif">Serif</MenuItem>
            <MenuItem value="mono">Mono</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Answer size</InputLabel>
          <Select label="Answer size" value={theme.answerSize || 'md'}
            onChange={(e) => setTheme({ answerSize: e.target.value as FormTheme['answerSize'] })}>
            <MenuItem value="sm">11</MenuItem>
            <MenuItem value="md">13</MenuItem>
            <MenuItem value="lg">15</MenuItem>
          </Select>
        </FormControl>

        <Divider sx={{ my: 2 }} />
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
          THEME
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
          {THEME_OPTIONS.map((o) => {
            const isActive = activeTheme === o.v;
            return (
              <Box
                key={o.v}
                onClick={() => setTheme({ theme: o.v })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme({ theme: o.v }); } }}
                aria-pressed={isActive}
                sx={{
                  borderRadius: 2,
                  border: '1.5px solid',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  bgcolor: o.v === 'dark' ? '#171717' : o.v === 'bepart' ? '#F4F7FF' : '#fff',
                  p: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'border-color 0.2s ease, transform 0.2s ease',
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                {isActive && (
                  <Box sx={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', transition: 'transform 0.2s ease', transform: 'scale(1)' }}>
                    <CheckCircleOutlined sx={{ fontSize: 12 }} />
                  </Box>
                )}
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: o.v === 'dark' ? '#fff' : 'text.primary', fontFamily: o.v === 'dark' ? 'inherit' : undefined }}>
                  Aa
                </Typography>
                <Box sx={{ height: 3, borderRadius: 1, bgcolor: o.v === 'dark' ? 'rgba(255,255,255,0.5)' : '#CBD2DC', my: 0.75 }} />
                <Box sx={{ height: 14, borderRadius: 999, bgcolor: o.v === 'dark' ? '#fff' : 'primary.main', opacity: o.v === 'light' ? 0.85 : 1 }} />
                <Typography sx={{ fontSize: 10.5, fontWeight: 700, mt: 0.75, color: o.v === 'dark' ? '#fff' : 'text.secondary', textAlign: 'center' }}>
                  {o.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          Style applies to the participant form and preview instantly.
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ bgcolor: '#F7F8FA', borderRadius: 3, overflow: 'hidden', border: '1px solid', borderColor: '#ECEEF4' }}>
      {/* ── Top bar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2 }, py: 1, bgcolor: '#fff', borderBottom: '1px solid', borderColor: '#ECEEF4', position: 'sticky', top: 0, zIndex: 5, flexWrap: 'wrap' }}>
        {onBack && (
          <Tooltip title="Back to event details">
            <IconButton size="small" aria-label="Back to event details" onClick={onBack}>
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <BePartMark size={26} fontSize={15} />
        <Typography noWrap sx={{ fontSize: 14, fontWeight: 700, ml: 0.5, maxWidth: { xs: 120, sm: 280 } }}>
          {builder.title.trim() || 'Create Form'}
        </Typography>
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
          <Button size="small" variant="text" startIcon={<PreviewOutlined fontSize="small" />} onClick={handlePreview} disabled={saving} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            Preview
          </Button>
          <Button size="small" variant="contained" onClick={handleSave} disabled={saving} sx={{ boxShadow: 'none' }}>
            {saving ? 'Saving…' : 'Save & Continue'}
          </Button>
          <Tooltip title="Form settings">
            <IconButton size="small" aria-label="Open form settings" onClick={() => setPropsOpen(true)} sx={{ display: { xs: 'inline-flex', lg: 'none' } }}>
              <SettingsOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 480 }}>
        {/* ── Left nav ── */}
        <Box sx={{ width: 224, flexShrink: 0, bgcolor: '#fff', borderRight: '1px solid', borderColor: '#ECEEF4', p: 1.5, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5 }}>
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

        {/* ── Canvas ── */}
        <Box sx={{ flex: 1, minWidth: 0, p: { xs: 1.25, sm: 2.25 }, maxWidth: 720, mx: 'auto', width: '100%' }}>
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
                          setSelected({ kind: 'member', key: f.key });
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

          {/* Fixed creation bar — always available while scrolling. */}
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

        {/* ── Right properties panel ── */}
        <Box sx={{ width: 300, flexShrink: 0, bgcolor: '#fff', borderLeft: '1px solid', borderColor: '#ECEEF4', p: 2, display: { xs: 'none', lg: 'block' }, overflowY: 'auto', maxHeight: 720, position: 'sticky', top: 53, alignSelf: 'flex-start' }}>
          <Box
            key={panelKey}
            sx={{
              '@keyframes fbPanelIn': {
                from: { opacity: 0, transform: 'translateX(6px)' },
                to: { opacity: 1, transform: 'translateX(0)' },
              },
              animation: 'fbPanelIn 0.2s ease',
            }}
          >
            {renderProperties()}
          </Box>
        </Box>
      </Box>

      {/* Properties bottom sheet — mobile/tablet only (desktop uses the side panel). */}
      <Drawer anchor="bottom" open={propsOpen} onClose={() => setPropsOpen(false)}
        sx={{ display: { xs: 'block', lg: 'none' } }}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '80vh' } } }}>
        <Box sx={{ p: 2.5, pb: 4 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mb: 2 }} />
          {renderProperties()}
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
