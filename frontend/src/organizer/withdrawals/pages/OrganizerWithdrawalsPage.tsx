import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Typography,
} from '@mui/material';
import { AccountBalanceWalletOutlined } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withdrawalsApi } from '../api/withdrawals';
import { eventsApi } from '../../events/api/events';
import { registrationsApi } from '../../events/api/registrations';
import { organizersApi } from '../../account/api/organizers';
import { unwrapList } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import { financeByEvent, withdrawalsByEvent } from '../../events/utils/eventData';
import type { EventItem, RegistrationItem, WithdrawalItem } from '../../../app/types';
import OrganizerShell from '../../components/OrganizerShell';
import {
  orgCardSx,
  orgPageSubtitleSx,
  orgPageTitleSx,
  orgSmallButtonSx,
} from '../../components/organizerStyles';
import ProofButton from '../../../app/components/ProofButton';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';
import WithdrawDialog from '../components/WithdrawDialog';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{value}</Typography>
    </Box>
  );
}

function WithdrawalsContent() {
  const queryClient = useQueryClient();
  const [requestEvent, setRequestEvent] = useState<EventItem | null>(null);
  const [requestedMsg, setRequestedMsg] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['withdrawals', 'mine'], queryFn: () => withdrawalsApi.mine(),
  });
  const { data: eventsRes } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const { data: regsRes } = useQuery({
    queryKey: ['registrations', 'mine'], queryFn: () => registrationsApi.list(),
  });
  const { data: orgRes } = useQuery({
    queryKey: ['organizer', 'me'], queryFn: () => organizersApi.getMe(),
  });

  const withdrawals: WithdrawalItem[] = unwrapList<WithdrawalItem>(data);
  const events: EventItem[] = unwrapList<EventItem>(eventsRes);
  const finance = financeByEvent(events, unwrapList<RegistrationItem>(regsRes));
  const byEvent = withdrawalsByEvent(withdrawals);
  const upiId = orgRes?.data?.upiId;

  // Payout dashboard from real backend rows (all amounts RUPEES).
  const paidOut = withdrawals.filter((w) => w.status === 'PAID').reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const pending = withdrawals
    .filter((w) => w.status === 'REQUESTED' || w.status === 'PROCESSING')
    .reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const available = events.reduce((s, e) => {
    const fin = finance[e.id] || { collected: 0 };
    const wd = byEvent[e.id];
    return s + Math.max(0, fin.collected - (wd?.openTotal || 0) - (wd?.paidTotal || 0));
  }, 0);

  // Per-event payout position for the request entry points.
  const eventRows = events
    .map((e) => {
      const fin = finance[e.id] || { collected: 0, count: 0 };
      const wd = byEvent[e.id];
      const eventAvailable = Math.max(0, fin.collected - (wd?.openTotal || 0) - (wd?.paidTotal || 0));
      return { event: e, collected: fin.collected, available: eventAvailable, open: wd?.open || null };
    })
    .filter((r) => r.collected > 0);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['withdrawals', 'mine'] });
    queryClient.invalidateQueries({ queryKey: ['events', 'my'] });
    queryClient.invalidateQueries({ queryKey: ['registrations', 'mine'] });
    refetch();
  };

  if (isLoading) {
    return <LoadingState message="Loading withdrawals…" />;
  }

  if (loadError) {
    return <ErrorState message="Could not load withdrawals." onRetry={() => refetch()} />;
  }

  return (
    <Box>
      <Typography sx={{ ...orgPageTitleSx }}>
        Payouts
      </Typography>
      <Typography sx={{ ...orgPageSubtitleSx, mb: 2.5 }}>Balance, requests, and payment history.</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {requestedMsg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRequestedMsg('')}>{requestedMsg}</Alert>}

      {/* Payout dashboard */}
      <Card variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', p: { xs: 2, md: 2.5 } }}>
          <SummaryCell label="Available balance" value={formatINR(available)} />
          <SummaryCell label="Pending" value={formatINR(pending)} />
          <SummaryCell label="Paid out" value={formatINR(paidOut)} />
        </CardContent>
      </Card>

      {requestEvent && (
        <WithdrawDialog
          open
          event={requestEvent}
          finance={finance[requestEvent.id]}
          withdrawals={byEvent[requestEvent.id]?.history || []}
          upiId={upiId}
          onClose={() => setRequestEvent(null)}
          onRequested={() => {
            refresh();
            setRequestedMsg(`Withdrawal requested for ${requestEvent.eventName}. Status: pending admin processing.`);
          }}
        />
      )}

      {/* Per-event request entry points */}
      {eventRows.length > 0 && (
        <Card variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>Request payout</Typography>
            {eventRows.map(({ event: e, collected, available: av, open }) => (
              <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1, borderTop: '1px solid', borderColor: 'divider', '&:first-of-type': { borderTop: 'none', pt: 0 } }}>
                <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>{e.eventName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatINR(collected)} collected · {formatINR(av)} available
                  </Typography>
                </Box>
                {open ? (
                  <WithdrawalStatusChip status={open.status} />
                ) : av > 0 && upiId ? (
                  <Button size="small" variant="contained" color="success"
                    onClick={() => { setError(''); setRequestEvent(e); }}
                    sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                    Request {formatINR(av)}
                  </Button>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {!upiId ? 'Add a UPI ID in Account to request payouts.' : 'Nothing available to withdraw.'}
                  </Typography>
                )}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1.5 }}>History</Typography>
      {withdrawals.length === 0 ? (
        <EmptyState
          icon={AccountBalanceWalletOutlined}
          title="No withdrawals yet"
          description="Open an event with collected fees and request your first payout."
          actionLabel="View My Events"
          actionHref="/organizer/events"
        />
      ) : (
        withdrawals.map((w) => (
          <Card key={w.id} variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
            <CardContent sx={{ p: { xs: 2, md: 2.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700 }}>{w.event?.eventName || `Event ${w.eventId}`}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{formatINR(w.amount)}</Typography>
                </Box>
                <WithdrawalStatusChip status={w.status} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                Requested on {formatEventDate(w.requestedAt)}
                {w.status === 'PAID' && w.paidAt ? ` · Paid on ${formatEventDate(w.paidAt)}` : ''}
              </Typography>
              {w.status === 'PAID' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Transaction ID: {w.transactionId || '—'}
                </Typography>
              )}
              {w.status === 'REQUESTED' && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Waiting for admin payment confirmation.
                </Typography>
              )}
              {w.status === 'REJECTED' && w.rejectionReason && (
                <Alert severity="error" sx={{ mt: 1.5 }}>Rejected: {w.rejectionReason}</Alert>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" component={RouterLink} to={`/organizer/events/${w.eventId}`} sx={{ ...orgSmallButtonSx }}>
                  View Event
                </Button>
                {w.status === 'PAID' && <ProofButton withdrawalId={w.id} />}
              </Box>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}

export default function OrganizerWithdrawalsPage() {
  return (
    <OrganizerShell hideSearch hideCreate>
      <WithdrawalsContent />
    </OrganizerShell>
  );
}
