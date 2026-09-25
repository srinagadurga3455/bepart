import { Fragment } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Container, Typography, Box, Button, Card, CardContent, Divider,
  CircularProgress, Alert, Chip, Stack,
} from '@mui/material';
import { CheckCircle, ConfirmationNumber, Event as EventIcon, AccessTime } from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';
import { ticketsApi } from '../api/tickets';
import {
  findCountFieldName, getSelectedCount, getVisibleFields,
  withDynamicRequired, getMemberGroupIndex,
} from '../../registrations/utils/memberGroups';
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
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => ticketsApi.getTicket(ticketId!),
    enabled: !!ticketId,
    retry: false,
  });

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography color="text.secondary">Loading your ticket…</Typography>
      </Container>
    );
  }

  if (error || !response?.data) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Card elevation={0} variant="outlined" sx={{ borderRadius: 3, textAlign: 'center', p: 2 }}>
          <CardContent sx={{ py: 5 }}>
            <ConfirmationNumber sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Ticket Not Found</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              This ticket does not exist or is no longer available.
            </Typography>
            <Button variant="contained" component={Link} to="/events" sx={{ mt: 1 }}>
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const ticket = response.data;
  // QR encodes the canonical public ticket URL (backend-provided), so a scan
  // always resolves to this ticket. The raw registration ID is never displayed.
  const ticketUrl = ticket.ticketUrl || `${window.location.origin}/ticket/${ticket.registrationId}`;
  const event = ticket.event;
  const formData: FormDataRecord = ticket.formData || {};
  const formStructure = event?.formStructure;
  const sections = formStructure?.sections || [];
  const selectedCount = getSelectedCount(formData, findCountFieldName(formStructure));
  const registrant = formData.teamName || formData.member1Name || formData.fullName || '—';

  return (
    <Box sx={{ bgcolor: 'grey.100', minHeight: '100vh', py: { xs: 3, md: 6 } }}>
      <Container maxWidth="sm">
        <Card elevation={3} sx={{ borderRadius: 3, overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ bgcolor: 'success.main', color: 'white', px: 3, py: 4, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Registration Confirmed</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Your registration has been successfully confirmed.
            </Typography>
          </Box>

          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            {/* Event title block */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="h4" color="text.primary" gutterBottom sx={{ fontWeight: 800 }}>
                {event?.eventName || 'Event Ticket'}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {registrant}
                {event?.organizer?.name ? `  ·  by ${event.organizer.name}` : ''}
              </Typography>
              <Chip
                label={event?.status || 'CONFIRMED'}
                color="success"
                size="small"
                variant="outlined"
                sx={{ mt: 1.5 }}
              />
            </Box>

            <Divider sx={{ mb: 3 }} />

            {/* Meta */}
            <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 140, flex: 1 }}>
                <Box
                  sx={{
                    bgcolor: '#FFFFFF',
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    lineHeight: 0,
                    flexShrink: 0,
                  }}
                >
                  <QRCodeSVG
                    value={ticketUrl}
                    size={104}
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                    level="M"
                    includeMargin
                    title="Ticket verification QR code"
                  />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">Scan to verify</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Entry QR</Typography>
                </Box>
              </Box>
            </Stack>

            <Divider sx={{ mb: 3 }} />

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
                <Box key={section.id} sx={{ mb: 3 }}>
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

            <Divider sx={{ my: 3 }} />

            <Alert severity="success" variant="outlined" sx={{ mb: 3 }}>
              Your ticket is ready. Please keep it accessible for entry at the event.
            </Alert>

            <Button variant="outlined" fullWidth component={Link} to="/events">
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
