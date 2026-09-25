import { Box, Typography, Divider } from '@mui/material';
import type { UseFormRegister, FieldValues } from 'react-hook-form';
import DynamicField from './DynamicField';
import type { FormSectionDef } from '../../../app/types';

interface FormSectionProps {
  section: FormSectionDef;
  index: number;
  register?: UseFormRegister<FieldValues>;
}

export default function FormSection({ section, index, register }: FormSectionProps) {
  return (
    <Box key={section.id} sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            bgcolor: 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '0.875rem',
            flexShrink: 0,
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </Box>
        <Typography variant="h6" color="text.primary" sx={{ fontWeight: 600 }}>
          {section.title}
        </Typography>
      </Box>
      {section.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, ml: '37.5px' }}>
          {section.description}
        </Typography>
      )}
      <Box sx={{ ml: '37.5px', borderLeft: '2px solid', borderColor: 'divider', pl: 3 }}>
        {section.fields?.map((field, fieldIndex) => (
          <DynamicField key={`${section.id}-${field.name}-${fieldIndex}`} field={field} register={register} />
        ))}
      </Box>
      <Divider sx={{ my: 3, opacity: 0.3 }} />
    </Box>
  );
}
