import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { FormDataRecord, FormStructure, RegistrationItem } from '../../../app/types';
import { formatEventDate } from '../../../app/utils/format';
import { registrantName } from '../../events/utils/eventData';

function isEmptyValue(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
}

function formatValue(v: FormDataRecord[string]): string {
  if (Array.isArray(v)) return v.join(', ');
  return String(v ?? '—');
}

// Renders one registration's submitted values using the event's own
// form structure (never hardcoded fields). Shared by the event detail
// table and the organizer registrations page.
export function RegistrationFormData({
  formStructure,
  formData,
}: {
  formStructure: FormStructure | null | undefined;
  formData: FormDataRecord | null | undefined;
}) {
  const sections = formStructure?.sections || [];
  if (sections.length === 0) {
    const entries = Object.entries(formData || {});
    if (entries.length === 0) {
      return <Typography variant="body2" color="text.secondary">No submitted details.</Typography>;
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {entries.map(([k, v]) => (
          <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">{k}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{formatValue(v)}</Typography>
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {sections.map((section) => {
        const fields = (section.fields || []).filter((f) => !isEmptyValue(formData?.[f.name]));
        if (fields.length === 0) return null;
        return (
          <Box key={section.id}>
            <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>{section.title}</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {fields.map((f) => (
                <Box key={f.name} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{f.label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{formatValue(formData?.[f.name])}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function PaymentStatusChip({ status }: { status: string | null | undefined }) {
  const color = status === 'PAID' ? 'success' : status === 'FAILED' ? 'error' : 'warning';
  return <Chip label={status || 'PENDING'} size="small" variant="outlined" color={color} />;
}

export function CheckInChip({ checkedInAt }: { checkedInAt: string | null | undefined }) {
  return checkedInAt
    ? <Chip label="Checked in" size="small" color="success" />
    : <Chip label="Not checked in" size="small" variant="outlined" />;
}

// Full registration detail in a dialog: participant, payment, check-in state
// plus the dynamic submitted form data.
export function RegistrationDetailDialog({
  open,
  registration,
  formStructure,
  onClose,
}: {
  open: boolean;
  registration: RegistrationItem | null;
  formStructure: FormStructure | null | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      sx={{ '& .MuiDialog-paper': { m: { xs: 1.5 }, borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>Registration detail</DialogTitle>
      <DialogContent dividers>
        {!registration ? (
          <Typography color="text.secondary">No registration selected.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <PaymentStatusChip status={registration.paymentStatus} />
              <CheckInChip checkedInAt={registration.checkedInAt} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Registrant</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{registrantName(registration.formData)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Phone</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{registration.phone}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Registered on</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatEventDate(registration.createdAt)}</Typography>
            </Box>
            {registration.checkedInAt && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">Checked in at</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatEventDate(registration.checkedInAt)}</Typography>
              </Box>
            )}
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
              <RegistrationFormData formStructure={formStructure} formData={registration.formData} />
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
