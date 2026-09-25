import { Box, Button, Divider, FormControl, IconButton, InputLabel, MenuItem, Select, Tooltip, Typography } from '@mui/material';
import { Add, Delete, GroupAdd } from '@mui/icons-material';
import QuestionCard from './QuestionCard';

export default function MemberGroupCard({
  group, candidates, selected, selectedMemberKey, focusKey, error,
  onSelect, onSelectMember, onChange, onRemove,
  onAddField, onFieldChange, onFieldDuplicate, onFieldDelete, onFieldMove,
}) {
  const set = (patch) => onChange({ ...group, ...patch });
  const repeatLabel = candidates.find((c) => c.value === group.repeatFrom)?.field.label;

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
        <GroupAdd sx={{ color: 'primary.main', fontSize: 22, flexShrink: 0 }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography noWrap sx={{ fontSize: 15 }}>
            Team Member Group
          </Typography>
          <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary' }}>
            Repeats for each member{repeatLabel ? ` · ${repeatLabel}` : ''} · {(group.fields || []).length} fields
          </Typography>
        </Box>
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <GroupAdd sx={{ color: 'primary.main', fontSize: 22 }} />
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Team Member Group</Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1.5 }}>
        Define the fields once. Participants see one group per team member they select.
      </Typography>

      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel id="repeat-from-label">Repeat based on</InputLabel>
        <Select
          labelId="repeat-from-label"
          value={group.repeatFrom || ''}
          label="Repeat based on"
          onChange={(e) => set({ repeatFrom: e.target.value })}
          displayEmpty
        >
          <MenuItem value="" disabled>
            <Typography component="span" color="text.secondary" sx={{ fontSize: 14 }}>
              Select a number question (e.g. Number of Team Members)
            </Typography>
          </MenuItem>
          {candidates.map((c) => (
            <MenuItem key={`${c.sectionTitle}-${c.field.label}`} value={c.value} sx={{ fontSize: 14 }}>
              {c.field.label} ({c.sectionTitle})
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'text.secondary', mb: 1 }}>
        Fields for every member
      </Typography>

      {(group.fields || []).map((field, idx) => (
        <Box key={field.key} data-card-key={`q:${field.key}`}>
          <QuestionCard
            field={field}
            selected={selectedMemberKey === field.key}
            autoFocusLabel={focusKey === field.key}
            onSelect={() => onSelectMember(field.key)}
            onChange={(updated) => onFieldChange(idx, updated)}
            onDelete={() => onFieldDelete(idx)}
            onDuplicate={() => onFieldDuplicate(idx)}
            onMoveUp={() => onFieldMove(idx, -1)}
            onMoveDown={() => onFieldMove(idx, 1)}
            canMoveUp={idx > 0}
            canMoveDown={idx < group.fields.length - 1}
          />
        </Box>
      ))}

      <Button size="small" startIcon={<Add fontSize="small" />} onClick={onAddField} sx={{ color: 'text.secondary' }}>
        Add member field
      </Button>

      {error && (
        <Typography sx={{ fontSize: 12.5, color: 'error.main', mt: 1 }}>{error}</Typography>
      )}

      <Divider sx={{ my: 1.5 }} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title="Remove team member group">
          <IconButton size="small" aria-label="Remove team member group" onClick={onRemove}>
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Remove group</Typography>
      </Box>
    </Box>
  );
}
