import { useState } from 'react';
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react';
import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import type { SvgIconProps } from '@mui/material';
import {
  ArrowDownward, ArrowUpward, ArrowDropDownCircle, CheckBox, CheckBoxOutlineBlank,
  ContentCopy, Delete, DragIndicator, Email, MoreVert, Phone,
  RadioButtonChecked, RadioButtonUnchecked, ShortText, Subject,
} from '@mui/icons-material';
import { OPTION_TYPES } from '../utils/formBuilderUtils';
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
  return TYPE_META[type]?.label || type;
}

function AnswerPreview({ field }: { field: BuilderField }) {
  const meta = TYPE_META[field.type];
  if (field.type === 'textarea') {
    return (
      <Box sx={{ borderBottom: '1px dotted', borderColor: 'divider', color: 'text.disabled', fontSize: 13.5, py: 2, px: 0.5 }}>
        {meta.placeholder}
      </Box>
    );
  }
  if (field.type === 'radio' || field.type === 'checkbox') return null;
  return (
    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', color: 'text.disabled', fontSize: 13.5, py: 0.75, px: 0.5 }}>
      {meta?.placeholder || 'Answer'}
    </Box>
  );
}

function OptionPreview({ type, index, value }: { type: FormFieldType; index: number; value: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {type === 'radio' ? (
        <RadioButtonUnchecked sx={{ fontSize: 17, color: 'text.disabled' }} />
      ) : type === 'checkbox' ? (
        <CheckBoxOutlineBlank sx={{ fontSize: 17, color: 'text.disabled' }} />
      ) : (
        <Typography sx={{ fontSize: 13, color: 'text.disabled', width: 17, textAlign: 'center' }}>
          {index + 1}
        </Typography>
      )}
      <Typography noWrap sx={{ fontSize: 13.5, color: 'text.secondary' }}>
        {String(value || '').trim() || `Option ${index + 1}`}
      </Typography>
    </Box>
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

// Pure visual preview. ALL editing lives in the right inspector — the card
// never expands into an editor, keeping the canvas clean.
export default function QuestionCard({
  field, selected, error,
  onSelect, onDelete, onDuplicate,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: QuestionCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const openMenu = (e: ReactMouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };
  const closeMenu = () => setMenuAnchor(null);
  const menuAct = (fn: () => void) => { closeMenu(); fn(); };

  const TypeIcon = TYPE_META[field.type]?.icon || ShortText;
  const isSystem = !!field.system;
  const systemNote = field.system === 'phone'
    ? 'Required for ticket delivery'
    : field.system === 'name'
      ? 'Required for registration'
      : null;

  return (
    <Box
      onClick={() => { if (!selected) onSelect(); }}
      role="button"
      tabIndex={0}
      data-card-key={`q:${field.key}`}
      onKeyDown={(e) => { if (!selected && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(); } }}
      sx={{
        bgcolor: '#fff',
        border: '1px solid',
        borderColor: error ? 'error.main' : selected ? 'primary.main' : '#E4E7EC',
        borderRadius: 2,
        px: 2,
        py: 1.5,
        mb: 1,
        cursor: selected ? 'default' : 'pointer',
        boxShadow: selected ? '0 4px 14px rgba(37,87,245,0.10)' : '0 1px 2px rgba(16,24,40,0.05)',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
        '&:hover': selected ? {} : { borderColor: '#CBD2DC', bgcolor: '#FAFAF9' },
        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 1 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <DragIndicator sx={{ fontSize: 16, color: 'text.disabled', ml: -0.75, opacity: 0, transition: 'opacity 0.18s ease', '.MuiBox-root:hover &': { opacity: 0.9 } }} />
        <Typography noWrap sx={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0, color: field.label?.trim() ? 'text.primary' : 'text.disabled' }}>
          {field.label?.trim() || 'Untitled question'}
        </Typography>
        {isSystem ? (
          <Typography sx={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', color: 'primary.main', bgcolor: '#EAF1FF', borderRadius: 999, px: 1, py: 0.25, whiteSpace: 'nowrap' }}>
            SYSTEM
          </Typography>
        ) : field.required ? (
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' }}>Required</Typography>
        ) : null}
        <IconButton
          size="small"
          aria-label="Question actions"
          onClick={openMenu}
          sx={{ mr: -1, opacity: selected ? 1 : 0.4, transition: 'opacity 0.18s ease', '&:hover': { opacity: 1 } }}
        >
          <MoreVert sx={{ fontSize: 17 }} />
        </IconButton>
      </Box>
      {isSystem && systemNote && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{systemNote}</Typography>
      )}
      {field.description?.trim() ? (
        <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary', mt: 0.25 }}>{field.description.trim()}</Typography>
      ) : null}
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <TypeIcon sx={{ fontSize: 15 }} />
        {typeLabel(field.type)}
      </Typography>

      <Box sx={{ mt: 0.75 }}>
        <AnswerPreview field={field} />
        {OPTION_TYPES.includes(field.type) && (field.options || []).length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, mt: 0.5 }}>
            {(field.options || []).slice(0, 3).map((opt, idx) => (
              <OptionPreview key={idx} type={field.type} index={idx} value={opt} />
            ))}
            {(field.options || []).length > 3 && (
              <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>
                +{(field.options || []).length - 3} more
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {error && (
        <Typography sx={{ fontSize: 12.5, color: 'error.main', mt: 0.75 }}>{error}</Typography>
      )}

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 190 } } }}>
        <MenuItem onClick={() => menuAct(onDuplicate)} sx={{ fontSize: 13.5, gap: 1.25 }}>
          <ContentCopy fontSize="small" /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => menuAct(onMoveUp)} disabled={!canMoveUp} sx={{ fontSize: 13.5, gap: 1.25 }}>
          <ArrowUpward fontSize="small" /> Move up
        </MenuItem>
        <MenuItem onClick={() => menuAct(onMoveDown)} disabled={!canMoveDown} sx={{ fontSize: 13.5, gap: 1.25 }}>
          <ArrowDownward fontSize="small" /> Move down
        </MenuItem>
        {!isSystem && (
          <MenuItem onClick={() => menuAct(onDelete)} sx={{ fontSize: 13.5, gap: 1.25, color: 'error.main' }}>
            <Delete fontSize="small" /> Delete
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
