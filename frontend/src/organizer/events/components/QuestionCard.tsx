import { useState } from 'react';
import type { ComponentType } from 'react';
import { Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Switch, TextField, Tooltip, Typography } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import {
  Add, ArrowDownward, ArrowUpward, ArrowDropDownCircle, CheckBox, CheckBoxOutlineBlank,
  ContentCopy, Delete, Email, Phone, RadioButtonChecked, RadioButtonUnchecked,
  ShortText, Subject,
} from '@mui/icons-material';
import { BUILDER_TYPES, OPTION_TYPES } from '../utils/formBuilderUtils';
import type { BuilderField } from '../utils/formBuilderUtils';
import type { FormFieldType } from '../../../app/types';

type FieldIcon = ComponentType<SvgIconProps>;

export const TYPE_META: Record<FormFieldType, { label: string; icon: FieldIcon; placeholder: string | null }> = {
  text: { label: 'Short answer', icon: ShortText, placeholder: 'Short-answer text' },
  textarea: { label: 'Long answer', icon: Subject, placeholder: 'Long-answer text' },
  email: { label: 'Email', icon: Email, placeholder: 'Email address' },
  tel: { label: 'Phone', icon: Phone, placeholder: 'Phone number' },
  dropdown: { label: 'Dropdown', icon: ArrowDropDownCircle, placeholder: 'Choose' },
  radio: { label: 'Multiple choice', icon: RadioButtonChecked, placeholder: null },
  checkbox: { label: 'Checkboxes', icon: CheckBox, placeholder: null },
};

function typeLabel(type: FormFieldType): string {
  return TYPE_META[type]?.label || BUILDER_TYPES.find((t) => t.value === type)?.label || type;
}

function AnswerPreview({ field }: { field: BuilderField }) {
  const meta = TYPE_META[field.type];
  if (field.type === 'textarea') {
    return (
      <Box sx={{ borderBottom: '1px dotted', borderColor: 'divider', color: 'text.disabled', fontSize: 14, py: 2.5, px: 0.5 }}>
        {meta.placeholder}
      </Box>
    );
  }
  if (field.type === 'radio' || field.type === 'checkbox') return null;
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', color: 'text.disabled', fontSize: 14, py: 1, px: 0.5 }}>
      {meta?.placeholder || 'Answer'}
    </Box>
  );
}

function OptionBullet({ type, index }: { type: FormFieldType; index: number }) {
  if (type === 'radio') return <RadioButtonUnchecked sx={{ fontSize: 20, color: 'text.disabled' }} />;
  if (type === 'checkbox') return <CheckBoxOutlineBlank sx={{ fontSize: 20, color: 'text.disabled' }} />;
  return (
    <Typography sx={{ fontSize: 14, color: 'text.disabled', width: 20, textAlign: 'center' }}>
      {index + 1}
    </Typography>
  );
}

export interface QuestionCardProps {
  field: BuilderField;
  selected: boolean;
  autoFocusLabel: boolean;
  error?: string | null;
  onSelect: () => void;
  onChange: (updated: BuilderField) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export default function QuestionCard({
  field, selected, autoFocusLabel, error,
  onSelect, onChange, onDelete, onDuplicate,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: QuestionCardProps) {
  const set = (patch: Partial<BuilderField>) => onChange({ ...field, ...patch });

  const [freshOptIdx, setFreshOptIdx] = useState(-1);

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

  const handleTypeChange = (type: FormFieldType) => {
    const patch: Partial<BuilderField> = { type };
    if (!OPTION_TYPES.includes(type)) patch.options = [];
    else if (!field.options || field.options.length === 0) patch.options = ['Option 1'];
    set(patch);
  };

  const TypeIcon = TYPE_META[field.type]?.icon || ShortText;

  if (!selected) {
    return (
      <Box
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
        sx={{
          bgcolor: '#fff',
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 2,
          px: 2.5,
          py: 1.75,
          mb: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          '&:hover': { borderColor: 'text.disabled', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: 15, color: field.label?.trim() ? 'text.primary' : 'text.disabled' }}>
            {field.label?.trim() || 'Untitled question'}
          </Typography>
        </Box>
        <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <TypeIcon sx={{ fontSize: 16 }} />
          {typeLabel(field.type)}
        </Typography>
        {field.required && (
          <Typography sx={{ fontSize: 13, color: 'error.main', fontWeight: 600 }}>*</Typography>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: error ? 'error.main' : 'divider',
        borderLeft: '4px solid',
        borderLeftColor: error ? 'error.main' : 'primary.main',
        borderRadius: 2,
        px: 2.5,
        py: 2,
        mb: 1.5,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
        <TextField
          value={field.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="Question"
          autoFocus={!!autoFocusLabel}
          variant="standard"
          fullWidth
          error={!!error}
          slotProps={{ input: { sx: { fontSize: 17, py: 0.5 } } }}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 170, flexShrink: 0 }}>
          <InputLabel id={`${field.key}-type-label`}>Type</InputLabel>
          <Select
            labelId={`${field.key}-type-label`}
            value={field.type}
            label="Type"
            onChange={(e) => handleTypeChange(e.target.value as FormFieldType)}
          >
            {BUILDER_TYPES.map((t) => {
              const Icon = TYPE_META[t.value]?.icon || ShortText;
              return (
                <MenuItem key={t.value} value={t.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    {t.label}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <AnswerPreview field={field} />
      </Box>

      {OPTION_TYPES.includes(field.type) && (
        <Box sx={{ mt: 1 }}>
          {(field.options || []).map((opt, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.25,
                '& .opt-del': { opacity: 0 },
                '&:hover .opt-del, &:focus-within .opt-del': { opacity: 1 },
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
              <IconButton
                size="small"
                className="opt-del"
                aria-label={`Remove option ${idx + 1}`}
                onClick={() => removeOption(idx)}
                sx={{ transition: 'opacity 0.15s' }}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<Add fontSize="small" />} onClick={addOption} sx={{ mt: 0.5, color: 'text.secondary' }}>
            Add option
          </Button>
        </Box>
      )}

      {error && (
        <Typography sx={{ fontSize: 12.5, color: 'error.main', mt: 1 }}>{error}</Typography>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
        <Tooltip title="Duplicate question">
          <IconButton size="small" aria-label="Duplicate question" onClick={onDuplicate}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete question">
          <IconButton size="small" aria-label="Delete question" onClick={onDelete}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 1, my: 0.5 }} />
        <Typography sx={{ fontSize: 13 }}>Required</Typography>
        <Switch size="small" checked={!!field.required} onChange={(e) => set({ required: e.target.checked })} slotProps={{ input: { 'aria-label': 'Required' } }} />
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Move up">
          <span>
            <IconButton size="small" aria-label="Move question up" disabled={!canMoveUp} onClick={onMoveUp}>
              <ArrowUpward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Move down">
          <span>
            <IconButton size="small" aria-label="Move question down" disabled={!canMoveDown} onClick={onMoveDown}>
              <ArrowDownward fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    </Box>
  );
}
