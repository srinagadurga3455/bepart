import { useState } from 'react';
import { Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Switch, TextField, Tooltip, Typography } from '@mui/material';
import { Add, ArrowDownward, ArrowUpward, Delete, LockOutlined } from '@mui/icons-material';
import { BUILDER_TYPES, OPTION_TYPES } from '../utils/formBuilderUtils';
import type { BuilderField } from '../utils/formBuilderUtils';
import type { FormFieldType } from '../../../app/types';

function OptionBullet({ type, index }: { type: FormFieldType; index: number }) {
  if (type === 'radio') return <Box sx={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid', borderColor: 'text.disabled', flexShrink: 0 }} />;
  if (type === 'checkbox') return <Box sx={{ width: 14, height: 14, borderRadius: 0.5, border: '1.5px solid', borderColor: 'text.disabled', flexShrink: 0 }} />;
  return (
    <Typography sx={{ fontSize: 13, color: 'text.disabled', width: 18, textAlign: 'center' }}>
      {index + 1}
    </Typography>
  );
}

interface QuestionInspectorProps {
  field: BuilderField;
  onChange: (updated: BuilderField) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  deleteLabel?: string;
}

// THE question editor: grouped CONTENT / FIELD / VALIDATION / OPTIONS /
// ACTIONS. Used by the inspector for both regular and team-member fields —
// the card itself stays a visual preview.
export default function QuestionInspector({ field, onChange, onDelete, onDuplicate, deleteLabel = 'Delete question' }: QuestionInspectorProps) {
  const set = (patch: Partial<BuilderField>) => onChange({ ...field, ...patch });
  const [freshOptIdx, setFreshOptIdx] = useState(-1);
  const isSystem = !!field.system;

  const setOption = (idx: number, value: string) => {
    const options = [...(field.options || [])];
    options[idx] = value;
    set({ options });
  };
  const addOption = () => {
    const next = (field.options || []).length;
    setFreshOptIdx(next);
    set({ options: [...(field.options || []), `Option ${next + 1}`] });
  };
  const removeOption = (idx: number) => set({ options: (field.options || []).filter((_, i) => i !== idx) });
  const moveOption = (idx: number, dir: number) => {
    const options = [...(field.options || [])];
    const j = idx + dir;
    if (j < 0 || j >= options.length) return;
    [options[idx], options[j]] = [options[j], options[idx]];
    set({ options });
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
        CONTENT
      </Typography>
      {isSystem && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, bgcolor: 'action.hover', borderRadius: 2, px: 1.5, py: 1 }}>
          <LockOutlined sx={{ fontSize: 15, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            System field — {field.system === 'phone' ? 'required for ticket delivery' : 'required for registration'}.
          </Typography>
        </Box>
      )}
      <TextField label="Question" value={field.label} onChange={(e) => set({ label: e.target.value })}
        fullWidth size="small" sx={{ mb: 2 }} />
      <TextField label="Description" value={field.description || ''} onChange={(e) => set({ description: e.target.value })}
        fullWidth size="small" multiline rows={2} sx={{ mb: 1 }} helperText="Shown to participants under the question" />

      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
        FIELD
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>Type</InputLabel>
        <Select
          label="Type"
          value={field.type}
          disabled={isSystem}
          onChange={(e) => {
            const type = e.target.value as FormFieldType;
            const patch: Partial<BuilderField> = { type };
            if (!OPTION_TYPES.includes(type)) patch.options = [];
            else if (!field.options || field.options.length === 0) patch.options = ['Option 1'];
            set(patch);
          }}
        >
          {BUILDER_TYPES.map((t) => (
            <MenuItem key={t.value} value={t.value} sx={{ fontSize: 14 }}>{t.label}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {isSystem && (
        <Typography variant="caption" color="text.secondary">Type is locked for system fields.</Typography>
      )}

      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1 }}>
        VALIDATION
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>Required</Typography>
        <Tooltip title={isSystem ? 'System fields stay required' : 'Required'}>
          <span>
            <Switch size="small" checked={!!field.required} disabled={isSystem}
              onChange={(e) => set({ required: e.target.checked })} slotProps={{ input: { 'aria-label': 'Required' } }} />
          </span>
        </Tooltip>
      </Box>

      {OPTION_TYPES.includes(field.type) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1 }}>
            OPTIONS
          </Typography>
          {(field.options || []).map((opt, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25,
                '& .opt-act': { opacity: 0 },
                '&:hover .opt-act, &:focus-within .opt-act': { opacity: 1 },
              }}
            >
              <OptionBullet type={field.type} index={idx} />
              <TextField
                value={opt}
                onChange={(e) => setOption(idx, e.target.value)}
                placeholder={`Option ${idx + 1}`}
                autoFocus={freshOptIdx === idx}
                onFocus={() => setFreshOptIdx(-1)}
                variant="standard"
                fullWidth
                slotProps={{ input: { sx: { fontSize: 14 } } }}
                sx={{
                  '& .MuiInput-underline:before': { borderBottomColor: 'transparent' },
                  '&:hover .MuiInput-underline:before': { borderBottomColor: 'divider' },
                }}
              />
              <Tooltip title="Move option up">
                <span>
                  <IconButton size="small" className="opt-act" aria-label="Move option up" disabled={idx === 0} onClick={() => moveOption(idx, -1)} sx={{ transition: 'opacity 0.15s' }}>
                    <ArrowUpward sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Move option down">
                <span>
                  <IconButton size="small" className="opt-act" aria-label="Move option down" disabled={idx === (field.options || []).length - 1} onClick={() => moveOption(idx, 1)} sx={{ transition: 'opacity 0.15s' }}>
                    <ArrowDownward sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete option">
                <IconButton size="small" className="opt-act" aria-label={`Remove option ${idx + 1}`} onClick={() => removeOption(idx)} sx={{ transition: 'opacity 0.15s' }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
          <Button size="small" startIcon={<Add fontSize="small" />} onClick={addOption} sx={{ mt: 0.5, color: 'text.secondary' }}>
            Add option
          </Button>
        </>
      )}

      {(onDuplicate || (onDelete && !isSystem)) && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
            ACTIONS
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onDuplicate && (
              <Button fullWidth variant="outlined" size="small" onClick={onDuplicate}>
                Duplicate
              </Button>
            )}
            {onDelete && !isSystem && (
              <Button fullWidth variant="outlined" size="small" color="error" onClick={onDelete}>
                {deleteLabel}
              </Button>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
