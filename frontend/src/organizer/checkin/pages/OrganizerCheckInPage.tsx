import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { CheckCircleOutlined, ErrorOutlined, QrCodeScannerOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import OrganizerShell from '../../components/OrganizerShell';
import QrScanner from '../components/QrScanner';
import { checkinApi, checkinErrorMessage, type CheckInSuccess, type TicketValidation } from '../api/checkin';
import { formatEventDate } from '../../../app/utils/format';
import { orgCardSx, orgPrimaryButtonSx, orgSectionTitleSx } from '../../components/organizerStyles';
import { registrantName } from '../../../app/utils/registrations';

// Accepts a raw ticket code/token, a full ticket URL, or a legacy
// /ticket/:registrationId URL (the QR encodes the canonical ticket URL).
export function extractTicketId(input: string): string {
  const clean = input.trim();
  return clean;
}

type Phase = 'input' | 'validating' | 'confirm' | 'checking' | 'done';

function CheckInContent() {
  const { enqueueSnackbar } = useSnackbar();
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [error, setError] = useState('');
  const [validation, setValidation] = useState<TicketValidation | null>(null);
  const [result, setResult] = useState<CheckInSuccess | null>(null);
  const busy = phase === 'validating' || phase === 'checking';

  const reset = (keepInput = false) => {
    setPhase('input');
    setError('');
    setValidation(null);
    setResult(null);
    if (!keepInput) setInput('');
  };

  const validate = async (raw: string) => {
    const ticket = raw.trim();
    if (!ticket) {
      setError('Enter a ticket code, or paste the ticket URL.');
      return;
    }
    setError('');
    setValidation(null);
    setResult(null);
    setPhase('validating');
    try {
      const res = await checkinApi.validate(ticket);
      setValidation(res.data);
      setPhase('confirm');
    } catch (err) {
      setPhase('input');
      const msg = checkinErrorMessage(err);
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const confirmCheckIn = async () => {
    if (!validation) return;
    setError('');
    setPhase('checking');
    try {
      const res = await checkinApi.checkInTicket(validation.ticket.code);
      setResult(res.data);
      setPhase('done');
      enqueueSnackbar('Check-in successful.', { variant: 'success' });
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = checkinErrorMessage(err);
      setError(msg);
      enqueueSnackbar(msg, { variant: status === 409 ? 'warning' : 'error' });
      setPhase('confirm');
    }
  };

  const handleCameraScan = async (raw: string) => {
    if (busy) return;
    if (!raw.trim()) {
      const msg = 'Ticket not recognized — the QR did not contain a BePart ticket.';
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
      return;
    }
    setInput(raw.trim());
    await validate(raw);
  };

  const participant = validation
    ? validation.registration.participantName !== '—'
      ? validation.registration.participantName
      : registrantName(validation.registration.formData as never)
    : '—';

  return (
    <Box>
      <Card variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>Check-in Scanner</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Scan the QR on the participant&apos;s ticket (or enter the code manually), verify the
            details, then confirm. Only tickets for your own events can be checked in.
          </Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 2 }}>
            <Tab value="camera" label="Camera" icon={<QrCodeScannerOutlined fontSize="small" />} iconPosition="start" sx={{ minHeight: 40 }} />
            <Tab value="manual" label="Manual entry" sx={{ minHeight: 40 }} />
          </Tabs>
          {mode === 'camera' ? (
            <QrScanner onScan={handleCameraScan} disabled={busy} />
          ) : (
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label="Ticket code or ticket URL"
                placeholder="Paste ticket link, code, or token"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') validate(input); }}
                fullWidth
                size="small"
                disabled={busy}
                sx={{ flex: '1 1 280px', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <Button variant="contained" startIcon={busy ? undefined : <QrCodeScannerOutlined />} onClick={() => validate(input)} disabled={busy}
                sx={{ ...orgPrimaryButtonSx }}>
                {busy ? 'Validating…' : 'Validate'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {phase === 'validating' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 2 }}>
          <CircularProgress size={22} />
          <Typography variant="body2" color="text.secondary">Validating ticket…</Typography>
        </Box>
      )}

      {validation && (phase === 'confirm' || phase === 'checking') && (
        <Card
          variant="outlined"
          sx={{ ...orgCardSx, borderColor: validation.checkedIn ? '#F59E0B' : '#16A34A', borderWidth: 2 }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
              {validation.checkedIn ? (
                <ErrorOutlined sx={{ color: '#F59E0B', fontSize: 32 }} />
              ) : (
                <CheckCircleOutlined sx={{ color: '#16A34A', fontSize: 32 }} />
              )}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {validation.checkedIn ? 'Already checked in' : 'Valid ticket — confirm check-in'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {validation.event?.eventName || 'Event ticket'}
                </Typography>
              </Box>
              <Chip
                label={validation.checkedIn ? 'Duplicate scan' : validation.ticket.status}
                color={validation.checkedIn ? 'warning' : 'success'}
                sx={{ ml: 'auto' }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                ['Participant', participant],
                ['Phone', validation.registration.phone || '—'],
                ['Ticket ID', validation.ticket.code],
                ['Payment', validation.registration.paymentStatus || '—'],
                ...(validation.checkedIn && validation.ticket.checkedInAt
                  ? [['Checked in at', formatEventDate(validation.ticket.checkedInAt)] as [string, string]]
                  : []),
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}>{v}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
              {!validation.checkedIn && (
                <Button variant="contained" color="success" onClick={confirmCheckIn} disabled={busy}
                  sx={{ ...orgPrimaryButtonSx, boxShadow: 'none' }}>
                  {phase === 'checking' ? 'Checking in…' : 'Confirm Check In'}
                </Button>
              )}
              <Button variant="outlined" onClick={() => reset()} disabled={busy}>
                Scan next ticket
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {result && phase === 'done' && (
        <Card variant="outlined" sx={{ ...orgCardSx, borderColor: '#16A34A', borderWidth: 2, mt: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <CheckCircleOutlined sx={{ color: '#16A34A', fontSize: 32 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>Check-in successful</Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.event?.eventName || 'Event ticket'}
                </Typography>
              </Box>
              <Chip label="CHECKED IN" color="success" sx={{ ml: 'auto' }} />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                ['Participant', result.participantName || '—'],
                ['Ticket ID', result.ticketId || '—'],
                ['Checked in at', result.checkedInAt ? formatEventDate(result.checkedInAt) : '—'],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{v}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5 }}>
              <Button variant="outlined" onClick={() => reset()}>
                Scan next ticket
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default function OrganizerCheckInPage() {
  return (
    <OrganizerShell title="Check-In" subtitle="Validate tickets at event entry." hideSearch hideCreate>
      <CheckInContent />
    </OrganizerShell>
  );
}
