import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Avatar, Box, Button, Card, CardContent, Chip, Container, Divider,
  Grid, TextField, Typography,
} from '@mui/material';
import {
  CalendarMonthOutlined, ConfirmationNumberOutlined, EventAvailableOutlined,
  HistoryOutlined, LoginOutlined, PersonOutlined,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import ParticipantNavbar from '../../components/ParticipantNavbar';
import { useAuth } from '../../../auth/components/RequireRole';
import { registrationsApi } from '../../registrations/api/registrations';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import { formatEventDate } from '../../../app/utils/format';
import { eventPoster } from '../../../app/types';
import type { RegistrationItem } from '../../../app/types';
import { registrantName } from '../../../app/utils/registrations';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: '#EAF1FF', color: '#2557F5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{label}</Typography>
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function RegistrationCard({ registration, onCancel }: { registration: RegistrationItem; onCancel: (r: RegistrationItem) => void }) {
  const event = registration.event;
  const poster = eventPoster(event);
  const past = event?.date ? new Date(event.date).getTime() < Date.now() : false;
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {poster && (
        <Box component="img" src={poster} alt={`${event?.eventName} poster`}
          sx={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
      )}
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label={past ? 'Past' : 'Upcoming'} size="small" color={past ? 'default' : 'success'} variant={past ? 'outlined' : 'filled'} />
          {registration.paymentStatus && registration.paymentStatus !== 'PENDING' && (
            <Chip label={registration.paymentStatus} size="small" variant="outlined" color={registration.paymentStatus === 'PAID' ? 'success' : 'error'} />
          )}
          {registration.checkedInAt && <Chip label="Checked in" size="small" color="success" />}
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>{event?.eventName || 'Event'}</Typography>
        <Typography variant="body2" color="text.secondary">
          {registrantName(registration.formData)} · {event?.date ? formatEventDate(event.date) : '—'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 'auto', pt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" variant="contained" component={RouterLink} to={`/ticket/${registration.registrationId}`}
            sx={{ borderRadius: 999, boxShadow: 'none' }}>
            View Ticket
          </Button>
          {!past && (
            <Button size="small" color="error" onClick={() => onCancel(registration)}>
              Cancel
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function GuestView() {
  const navigate = useNavigate();
  const [ticketId, setTicketId] = useState('');
  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', mb: 1 }}>
        My Tickets
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Sign in to see all your registrations, or open a ticket directly with its ID.
      </Typography>
      <Card variant="outlined" sx={{ borderRadius: 3, mb: 2.5 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
          <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Find a ticket</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField label="Ticket ID" value={ticketId} onChange={(e) => setTicketId(e.target.value)}
              size="small" sx={{ flex: '1 1 240px' }} placeholder="Paste your ticket ID" />
            <Button variant="contained" disabled={!ticketId.trim()} onClick={() => navigate(`/ticket/${ticketId.trim()}`)}
              sx={{ borderRadius: 999, boxShadow: 'none' }}>
              Open Ticket
            </Button>
          </Box>
        </CardContent>
      </Card>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <Button variant="contained" startIcon={<LoginOutlined />} component={RouterLink} to="/login" sx={{ borderRadius: 999, boxShadow: 'none' }}>
          Sign In
        </Button>
        <Button variant="outlined" component={RouterLink} to="/events" sx={{ borderRadius: 999 }}>
          Browse Events
        </Button>
      </Box>
    </Container>
  );
}

function DashboardContent() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const [cancelTarget, setCancelTarget] = useState<RegistrationItem | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['registrations', 'own'],
    queryFn: () => registrationsApi.list(),
    enabled: !!user,
  });
  const all: RegistrationItem[] = useMemo(() => (data ? unwrapList<RegistrationItem>(data) : []), [data]);
  const upcoming = useMemo(
    () => all.filter((r) => !r.event?.date || new Date(r.event.date).getTime() >= Date.now()),
    [all],
  );
  const past = useMemo(
    () => all.filter((r) => r.event?.date && new Date(r.event.date).getTime() < Date.now()),
    [all],
  );

  const doCancel = async () => {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await registrationsApi.cancel(cancelTarget.registrationId);
      queryClient.invalidateQueries({ queryKey: ['registrations', 'own'] });
      refetch();
      enqueueSnackbar('Registration cancelled.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Could not cancel registration.'), { variant: 'error' });
    } finally {
      setBusy(false);
      setCancelTarget(null);
    }
  };

  if (isLoading) {
    return <Container maxWidth="lg" sx={{ py: 4 }}><LoadingState message="Loading your dashboard…" /></Container>;
  }
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <ErrorState message="Could not load your registrations." onRetry={() => refetch()} />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Avatar sx={{ width: 56, height: 56, bgcolor: '#2557F5', fontWeight: 800, fontSize: 24 }}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
        <Box sx={{ flex: '1 1 200px' }}>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
            {user?.name || 'My Dashboard'}
          </Typography>
          <Typography color="text.secondary">{user?.email || user?.phone || 'Participant'}</Typography>
        </Box>
        <Button variant="contained" component={RouterLink} to="/events" sx={{ borderRadius: 999, boxShadow: 'none' }}>
          Discover Events
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<EventAvailableOutlined />} label="Upcoming" value={upcoming.length} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<HistoryOutlined />} label="Past events" value={past.length} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<ConfirmationNumberOutlined />} label="Tickets" value={all.length} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<CalendarMonthOutlined />} label="Total registrations" value={all.length} />
        </Grid>
      </Grid>

      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventAvailableOutlined color="primary" /> Upcoming events
      </Typography>
      {upcoming.length === 0 ? (
        <EmptyState
          icon={EventAvailableOutlined}
          title="No upcoming events"
          description="You have no upcoming registrations. Discover campus events and grab your seat."
          actionLabel="Browse Events"
          actionHref="/events"
        />
      ) : (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {upcoming.map((r) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={r.registrationId}>
              <RegistrationCard registration={r} onCancel={setCancelTarget} />
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, mt: 4, display: 'flex', alignItems: 'center', gap: 1 }}>
        <HistoryOutlined color="primary" /> Past events & history
      </Typography>
      {past.length === 0 ? (
        <EmptyState
          icon={HistoryOutlined}
          title="No past events"
          description="Events you attended will show up here with their tickets."
        />
      ) : (
        <Grid container spacing={2.5}>
          {past.map((r) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={r.registrationId}>
              <RegistrationCard registration={r} onCancel={setCancelTarget} />
            </Grid>
          ))}
        </Grid>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3, mt: 4 }}>
        <CardContent sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <PersonOutlined color="action" />
          <Box sx={{ flex: '1 1 220px' }}>
            <Typography sx={{ fontWeight: 800 }}>Profile</Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.name} · {user?.email || user?.phone || ''} · {user?.role}
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Typography variant="body2" color="text.secondary">
            Registrations are linked to your login phone/email.
          </Typography>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel registration?"
        description={`Cancel your registration for ${cancelTarget?.event?.eventName || 'this event'}? This cannot be undone.`}
        confirmLabel="Cancel Registration"
        busy={busy}
        onCancel={() => setCancelTarget(null)}
        onConfirm={doCancel}
      />
    </Container>
  );
}

export default function UserDashboardPage() {
  const { loading, user } = useAuth();
  return (
    <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
      <ParticipantNavbar />
      {loading ? (
        <Container maxWidth="lg" sx={{ py: 4 }}><LoadingState message="Loading…" /></Container>
      ) : user ? (
        <DashboardContent />
      ) : (
        <GuestView />
      )}
    </Box>
  );
}
