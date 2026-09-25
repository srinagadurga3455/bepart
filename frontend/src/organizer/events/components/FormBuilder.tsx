import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Divider, IconButton, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { Add, ArrowDownward, ArrowUpward, Delete, GroupAdd, ViewAgenda } from '@mui/icons-material';
import QuestionCard from './QuestionCard';
import MemberGroupCard from './MemberGroupCard';
import {
  emptyField, emptySection, emptyMemberGroup, newKey, slugify,
  findRepeatCandidates, toFormStructure, validateBuilder,
} from './formBuilderUtils';

function buildErrorMap(errors, builder) {
  const map = { title: null, sections: {}, questions: {}, groups: {} };
  const allFields = [];
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

const ghostInputSx = {
  '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
  '&:hover .MuiInput-underline:before': { borderBottomColor: 'divider' },
};

function normalizeInitial(initial) {
  const base = {
    title: initial?.title?.trim() ? initial.title : 'Untitled form',
    description: initial?.description || '',
    sections: initial?.sections?.length ? initial.sections : [],
  };
  // A new form always starts with exactly ONE empty section — nothing is
  // ever pre-created (no second section, no member group, no questions).
  if (base.sections.length === 0) {
    base.sections = [{
      key: newKey(),
      id: `section_${Date.now().toString(36)}_0`,
      title: 'Untitled section',
      description: '',
      fields: [],
      memberGroup: null,
    }];
  }
  return base;
}

export default function FormBuilder({ initial, onSave, onPreview, saving }) {
  const [builder, setBuilder] = useState(() => normalizeInitial(initial));
  const [errors, setErrors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [focusKey, setFocusKey] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [toolbarTop, setToolbarTop] = useState(0);
  const canvasRef = useRef(null);

  const errorMap = buildErrorMap(errors, builder);

  const selectionKey = !selected || selected.kind === 'title'
    ? 't'
    : selected.kind === 'section'
      ? `s:${selected.key}`
      : selected.kind === 'group'
        ? `g:${selected.key}`
        : `q:${selected.key}`;

  // Keep the floating toolbar aligned beside the selected card.
  useEffect(() => {
    const update = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const el = canvas.querySelector(`[data-card-key="${selectionKey}"]`);
      if (el) {
        setToolbarTop(Math.max(0, el.offsetTop - canvas.offsetTop));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  });

  const findSectionIdx = (key) => builder.sections.findIndex((s) => s.key === key);
  const findQuestion = (key) => {
    for (let si = 0; si < builder.sections.length; si++) {
      const fi = (builder.sections[si].fields || []).findIndex((f) => f.key === key);
      if (fi >= 0) return { si, fi, field: builder.sections[si].fields[fi] };
    }
    return null;
  };
  const findMember = (key) => {
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

  const updateSection = (idx, patch) => {
    const sections = [...builder.sections];
    sections[idx] = { ...sections[idx], ...patch };
    setBuilder({ ...builder, sections });
  };

  const moveSection = (idx, dir) => {
    const sections = [...builder.sections];
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    [sections[idx], sections[j]] = [sections[j], sections[idx]];
    setBuilder({ ...builder, sections });
  };

  const removeSection = (idx) => {
    setBuilder({ ...builder, sections: builder.sections.filter((_, i) => i !== idx) });
    setSelected(null);
  };

  const updateField = (si, fi, updated) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].fields];
    fields[fi] = updated;
    sections[si] = { ...sections[si], fields };
    setBuilder({ ...builder, sections });
  };

  const insertField = (si, fi, field) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].fields];
    fields.splice(fi, 0, field);
    sections[si] = { ...sections[si], fields };
    setBuilder({ ...builder, sections });
  };

  const moveField = (si, fi, dir) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].fields];
    const j = fi + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[fi], fields[j]] = [fields[j], fields[fi]];
    sections[si] = { ...sections[si], fields };
    setBuilder({ ...builder, sections });
  };

  const removeField = (si, fi) => {
    const sections = [...builder.sections];
    sections[si] = { ...sections[si], fields: sections[si].fields.filter((_, i) => i !== fi) };
    setBuilder({ ...builder, sections });
    setSelected(null);
  };

  const duplicateField = (si, fi) => {
    const src = builder.sections[si].fields[fi];
    const copy = { ...src, key: newKey(), options: [...(src.options || [])] };
    insertField(si, fi + 1, copy);
    setSelected({ kind: 'question', key: copy.key });
    setFocusKey(copy.key);
  };

  const addQuestion = (si = targetSi) => {
    if (si < 0 || si >= builder.sections.length) return;
    const field = { ...emptyField(), key: newKey() };
    const sections = [...builder.sections];
    sections[si] = { ...sections[si], fields: [...(sections[si].fields || []), field] };
    setBuilder({ ...builder, sections });
    setSelected({ kind: 'question', key: field.key });
    setFocusKey(field.key);
  };

  const addGroup = (si = targetSi) => {
    if (si < 0 || si >= builder.sections.length) return;
    if (builder.sections[si].memberGroup) return;
    updateSection(si, { memberGroup: emptyMemberGroup() });
    setSelected({ kind: 'group', key: builder.sections[si].key });
  };

  const removeGroup = (si) => {
    updateSection(si, { memberGroup: null });
    setSelected(null);
  };

  const updateMemberField = (si, fi, updated) => {
    const sections = [...builder.sections];
    const fields = [...(sections[si].memberGroup?.fields || [])];
    fields[fi] = updated;
    sections[si] = { ...sections[si], memberGroup: { ...sections[si].memberGroup, fields } };
    setBuilder({ ...builder, sections });
  };

  const duplicateMemberField = (si, fi) => {
    const src = builder.sections[si].memberGroup.fields[fi];
    const copy = { ...src, key: newKey(), options: [...(src.options || [])] };
    const sections = [...builder.sections];
    const fields = [...sections[si].memberGroup.fields];
    fields.splice(fi + 1, 0, copy);
    sections[si] = { ...sections[si], memberGroup: { ...sections[si].memberGroup, fields } };
    setBuilder({ ...builder, sections });
    setSelected({ kind: 'member', key: copy.key });
    setFocusKey(copy.key);
  };

  const removeMemberField = (si, fi) => {
    const sections = [...builder.sections];
    sections[si] = {
      ...sections[si],
      memberGroup: {
        ...sections[si].memberGroup,
        fields: sections[si].memberGroup.fields.filter((_, i) => i !== fi),
      },
    };
    setBuilder({ ...builder, sections });
    setSelected({ kind: 'group', key: sections[si].key });
  };

  const moveMemberField = (si, fi, dir) => {
    const sections = [...builder.sections];
    const fields = [...sections[si].memberGroup.fields];
    const j = fi + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[fi], fields[j]] = [fields[j], fields[fi]];
    sections[si] = { ...sections[si], memberGroup: { ...sections[si].memberGroup, fields } };
    setBuilder({ ...builder, sections });
  };

  const addSection = () => {
    const section = emptySection(builder.sections.length);
    setBuilder({ ...builder, sections: [...builder.sections, section] });
    setSelected({ kind: 'section', key: section.key });
    setFocusKey(section.key);
  };

  const build = () => {
    const errs = validateBuilder(builder);
    setErrors(errs);
    if (errs.length > 0) return null;
    return toFormStructure(builder);
  };

  const handleSave = () => {
    const structure = build();
    if (structure) onSave(structure);
  };

  const handlePreview = () => {
    const structure = build();
    if (structure) onPreview(structure);
  };

  const hasSection = builder.sections.length > 0;
  const targetSection = targetSi >= 0 ? builder.sections[targetSi] : null;
  const groupDisabled = !targetSection || !!targetSection.memberGroup;
  const openPlusMenu = (e) => setMenuAnchor(e.currentTarget);
  const closePlusMenu = () => setMenuAnchor(null);
  const menuAddQuestion = () => { closePlusMenu(); addQuestion(); };
  const menuAddGroup = () => { closePlusMenu(); addGroup(); };

  const titleActive = !selected || selected.kind === 'title' || !builder.title.trim() || errorMap.title;

  return (
    <Box sx={{ bgcolor: '#f1f3f4', borderRadius: 3, p: { xs: 1.5, sm: 3 } }}>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closePlusMenu}>
        <MenuItem onClick={menuAddQuestion} autoFocusItem={!groupDisabled || true}>
          <Add fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          Add question
        </MenuItem>
        <MenuItem onClick={menuAddGroup} disabled={groupDisabled}>
          <GroupAdd fontSize="small" sx={{ mr: 1.5, color: 'text.secondary' }} />
          Add Team Member Group
        </MenuItem>
      </Menu>

      <Box sx={{ position: 'relative', maxWidth: 760, mx: 'auto' }}>
        <Box
          sx={{
            display: { xs: 'flex', md: 'none' },
            flexDirection: 'row', gap: 0.5, justifyContent: 'center',
            bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3,
            p: 0.75, position: 'sticky', top: 72, zIndex: 1, mb: 2, mx: 'auto', width: 'fit-content',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          <ToolbarButtons
            horizontal
            onPlus={openPlusMenu}
            onAddSection={addSection}
            hasSection={hasSection}
          />
        </Box>

        <Box
          sx={{
            display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.5,
            bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3,
            p: 0.75, position: 'absolute', right: 0, top: toolbarTop,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 1,
            transition: 'top 0.25s ease',
          }}
        >
          <ToolbarButtons
            onPlus={openPlusMenu}
            onAddSection={addSection}
            hasSection={hasSection}
          />
        </Box>

        <Box ref={canvasRef} sx={{ position: 'relative', maxWidth: 640, width: '100%' }}>
          <Box
            data-card-key="t"
            onClick={() => setSelected({ kind: 'title' })}
            sx={{
              bgcolor: '#fff', borderRadius: 2, border: '1px solid',
              borderColor: errorMap.title ? 'error.main' : 'divider',
              borderTop: '8px solid', borderTopColor: 'primary.main',
              px: 3, py: 3, mb: 2, cursor: 'text',
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
                  InputProps={{ sx: { fontSize: 28, fontWeight: 700 } }}
                  sx={ghostInputSx}
                />
                <TextField
                  value={builder.description}
                  onChange={(e) => setBuilder({ ...builder, description: e.target.value })}
                  placeholder="Form description"
                  variant="standard"
                  fullWidth
                  multiline
                  InputProps={{ sx: { fontSize: 14 } }}
                  sx={{ ...ghostInputSx, mt: 1 }}
                />
                {errorMap.title && (
                  <Typography sx={{ fontSize: 12.5, color: 'error.main', mt: 1 }}>{errorMap.title}</Typography>
                )}
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.25 }}>
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

          {errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2, bgcolor: '#fff' }} onClose={() => setErrors([])}>
              <Typography fontWeight={600} gutterBottom>Fix the following before continuing:</Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </Box>
            </Alert>
          )}

          {builder.sections.length === 0 && (
            <Box sx={{ bgcolor: '#fff', borderRadius: 2, border: '1px dashed', borderColor: 'divider', p: 4, textAlign: 'center', mb: 2 }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>Start by adding your first section.</Typography>
              <Button variant="contained" onClick={addSection}>Add section</Button>
            </Box>
          )}

          {builder.sections.map((section, si) => {
            const secSelected = selected?.kind === 'section' && selected.key === section.key;
            const secActive = secSelected || !section.title.trim() || errorMap.sections[si];
            const candidates = findRepeatCandidates(builder.sections, si).map((c) => ({
              ...c,
              value: c.field.name?.trim() || slugify(c.field.label),
            }));
            const isLastSection = builder.sections.length === 1;
            return (
              <Box key={section.key} sx={{ mb: 3 }}>
                {si > 0 && <Divider sx={{ mb: 3, borderColor: '#dadce0' }} />}
                <Box data-card-key={`s:${section.key}`} sx={{ px: { xs: 0.5, sm: 1 } }}>
                  <Box
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1,
                      '& .sec-controls': { opacity: secSelected ? 1 : 0 },
                      '&:hover .sec-controls': { opacity: 1 },
                    }}
                  >
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
                            InputProps={{ sx: { fontSize: 19, fontWeight: 600 } }}
                            sx={ghostInputSx}
                          />
                          <TextField
                            value={section.description}
                            onChange={(e) => updateSection(si, { description: e.target.value })}
                            placeholder="Description (optional)"
                            variant="standard"
                            fullWidth
                            multiline
                            InputProps={{ sx: { fontSize: 13.5 } }}
                            sx={{ ...ghostInputSx, mt: 0.5 }}
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
                    <Box className="sec-controls" sx={{ display: 'flex', transition: 'opacity 0.15s', pt: 2.5, flexShrink: 0 }}>
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
                      <Tooltip title={isLastSection ? 'A form needs at least one section' : 'Delete section'}>
                        <span>
                          <IconButton size="small" aria-label={`Delete section ${si + 1}`} disabled={isLastSection} onClick={() => removeSection(si)}>
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
                        onDelete={() => removeField(si, fi)}
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
                        onRemove={() => removeGroup(si)}
                        onAddField={() => {
                          const f = { ...emptyField(), key: newKey() };
                          updateSection(si, { memberGroup: { ...section.memberGroup, fields: [...section.memberGroup.fields, f] } });
                          setSelected({ kind: 'member', key: f.key });
                          setFocusKey(f.key);
                        }}
                        onFieldChange={(fi, updated) => updateMemberField(si, fi, updated)}
                        onFieldDuplicate={(fi) => duplicateMemberField(si, fi)}
                        onFieldDelete={(fi) => removeMemberField(si, fi)}
                        onFieldMove={(fi, dir) => moveMemberField(si, fi, dir)}
                      />
                    </Box>
                  )}
                </Box>
              </Box>
            );
          })}

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap', mt: 1 }}>
            <Button variant="outlined" onClick={handlePreview} disabled={saving}>
              Preview
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ px: 4 }}>
              {saving ? 'Saving…' : 'Save & Continue'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function ToolbarButtons({ onPlus, onAddSection, hasSection, horizontal }) {
  const btn = { width: 40, height: 40 };
  const placement = horizontal ? 'bottom' : 'left';
  return (
    <>
      <Tooltip title="Add question or team member group" placement={placement}>
        <span>
          <IconButton aria-label="Add item" onClick={onPlus} disabled={!hasSection} sx={btn}>
            <Add />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Add section" placement={placement}>
        <IconButton aria-label="Add section" onClick={onAddSection} sx={btn}>
          <ViewAgenda />
        </IconButton>
      </Tooltip>
    </>
  );
}
