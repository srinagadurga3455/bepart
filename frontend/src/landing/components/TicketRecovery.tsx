import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, Grid, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmationNumber } from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { ticketsApi } from '../../participant/tickets/api/tickets';
import { apiErrorMessage, unwrapList } from '../../app/api/client';
import type { PhoneTicketItem } from '../../app/types';

type LookupState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

function formatDateTime(iso: string | undefined): string {
  const d = new Date(iso ?? '');
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function TicketResultCard({ ticket }: { ticket: PhoneTicketItem }) {
  const navigate = useNavigate();
  const event = ticket.event;
  const ticketUrl = ticket.ticketUrl || `${window.location.origin}/ticket/${ticket.registrationId}`;
  return (
    <Card sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>
          {event?.eventName || 'Event'}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
          {formatDateTime(event?.date)}
          {event?.organizer?.name ? ` · by ${event.organizer.name}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip label={ticket.paymentStatus || 'CONFIRMED'} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
        </Box>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          Ticket ID: {ticket.registrationId}
        </Typography>
        <Box sx={{ display: 'grid', placeItems: 'center', py: 1.5 }}>
          <Box sx={{ bgcolor: '#fff', p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider', lineHeight: 0 }}>
            <QRCodeSVG value={ticketUrl} size={120} level="M" includeMargin title={`Ticket QR for ${event?.eventName || ticket.registrationId}`} />
          </Box>
        </Box>
        <Button
          variant="contained"
          onClick={() => navigate(`/ticket/${ticket.registrationId}`)}
          sx={{ borderRadius: 999, boxShadow: 'none', mt: 'auto' }}
        >
          Open Ticket
        </Button>
      </CardContent>
    </Card>
  );
}

// Ticket recovery strip: participants enter their registered mobile number
// to see ALL of their tickets (no OTP — direct lookup).
function TicketRecovery() {
  const [phone, setPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [state, setState] = useState<LookupState>('idle');
  const [tickets, setTickets] = useState<PhoneTicketItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const lookup = async () => {
    const value = phone.trim();
    if (!value) {
      setValidationError('Please enter your registered mobile number.');
      return;
    }
    if (value.replace(/\D/g, '').length < 10) {
      setValidationError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setValidationError(null);
    setState('loading');
    try {
      const res = await ticketsApi.getTicketsByPhone(value);
      const list = unwrapList<PhoneTicketItem>(res);
      setTickets(list);
      setState(list.length === 0 ? 'empty' : 'success');
    } catch (err) {
      setState('error');
      setErrorMsg(apiErrorMessage(err, 'Could not load your tickets. Please try again.'));
    }
  };

  return (
    <Box component="section" id="find-my-ticket" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 }, scrollMarginTop: 80 }}>
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: '#EAF1FF', borderRadius: { xs: 4, md: 6 }, px: { xs: 3, md: 5 }, py: { xs: 4, md: 4.5 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 4 }}
            sx={{ textAlign: { xs: 'center', md: 'left' }, alignItems: { xs: 'center', md: 'center' } }}
          >
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: '#DCE6FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ConfirmationNumber sx={{ fontSize: 34, color: 'primary.main' }} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 21, md: 24 }, letterSpacing: '-0.04em' }}>
                Already registered?
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14.5, mt: 0.5 }}>
                Enter your registered mobile number to view your tickets.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', width: { xs: '100%', md: 'auto' } }}>
              <TextField
                size="small"
                label="Registered Mobile Number"
                placeholder="Enter your registered mobile number"
                value={phone}
                type="tel"
                onChange={(e) => { setPhone(e.target.value); if (validationError) setValidationError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void lookup(); }}
                error={!!validationError}
                helperText={validationError || undefined}
                sx={{ bgcolor: '#fff', borderRadius: 2, minWidth: { xs: '100%', sm: 240 } }}
              />
              <Button
                variant="contained"
                disabled={!phone.trim() || state === 'loading'}
                onClick={() => void lookup()}
                sx={{ borderRadius: 999, boxShadow: 'none' }}
              >
                View My Tickets
              </Button>
            </Box>
          </Stack>

          {state === 'loading' && (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
              <CircularProgress size={32} />
            </Box>
          )}

          {state === 'error' && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {errorMsg}
            </Alert>
          )}

          {state === 'empty' && (
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography sx={{ fontWeight: 700 }}>No registrations found</Typography>
              <Typography sx={{ fontSize: 13.5 }}>We couldn&apos;t find any tickets registered with this mobile number.</Typography>
            </Alert>
          )}

          {state === 'success' && (
            <Box sx={{ mt: 3 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.5 }}>
                My Tickets
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 13.5, mb: 2 }}>
                {tickets.length} registration{tickets.length === 1 ? '' : 's'} found for this mobile number.
              </Typography>
              <Grid container spacing={2}>
                {tickets.map((ticket) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={ticket.registrationId}>
                    <TicketResultCard ticket={ticket} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
}

export default TicketRecovery;
