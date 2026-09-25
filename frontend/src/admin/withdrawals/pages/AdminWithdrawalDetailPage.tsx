import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Divider,
  TextField, Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { withdrawalsApi } from '../../../shared/api';
import { formatEventDate, formatINR } from '../../../shared/api/helpers';
import DashboardShell from '../../../shared/components/DashboardShell';
import ProofButton from '../../../shared/components/ProofButton';
import WithdrawalStatusChip from '../../organizer/components/WithdrawalStatus';
import { adminNav } from '../routes';

const OPEN = ['REQUESTED', 'PROCESSING'];

function DetailContent({ id }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['admin', 'withdrawal', id], queryFn: () => withdrawalsApi.get(id),
  });
  const w = data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawal', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
  };

  const run = async (fn, okMsg, failMsg) => {
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      await fn();
      refresh();
      setSuccess(okMsg);
    } catch (err) {
      setError(err.response?.data?.message || failMsg);
    } finally {
      setBusy(false);
    }
  };

  const markPaid = () => {
    setError('');
    if (!transactionId.trim()) {
      setError('Transaction ID is required before marking as paid.');
      return;
    }
    if (!screenshot) {
      setError('Payment screenshot is required before marking as paid.');
      return;
    }
    run(
      () => withdrawalsApi.confirmPaid(id, { transactionId: transactionId.trim(), screenshot }),
      'Withdrawal marked as PAID.',
      'Could not confirm payment.',
    );
  };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (loadError || !w) {
    return <Alert severity="error">Withdrawal not found.</Alert>;
  }

  const isOpen = OPEN.includes(w.status);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 52, height: 52, bgcolor: 'primary.main', fontWeight: 800 }}>
              {w.organizer?.name?.charAt(0)?.toUpperCase() || 'O'}
            </Avatar>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                {formatINR(w.amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {w.event?.eventName || `Event ${w.eventId}`} · Requested {formatEventDate(w.requestedAt)}
              </Typography>
            </Box>
            <WithdrawalStatusChip status={w.status} />
          </Box>

          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Organizer</Typography>
          <Typography variant="body2" color="text.secondary">{w.organizer?.name || '—'}</Typography>
          <Typography variant="body2" color="text.secondary">Organizer Phone: {w.organizer?.phone || '—'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Organizer UPI ID: {w.organizer?.upiId || '—'}</Typography>

          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Event</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {w.event?.eventName || `Event ${w.eventId}`}
            {w.event?.date ? ` · ${formatEventDate(w.event.date)}` : ''}
          </Typography>

          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Amount</Typography>
          <Typography variant="body1" fontWeight={700} sx={{ mb: 2 }}>{formatINR(w.amount)}</Typography>

          {w.status === 'PAID' && (
            <>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Payment Record</Typography>
              <Typography variant="body2" color="text.secondary">Transaction ID: {w.transactionId || '—'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Paid On: {w.paidAt ? formatEventDate(w.paidAt) : '—'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Payment Proof:</Typography>
              <ProofButton withdrawalId={w.id} />
            </>
          )}
        </CardContent>
      </Card>

      {isOpen && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography variant="h6" fontWeight={700} gutterBottom>Payment Confirmation</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Transfer {formatINR(w.amount)} manually to UPI ID <strong>{w.organizer?.upiId || '—'}</strong>, then record the payment below.
            </Typography>
            <TextField
              label="Transaction ID *"
              placeholder="Enter transaction ID"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
              <Button variant="outlined" component="label" size="small">
                Upload Screenshot *
                <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => setScreenshot(e.target.files?.[0] || null)} />
              </Button>
              {screenshot && <Typography variant="body2">{screenshot.name}</Typography>}
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 2 }}>
              <Button variant="contained" color="success" disabled={busy} onClick={markPaid}>
                {busy ? 'Working…' : 'Mark as Paid'}
              </Button>
              {w.status === 'REQUESTED' && (
                <Button variant="outlined" disabled={busy} onClick={() => run(() => withdrawalsApi.process(id), 'Marked as processing.', 'Could not update.')}>
                  Mark Processing
                </Button>
              )}
              <Button
                variant="text"
                color="error"
                disabled={busy}
                onClick={() => {
                  if (!confirmReject) { setConfirmReject(true); return; }
                  setConfirmReject(false);
                  run(() => withdrawalsApi.reject(id), 'Withdrawal rejected.', 'Could not reject.');
                }}
              >
                {confirmReject ? 'Click again to confirm reject' : 'Reject'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Divider sx={{ my: 2 }} />
      <Button variant="text" component={RouterLink} to="/admin/withdrawals">← Back to Withdrawal Requests</Button>
    </Box>
  );
}

export default function AdminWithdrawalDetailPage() {
  const { id } = useParams();
  return (
    <DashboardShell navItems={adminNav}>
      <DetailContent id={id} />
    </DashboardShell>
  );
}
