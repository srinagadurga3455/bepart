import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Card, CardContent, CircularProgress, Divider,
  TextField, Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { withdrawalsApi } from '../api/withdrawals';
import { formatEventDate, formatPaise } from '../../../app/utils/format';
import { apiErrorMessage } from '../../../app/api/client';
import type { WithdrawalStatus } from '../../../app/types';
import AdminShell from '../../components/AdminShell';
import ProofButton from '../../../app/components/ProofButton';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

const OPEN: WithdrawalStatus[] = ['REQUESTED', 'PROCESSING'];

function DetailContent({ id }: { id: string | undefined }) {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ['admin', 'withdrawal', id], queryFn: () => withdrawalsApi.get(id!),
  });
  const w = data?.data;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawal', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
  };

  const run = async (fn: () => Promise<unknown>, okMsg: string, failMsg: string) => {
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
      () => withdrawalsApi.confirmPaid(id!, { transactionId: transactionId.trim(), screenshot }),
      'Withdrawal marked as PAID.',
      'Could not confirm payment.',
    );
  };

  if (isLoading) {
    return <LoadingState message="Loading withdrawal…" />;
  }
  if (loadError || !w) {
    return <ErrorState message="Withdrawal not found." />;
  }

  const isOpen = OPEN.includes(w.status);

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 52, height: 52, bgcolor: 'primary.main', fontWeight: 800 }}>
              {w.organizer?.name?.charAt(0)?.toUpperCase() || 'O'}
            </Avatar>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                {formatPaise(w.amount)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {w.event?.eventName || `Event ${w.eventId}`} Â· Requested {formatEventDate(w.requestedAt)}
              </Typography>
            </Box>
            <WithdrawalStatusChip status={w.status} />
          </Box>

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>Organizer</Typography>
          <Typography variant="body2" color="text.secondary">{w.organizer?.name || 'â€”'}</Typography>
          <Typography variant="body2" color="text.secondary">Organizer Phone: {w.organizer?.phone || 'â€”'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Organizer UPI ID: {w.organizer?.upiId || 'â€”'}</Typography>

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>Event</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {w.event?.eventName || `Event ${w.eventId}`}
            {w.event?.date ? ` Â· ${formatEventDate(w.event.date)}` : ''}
          </Typography>

          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>Amount</Typography>
          <Typography variant="body1" sx={{ mb: 2, fontWeight: 700 }}>{formatPaise(w.amount)}</Typography>

          {w.status === 'PAID' && (
            <>
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>Payment Record</Typography>
              <Typography variant="body2" color="text.secondary">Transaction ID: {w.transactionId || 'â€”'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Paid On: {w.paidAt ? formatEventDate(w.paidAt) : 'â€”'}
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
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Payment Confirmation</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Transfer {formatPaise(w.amount)} manually to UPI ID <strong>{w.organizer?.upiId || 'â€”'}</strong>, then record the payment below.
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
                {busy ? 'Workingâ€¦' : 'Mark as Paid'}
              </Button>
              {w.status === 'REQUESTED' && (
                <Button variant="outlined" disabled={busy} onClick={() => run(() => withdrawalsApi.process(id!), 'Marked as processing.', 'Could not update.')}>
                  Mark Processing
                </Button>
              )}
              <Button
                variant="text"
                color="error"
                disabled={busy}
                onClick={() => setConfirmReject(true)}
              >
                Reject
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmReject}
        title="Reject withdrawal?"
        description={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              The organizer will see your reason. The requested amount is released for a new request.
            </Typography>
            <TextField
              label="Rejection reason *"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="e.g. UPI ID mismatch — update it and request again"
            />
          </Box>
        }
        confirmLabel="Reject"
        busy={busy}
        onCancel={() => setConfirmReject(false)}
        onConfirm={() => {
          if (!rejectReason.trim()) {
            setError('Rejection reason is required.');
            return;
          }
          setConfirmReject(false);
          const reason = rejectReason.trim();
          setRejectReason('');
          run(() => withdrawalsApi.reject(id!, reason), 'Withdrawal rejected.', 'Could not reject.');
        }}
      />

      <Divider sx={{ my: 2 }} />
      <Button variant="text" component={RouterLink} to="/admin/withdrawals">â† Back to Withdrawal Requests</Button>
    </Box>
  );
}

export default function AdminWithdrawalDetailPage() {
  const { id } = useParams();
  return (
    <AdminShell>
      <DetailContent id={id} />
    </AdminShell>
  );
}
