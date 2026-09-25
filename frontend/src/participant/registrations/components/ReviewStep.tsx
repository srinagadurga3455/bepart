import { Fragment } from 'react';
import { Box, Typography, Button, Card, CardContent, Divider, List, ListItem, ListItemText, Accordion, AccordionSummary, AccordionDetails, IconButton } from '@mui/material';
import { ExpandMore, Edit, CheckCircle } from '@mui/icons-material';
import { findCountFieldName, getSelectedCount, getVisibleFields, withDynamicRequired, getMemberGroupIndex } from '../utils/memberGroups';
import type { FormDataRecord, FormStructure } from '../../../app/types';

interface ReviewStepProps {
  formStructure: FormStructure;
  formData: FormDataRecord;
  onBack: () => void;
  onEdit: (sectionIndex: number) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  confirmLabel?: string;
  feeAmount?: number | null;
}

export default function ReviewStep({ formStructure, formData, onBack, onEdit, onConfirm, isSubmitting, confirmLabel, feeAmount }: ReviewStepProps) {
  const sections = formStructure?.sections || [];
  // Show only the selected member groups (hidden groups are not submitted either)
  const selectedCount = getSelectedCount(formData, findCountFieldName(formStructure));

  const getFieldValue = (fieldName: string): string => {
    const value: unknown = formData[fieldName];
    if (Array.isArray(value)) {
      return value.join(', ') || '—';
    }
    if (typeof value === 'string') {
      return value || '—';
    }
    return '—';
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
          Review Your Registration
        </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Please verify all information before submitting.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <List sx={{ mb: 3 }}>
        {sections.map((section, sectionIndex) => (
          <Box key={section.id} sx={{ mb: 3 }}>
            <Typography variant="h6" color="text.primary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 600 }}>
              <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                {String(sectionIndex + 1).padStart(2, '0')}
              </span>
              {section.title}
            </Typography>
            <Accordion defaultExpanded>
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 } }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" color="text.secondary">
                    Click to review details
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                  {(() => {
                    let lastGroup = 0;
                    return getVisibleFields(section, selectedCount).map((rawField, fieldIndex) => {
                      const field = withDynamicRequired(rawField, selectedCount);
                      const group = getMemberGroupIndex(field.name);
                      const header = group > 0 && group !== lastGroup ? (
                        <Typography variant="subtitle2" color="text.primary" sx={{ mt: fieldIndex === 0 ? 0 : 1, fontWeight: 600 }}>
                          Member {group}
                        </Typography>
                      ) : null;
                      lastGroup = group;
                      return (
                        <Fragment key={`${section.id}-${field.name}-${fieldIndex}`}>
                          {header}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              {field.label} {field.required && <span color="error">*</span>}
                            </Typography>
                            <Typography variant="body1" color="text.primary" sx={{ fontFamily: 'monospace', background: 'grey.50', p: 1.5, borderRadius: 1 }}>
                              {getFieldValue(field.name)}
                            </Typography>
                          </Box>
                        </Fragment>
                      );
                    });
                  })()}
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        ))}
      </List>

      {feeAmount !== null && feeAmount !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3, p: 2, borderRadius: 2, bgcolor: 'grey.100' }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>Registration Fee</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>₹{feeAmount}</Typography>
        </Box>
      )}

      <Divider sx={{ my: 4 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="large"
          startIcon={<Edit />}
          onClick={onBack}
          sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}
        >
          Edit
        </Button>

        <Button
          variant="contained"
          size="large"
          endIcon={<CheckCircle />}
          onClick={onConfirm}
          disabled={isSubmitting}
          sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
        >
          {isSubmitting ? 'Confirming...' : (confirmLabel || 'Confirm Registration')}
        </Button>
      </Box>
    </Box>
  );
}
