import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { organizersApi } from '../../account/api/organizers';
import { eventsApi } from '../../events/api/events';
import { registrationsApi } from '../../events/api/registrations';
import { unwrapList } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import { financeByEvent } from '../../events/utils/eventData';
import type { EventItem, RegistrationItem } from '../../../app/types';
import DashboardShell from '../../../app/components/DashboardShell';
import { organizerNav } from '../../events/pages/EventWizard';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { data: orgRes } = useQuery({ queryKey: ['organizer', 'me'], queryFn: () => organizersApi.getMe() });
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const { data: regsRes, isLoading: regsLoading } = useQuery({
    queryKey: ['registrations', 'mine'], queryFn: () => registrationsApi.list(),
  });

  const organizer = orgRes?.data;
  const events: EventItem[] = unwrapList<EventItem>(eventsRes);
  const registrations: RegistrationItem[] = unwrapList<RegistrationItem>(regsRes);
  const regCountByEvent: Record<number, number> = {};
  registrations.forEach((r) => {
    regCountByEvent[r.eventId] = (regCountByEvent[r.eventId] || 0) + 1;
  });
  const finance = financeByEvent(events, registrations);
  const totalAmount = Object.values(finance).reduce((s, f) => s + f.collected, 0);
  const recent = [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  if (eventsLoading || regsLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
            Good day, {organizer?.name || 'Organizer'}
          </Typography>
          <Typography color="text.secondary">Create and manage your events.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} component={RouterLink} to="/organizer/events/create">
          Create Event
        </Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard label="Total Events" value={events.length} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard label="Total Registrations" value={registrations.length} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard label="Total Amount" value={formatINR(totalAmount)} /></Grid>
      </Grid>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Recent Events</Typography>
          {recent.length === 0 ? (
            <Alert severity="info">No events yet. Create your first event!</Alert>
          ) : (
            recent.map((event) => (
              <Box
                key={event.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', '&:last-child': { borderBottom: 'none' } }}
              >
                <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>{event.eventName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatEventDate(event.date)} · {regCountByEvent[event.id] || 0} registrations
                  </Typography>
                </Box>
                <Chip label={event.status} size="small" variant="outlined" color={event.status === 'PUBLISHED' ? 'success' : 'default'} />
                <Button size="small" variant="outlined" component={RouterLink} to={`/organizer/events/${event.id}`}>View</Button>
                {event.status !== 'PUBLISHED' && (
                  <Button size="small" variant="contained" component={RouterLink} to={`/organizer/events/${event.id}/edit`}>Edit</Button>
                )}
              </Box>
            ))
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default function DashboardPage() {
  return (
    <DashboardShell navItems={organizerNav}>
      <DashboardContent />
    </DashboardShell>
  );
}
