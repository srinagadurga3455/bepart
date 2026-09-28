import { Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container, Typography, Box, Button, Card, CardContent, Divider,
  Alert, Chip, Stack,
} from '@mui/material';
import {
  AccessTime, CheckCircle, ConfirmationNumber, Event as EventIcon,
  LocationOn, PersonOutlined, PrintOutlined, SupportAgentOutlined,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../api/tickets';
import ParticipantNavbar from '../../components/ParticipantNavbar';
import { BePartMark } from '../../../app/components/BePartBrand';
import { BEPART_SUPPORT } from '../../../app/config/support';
import { eventPoster } from '../../../app/types';
import {
  findCountFieldName, getSelectedCount, getVisibleFields,
  withDynamicRequired, getMemberGroupIndex,
} from '../../registrations/utils/memberGroups';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';
import type { FormDataRecord, FormDataValue } from '../../../app/types';

function formatDate(d: string | undefined): string {
  const dt = new Date(d ?? '');
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(d: string | undefined): string {
  const dt = new Date(d ?? '');
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
}

function formatValue(v: FormDataValue | undefined): string {
  if (Array.isArray(v)) return v.join(', ');
  return String(v ?? '—');
}

export default function TicketPage() {
  const { ticketId } = useParams();
  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.getTicket(ticketId!),
    enabled: !!ticketId,
    retry: false,
  });

  if (isLoading) {
    return (
      <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
        <ParticipantNavbar />
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <LoadingState message="Loading your ticket…" />
        </Container>
      </Box>
    );
  }

  if (error || !response?.data) {
    return (
      <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
        <ParticipantNavbar />
        <Container maxWidth="sm" sx={{ py: 4 }}>
          <ErrorState
            title="Ticket Not Found"
            message="This ticket does not exist or is no longer available."
            onRetry={() => refetch()}
          />
          <Button variant="contained" component={Link} to="/events" sx={{ mt: 2, borderRadius: 999, boxShadow: 'none' }}>
            Back to Events
          </Button>
        </Container>
      </Box>
    );
  }

  const ticket = response.data;
  // QR encodes the canonical public ticket URL (backend-provided), so a scan
  // always resolves to this ticket. The raw registration ID is never displayed.
  const ticketUrl = ticket.ticketUrl || `${window.location.origin}/ticket/${ticket.registrationId}`;
  const event = ticket.event;
  const poster = eventPoster(event);
  const formData: FormDataRecord = ticket.formData || {};
  const formStructure = event?.formStructure;
  const sections = formStructure?.sections || [];
  const selectedCount = getSelectedCount(formData, findCountFieldName(formStructure));
  const registrant = formData.teamName || formData.member1Name || formData.fullName || '—';
  const checkedIn = !!(ticket as { checkedInAt?: string | null }).checkedInAt;

  return (
    <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
      <Box sx={{ '@media print': { display: 'none' } }}>
        <ParticipantNavbar />
      </Box>

      <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap', '@media print': { display: 'none' } }}>
          <Button variant="outlined" startIcon={<PrintOutlined />} onClick={() => window.print()} sx={{ borderRadius: 999 }}>
            Print ticket
          </Button>
          <Button variant="text" component={Link} to="/events" sx={{ borderRadius: 999 }}>
            Back to Events
          </Button>
        </Box>

        {/* Ticket */}
        <Card elevation={3} sx={{ borderRadius: 4, overflow: 'hidden' }}>
          {/* Event artwork */}
          {poster ? (
            <Box component="img" src={poster} alt={`${event?.eventName} banner`}
              sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }} />
          ) : (
            <Box sx={{ bgcolor: '#2557F5', px: 3, py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <BePartMark size={30} fontSize={17} />
            </Box>
          )}

          {/* Confirmation band */}
          <Box sx={{ bgcolor: checkedIn ? '#15803D' : '#16A34A', color: 'white', px: 3, py: 3, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 44, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {checkedIn ? 'Checked In — Enjoy the Event!' : 'Registration Confirmed'}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.5 }}>
              {checkedIn
                ? `Checked in on ${formatDate((ticket as { checkedInAt?: string }).checkedInAt)} — show this ticket if asked.`
                : 'Show this ticket at the entry gate for a quick scan.'}
            </Typography>
          </Box>

          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Box sx={{ textAlign: 'center', mb: 2.5 }}>
              <Typography variant="h4" color="text.primary" gutterBottom sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                {event?.eventName || 'Event Ticket'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {registrant}
                {event?.organizer?.name ? `  ·  by ${event.organizer.name}` : ''}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1.5, flexWrap: 'wrap' }}>
                <Chip label={event?.status || 'CONFIRMED'} color="success" size="small" variant="outlined" />
                {checkedIn && <Chip label="CHECKED IN" color="success" size="small" />}
              </Box>
            </Box>

            <Divider sx={{ mb: 2.5, borderStyle: 'dashed' }} />

            {/* Date / time / venue */}
            <Stack direction="row" spacing={2} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140, flex: 1 }}>
                <EventIcon color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Date</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatDate(event?.date)}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140, flex: 1 }}>
                <AccessTime color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Time</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatTime(event?.date)}</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140, flex: 1 }}>
                <LocationOn color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Venue</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>See organizer updates</Typography>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140, flex: 1 }}>
                <PersonOutlined color="action" />
                <Box>
                  <Typography variant="caption" color="text.secondary">Ticket holder</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{registrant}</Typography>
                </Box>
              </Box>
            </Stack>

            <Divider sx={{ mb: 2.5, borderStyle: 'dashed' }} />

            {/* QR */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Box sx={{ bgcolor: '#FFFFFF', p: 2, borderRadius: 3, border: '2px solid', borderColor: 'divider', lineHeight: 0 }}>
                <QRCodeSVG
                  value={ticketUrl}
                  size={168}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="M"
                  includeMargin
                  title="Ticket verification QR code"
                />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Scan at entry</Typography>
              <Typography variant="caption" color="text.secondary">Entry QR · one scan per ticket</Typography>
            </Box>

            <Divider sx={{ mb: 2.5, borderStyle: 'dashed' }} />

            {/* Dynamic submitted details */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Registration Details</Typography>
            {sections.length === 0 && (
              <Alert severity="info" sx={{ mb: 2 }}>No additional details were collected for this event.</Alert>
            )}
            {sections.map((section) => {
              const fields = getVisibleFields(section, selectedCount)
                .map((f) => withDynamicRequired(f, selectedCount))
                .filter((f) => !isEmpty(formData[f.name]));
              if (fields.length === 0) return null;
              let lastGroup = 0;
              return (
                <Box key={section.id} sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle1" color="primary.main" gutterBottom sx={{ fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {fields.map((field, i) => {
                      const group = getMemberGroupIndex(field.name);
                      const header = group > 0 && group !== lastGroup ? (
                        <Typography variant="subtitle2" sx={{ mt: i === 0 ? 0 : 1, fontWeight: 700 }}>
                          Member {group}
                        </Typography>
                      ) : null;
                      lastGroup = group;
                      return (
                        <Fragment key={`${section.id}-${field.name}-${i}`}>
                          {header}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                            <Typography variant="body2" color="text.secondary">{field.label}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>
                              {formatValue(formData[field.name])}
                            </Typography>
                          </Box>
                        </Fragment>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}

            <Divider sx={{ my: 2.5, borderStyle: 'dashed' }} />

            {/* Instructions */}
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Good to know</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography component="li" variant="body2" color="text.secondary">Arrive 15–30 minutes early; entry closes at the published time.</Typography>
              <Typography component="li" variant="body2" color="text.secondary">Keep this ticket on your phone — screenshots of the QR also scan.</Typography>
              <Typography component="li" variant="body2" color="text.secondary">Each ticket admits one entry unless your registration covers a team.</Typography>
              <Typography component="li" variant="body2" color="text.secondary">Carry a valid college or government ID for verification.</Typography>
            </Box>

            <Alert severity="info" icon={<SupportAgentOutlined />} sx={{ mt: 2.5 }}>
              Need help with this ticket? Contact the BePart team at {BEPART_SUPPORT.email} or {BEPART_SUPPORT.phone} ({BEPART_SUPPORT.hours}).
            </Alert>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 3, opacity: 0.85 }}>
              <ConfirmationNumber sx={{ fontSize: 18, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">Issued by BePart · {BEPART_SUPPORT.email}</Typography>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
