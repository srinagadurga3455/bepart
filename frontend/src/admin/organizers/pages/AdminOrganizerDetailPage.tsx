import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, Chip, Divider, Typography,
} from '@mui/material';
import { CalendarMonthOutlined } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { organizersApi } from '../api/organizers';
import { formatEventDate } from '../../../app/utils/format';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import type { EventItem } from '../../../app/types';
import AdminShell from '../../components/AdminShell';
import { isOrganizerActive, OrganizerStatusChip } from '../components/OrganizerTable';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

function DetailContent({ id }: { id: string | undefined }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDeact, setConfirmDeact] = useState(false);

  const { data: orgRes, isLoading: orgLoading, error: orgError, refetch } = useQuery({
    queryKey: ['admin', 'organizer', id], queryFn: () => organizersApi.get(id!),
  });
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin', 'organizer', id, 'events'], queryFn: () => organizersApi.events(id!, { page: 1, limit: 50 }),
  });

  const organizer = orgRes?.data;
  const events: EventItem[] = eventsRes ? unwrapList<EventItem>(eventsRes) : [];
  const conducted = events.filter((e) => e.status === 'COMPLETED' || e.status === 'CANCELLED').length;
  const upcoming = events.filter((e) => e.status === 'PUBLISHED' || e.status === 'PREVIEW').length;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizer', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    refetch();
  };

  const runChange = async (fn: () => Promise<unknown>, okMsg: string, failMsg: string) => {
    setError('');
    setBusy(true);
    try {
      await fn();
      refresh();
      enqueueSnackbar(okMsg, { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, failMsg);
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (orgLoading || eventsLoading) {
    return <LoadingState message="Loading organizer…" />;
  }
  if (orgError || !organizer) {
    return <ErrorState message="Organizer not found." onRetry={() => refetch()} />;
  }

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontWeight: 800 }}>
              {organizer.name?.charAt(0)?.toUpperCase() || 'O'}
            </Avatar>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                {organizer.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {organizer.email || organizer.user?.email || '—'}
              </Typography>
            </Box>
            <OrganizerStatusChip organizer={organizer} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            Phone: {organizer.phone || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            UPI ID: {organizer.upiId || '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Status: {organizer.status}{organizer.isActive === false ? ' · events hidden' : ''}
          </Typography>
          {organizer.description && (
            <Typography color="text.secondary" sx={{ mb: 2 }}>{organizer.description}</Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Total Events: {events.length} · Conducted Events: {conducted} · Upcoming Events: {upcoming}
          </Typography>
          {isOrganizerActive(organizer) ? (
            <Button size="small" color="error" variant="outlined" disabled={busy} onClick={() => setConfirmDeact(true)}>
              Deactivate Organizer
            </Button>
          ) : (
            <Button size="small" color="success" variant="outlined" disabled={busy}
              onClick={() => runChange(() => organizersApi.approve(id!), 'Organizer activated. Their events are visible again.', 'Activation failed.')}>
              {busy ? 'Working…' : 'Activate Organizer'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            Events by this organizer ({events.length})
          </Typography>
          {events.length === 0 ? (
            <EmptyState
              icon={CalendarMonthOutlined}
              title="No events yet"
              description="This organizer has not created any events yet."
            />
          ) : (
            events.map((event) => (
              <Box key={event.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600 }}>{event.eventName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatEventDate(event.date)}
                    </Typography>
                  </Box>
                  <Chip label={event.status} size="small" variant="outlined" color={event.status === 'PUBLISHED' ? 'success' : 'default'} />
                  {event.isActive === false && <Chip label="Hidden" size="small" color="warning" />}
                  {event.status === 'PUBLISHED' && (
                    <Button size="small" variant="outlined" component={RouterLink} to={`/events/${event.id}`}>
                      View Event
                    </Button>
                  )}
                </Box>
              </Box>
            ))
          )}
          <Divider sx={{ my: 2 }} />
          <Button variant="text" component={RouterLink} to="/admin/organizers">← Back to Organizers</Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDeact}
        title="Deactivate organizer?"
        description="The organizer will lose access and their events will be hidden from participants until reactivation. Event history and data are preserved."
        confirmLabel="Deactivate"
        busy={busy}
        onCancel={() => setConfirmDeact(false)}
        onConfirm={() => {
          setConfirmDeact(false);
          runChange(() => organizersApi.deactivate(id!), 'Organizer deactivated. Their events are now hidden.', 'Deactivation failed.');
        }}
      />
    </Box>
  );
}

export default function AdminOrganizerDetailPage() {
  const { id } = useParams();
  return (
    <AdminShell title="Organizer" subtitle="Profile, events and status.">
      <DetailContent id={id} />
    </AdminShell>
  );
}
