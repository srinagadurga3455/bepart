import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { withdrawalsApi } from '../api/withdrawals';
import { unwrapList } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import type { WithdrawalItem } from '../../../app/types';
import DashboardShell from '../../../app/components/DashboardShell';
import ProofButton from '../../../app/components/ProofButton';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';
import { organizerNav } from '../../events/pages/EventWizard';

function WithdrawalsContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['withdrawals', 'mine'], queryFn: () => withdrawalsApi.mine(),
  });
  const withdrawals: WithdrawalItem[] = unwrapList<WithdrawalItem>(data);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.04em', mb: 0.5 }}>
        Withdrawals
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Your withdrawal requests and payment history.</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>Could not load withdrawals.</Alert>}

      {withdrawals.length === 0 ? (
        <Alert severity="info">No withdrawals yet. Open an event and request a withdrawal of collected fees.</Alert>
      ) : (
        withdrawals.map((w) => (
          <Card key={w.id} variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
            <CardContent>
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
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" component={RouterLink} to={`/organizer/events/${w.eventId}`}>
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
    <DashboardShell navItems={organizerNav}>
      <WithdrawalsContent />
    </DashboardShell>
  );
}
