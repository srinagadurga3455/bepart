import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import { Add } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, organizersApi, registrationsApi, withdrawalsApi } from '../../../shared/api';
import { unwrapList, formatEventDate, financeByEvent, withdrawalsByEvent, formatINR } from '../../../shared/api/helpers';
import DashboardShell from '../../../shared/components/DashboardShell';
import WithdrawDialog from '../components/WithdrawDialog';
import WithdrawalStatusChip from '../components/WithdrawalStatus';
import { organizerNav } from './EventWizard';

function EventsContent() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [withdrawEvent, setWithdrawEvent] = useState(null);
  const [requestedMsg, setRequestedMsg] = useState('');

  const { data: eventsRes, isLoading } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const { data: regsRes } = useQuery({
    queryKey: ['registrations', 'mine'], queryFn: () => registrationsApi.list(),
  });
  const { data: orgRes } = useQuery({
    queryKey: ['organizer', 'me'], queryFn: () => organizersApi.getMe(),
  });
  const { data: wdsRes } = useQuery({
    queryKey: ['withdrawals', 'mine'], queryFn: () => withdrawalsApi.mine(),
  });

  const events = unwrapList(eventsRes);
  const finance = financeByEvent(events, unwrapList(regsRes));
  const byEvent = withdrawalsByEvent(unwrapList(wdsRes));
  const upiId = orgRes?.data?.upiId;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['events', 'my'] });
    queryClient.invalidateQueries({ queryKey: ['registrations', 'mine'] });
    queryClient.invalidateQueries({ queryKey: ['withdrawals', 'mine'] });
  };

  const act = async (id, fn) => {
    setError('');
    setBusyId(id);
    try {
      await fn(id);
      refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>My Events</Typography>
        <Button variant="contained" startIcon={<Add />} component={RouterLink} to="/organizer/events/create">
          Create Event
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {requestedMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRequestedMsg('')}>{requestedMsg}</Alert>}

      {withdrawEvent && (
        <WithdrawDialog
          open
          event={withdrawEvent}
          finance={finance[withdrawEvent.id]}
          withdrawals={byEvent[withdrawEvent.id]?.history || []}
          upiId={upiId}
          onClose={() => setWithdrawEvent(null)}
          onRequested={() => {
            refresh();
            setRequestedMsg(`Withdrawal requested for ${withdrawEvent.eventName}. Status: pending admin processing.`);
          }}
        />
      )}

      {events.length === 0 ? (
        <Alert severity="info">No events yet. Create your first event!</Alert>
      ) : (
        events.map((event) => {
          const fin = finance[event.id] || { count: 0, fee: 0, collected: 0 };
          const wd = byEvent[event.id];
          const available = Math.max(0, fin.collected - (wd?.openTotal || 0) - (wd?.paidTotal || 0));
          const canWithdraw = fin.collected > 0 && available > 0 && !wd?.open && !!upiId;
          return (
            <Card key={event.id} variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>{event.eventName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatEventDate(event.date)} · {fin.count} registrations
                    {event.paymentRequired ? ` · ${formatINR(fin.collected)} collected` : ' · Free'}
                  </Typography>
                  {wd?.open && (
                    <Box sx={{ mt: 1 }}><WithdrawalStatusChip status={wd.open.status} /></Box>
                  )}
                </Box>
                <Chip label={event.status} size="small" variant="outlined" color={event.status === 'PUBLISHED' ? 'success' : 'default'} />
                <Button size="small" variant="outlined" component={RouterLink} to={`/organizer/events/${event.id}`}>View</Button>
                {canWithdraw && (
                  <Button size="small" variant="contained" color="success" onClick={() => setWithdrawEvent(event)}>
                    Withdraw
                  </Button>
                )}
                {event.status === 'DRAFT' && (
                  <>
                    <Button size="small" variant="contained" component={RouterLink} to={`/organizer/events/${event.id}/edit`}>
                      Continue Editing
                    </Button>
                    <Button size="small" variant="text" disabled={busyId === event.id} onClick={() => act(event.id, (id) => eventsApi.preview(id))}>
                      {busyId === event.id ? 'Working…' : 'Preview'}
                    </Button>
                  </>
                )}
                {event.status === 'PREVIEW' && (
                  <>
                    <Button size="small" variant="contained" component={RouterLink} to={`/organizer/events/${event.id}/edit`}>Edit</Button>
                    <Button size="small" variant="contained" color="success" disabled={busyId === event.id} onClick={() => act(event.id, (id) => eventsApi.publish(id))}>
                      {busyId === event.id ? 'Publishing…' : 'Publish'}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </Box>
  );
}

export default function OrganizerEventsPage() {
  return (
    <DashboardShell navItems={organizerNav}>
      <EventsContent />
    </DashboardShell>
  );
}
