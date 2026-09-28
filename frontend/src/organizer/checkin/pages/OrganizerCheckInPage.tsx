import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { CheckCircleOutlined, ErrorOutlined, QrCodeScannerOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import OrganizerShell from '../../components/OrganizerShell';
import QrScanner from '../components/QrScanner';
import { checkinApi } from '../api/checkin';
import { apiErrorMessage } from '../../../app/api/client';
import { formatEventDate } from '../../../app/utils/format';
import type { CheckInResult } from '../../../app/types';
import { orgCardSx, orgPrimaryButtonSx, orgSectionTitleSx } from '../../components/organizerStyles';
import { registrantName } from '../../../app/utils/registrations';

// Extract a bare registration id from pasted input: accepts a raw UUID or a
// full ticket URL (the QR encodes the canonical /ticket/:id URL).
export function extractTicketId(input: string): string {
  const clean = input.trim();
  if (!clean) return '';
  const m = /\/ticket\/([A-Za-z0-9-]+)\/?(?:\?.*)?$/.exec(clean);
  if (m?.[1]) return m[1];
  return clean;
}

function CheckInContent() {
  const { enqueueSnackbar } = useSnackbar();
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);

  const checkInById = async (ticketId: string) => {
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const res = await checkinApi.checkIn(ticketId);
      setResult(res.data);
      if (res.data.alreadyCheckedIn) {
        enqueueSnackbar(`Already checked in${res.data.checkedInAt ? ` at ${formatEventDate(res.data.checkedInAt)}` : ''}.`, { variant: 'warning' });
      } else {
        enqueueSnackbar('Check-in successful.', { variant: 'success' });
      }
    } catch (err) {
      const msg = apiErrorMessage(err, 'Ticket not recognized. Check the code and try again.');
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    const ticketId = extractTicketId(input);
    if (!ticketId) { setError('Enter a ticket ID or paste the ticket URL.'); return; }
    await checkInById(ticketId);
  };

  const handleCameraScan = async (raw: string) => {
    const ticketId = extractTicketId(raw);
    if (!ticketId) {
      const msg = 'Ticket not recognized — the QR did not contain a BePart ticket.';
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
      return;
    }
    setInput(raw);
    await checkInById(ticketId);
  };

  const undo = async () => {
    const ticketId = result?.registrationId || extractTicketId(input);
    if (!ticketId) return;
    setBusy(true);
    try {
      const res = await checkinApi.undo(ticketId);
      setResult(res.data);
      enqueueSnackbar('Check-in reverted.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Could not revert check-in.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Card variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>Check-in Scanner</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Open the event, scan the QR on the participant&apos;s ticket, and BePart verifies
            it instantly. Only tickets for your own events can be checked in.
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
                label="Ticket ID or ticket URL"
                placeholder="Paste scanned ticket link or ID"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') scan(); }}
                fullWidth
                size="small"
                sx={{ flex: '1 1 280px', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <Button variant="contained" startIcon={<QrCodeScannerOutlined />} onClick={scan} disabled={busy}
                sx={{ ...orgPrimaryButtonSx }}>
                {busy ? 'Checking…' : 'Check In'}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card
          variant="outlined"
          sx={{
            ...orgCardSx,
            borderColor: result.alreadyCheckedIn ? '#F59E0B' : '#16A34A',
            borderWidth: 2,
          }}
        >
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
              {result.alreadyCheckedIn ? (
                <ErrorOutlined sx={{ color: '#F59E0B', fontSize: 32 }} />
              ) : (
                <CheckCircleOutlined sx={{ color: '#16A34A', fontSize: 32 }} />
              )}
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {result.alreadyCheckedIn ? 'Already checked in' : 'Check-in successful'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {result.event?.eventName || 'Event ticket'}
                </Typography>
              </Box>
              <Chip
                label={result.alreadyCheckedIn ? 'Duplicate scan' : 'Valid ticket'}
                color={result.alreadyCheckedIn ? 'warning' : 'success'}
                sx={{ ml: 'auto' }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {[
                ['Participant', registrantName(result.formData)],
                ['Phone', result.phone || '—'],
                ['Checked in at', result.checkedInAt ? formatEventDate(result.checkedInAt) : '—'],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{v}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
              <Button variant="outlined" color="warning" onClick={undo} disabled={busy}>
                Revert check-in
              </Button>
              <Button variant="outlined" onClick={() => { setResult(null); setInput(''); }}>
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
