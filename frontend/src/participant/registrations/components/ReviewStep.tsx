import { Fragment } from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import { Edit, CheckCircle } from '@mui/icons-material';
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

const BLUE = '#2557F5';
const BLUE_DARK = '#1D46C8';
const INK = '#1E293B';
const MUTED = '#64748B';
const HAIRLINE = '#F1F5F9';

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
      {/* ── Heading ─────────────────────────────────────────── */}
      <Typography
        sx={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 800,
          fontSize: { xs: '1.2rem', sm: '1.35rem' },
          color: INK,
          letterSpacing: '-0.02em',
        }}
      >
        Review Your Registration
      </Typography>
      <Typography sx={{ fontSize: 14, color: MUTED, mt: 0.5, lineHeight: 1.6 }}>
        Please verify all information before submitting.
      </Typography>

      {/* ── Registration details ────────────────────────────── */}
      <Typography
        sx={{
          fontFamily: '"DM Sans", sans-serif',
          fontWeight: 800,
          fontSize: 16,
          color: INK,
          mt: 3.5,
        }}
      >
        Registration Details
      </Typography>
      <Divider sx={{ mt: 1, mb: 0.5, borderColor: '#E2E8F0' }} />

      {sections.map((section) => {
        const fields = getVisibleFields(section, selectedCount);
        if (fields.length === 0) return null;
        let lastGroup = 0;
        return (
          <Box key={section.id}>
            {sections.length > 1 && section.title && (
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: INK, mt: 2.5, mb: 0.5 }}>
                {section.title}
              </Typography>
            )}
            {fields.map((rawField, fieldIndex) => {
              const field = withDynamicRequired(rawField, selectedCount);
              const group = getMemberGroupIndex(field.name);
              const header = group > 0 && group !== lastGroup ? (
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: INK, mt: fieldIndex === 0 ? 1.5 : 2 }}>
                  Member {group}
                </Typography>
              ) : null;
              lastGroup = group;
              const isLast = fieldIndex === fields.length - 1;
              return (
                <Fragment key={`${section.id}-${field.name}-${fieldIndex}`}>
                  {header}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 0.25,
                      py: 1.5,
                      ...(isLast ? {} : { borderBottom: '1px solid', borderColor: HAIRLINE }),
                    }}
                  >
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: MUTED }}>
                      {field.label}{' '}
                      {field.required && (
                        <Box component="span" sx={{ color: '#DC2626' }}>
                          *
                        </Box>
                      )}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: INK,
                        lineHeight: 1.55,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {getFieldValue(field.name)}
                    </Typography>
                  </Box>
                </Fragment>
              );
            })}
          </Box>
        );
      })}

      {feeAmount !== null && feeAmount !== undefined && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mt: 2.5,
            p: 2,
            borderRadius: 2.5,
            bgcolor: '#EEF2FF',
            border: '1px solid #C7D5FD',
          }}
        >
          <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: INK }}>Registration Fee</Typography>
          <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: INK }}>₹{feeAmount}</Typography>
        </Box>
      )}

      {/* ── Action bar ──────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1.5,
          mt: 3.5,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Button
          variant="outlined"
          size="large"
          startIcon={<Edit />}
          onClick={onBack}
          sx={{
            px: 4,
            py: 1.4,
            fontWeight: 700,
            fontSize: 15,
            borderRadius: 2.5,
            textTransform: 'none',
            width: { xs: '100%', sm: 'auto' },
            borderColor: BLUE,
            color: BLUE,
            '&:hover': { borderColor: BLUE_DARK, color: BLUE_DARK, bgcolor: '#EEF2FF' },
          }}
        >
          Edit
        </Button>

        <Button
          variant="contained"
          size="large"
          endIcon={<CheckCircle />}
          onClick={onConfirm}
          disabled={isSubmitting}
          sx={{
            px: 4,
            py: 1.4,
            fontWeight: 700,
            fontSize: 15,
            borderRadius: 2.5,
            textTransform: 'none',
            width: { xs: '100%', sm: 'auto' },
            bgcolor: BLUE,
            boxShadow: 'none',
            '&:hover': { bgcolor: BLUE_DARK, boxShadow: '0 8px 20px -8px rgba(37,87,245,0.55)' },
            '&.Mui-disabled': { bgcolor: '#93A8F4', color: '#fff' },
          }}
        >
          {isSubmitting ? 'Confirming...' : (confirmLabel || 'Confirm Registration')}
        </Button>
      </Box>
    </Box>
  );
}
