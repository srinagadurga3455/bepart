import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  TextField, Typography,
} from '@mui/material';
import { withdrawalsApi } from '../../../shared/api';
import { formatINR } from '../../../shared/api/helpers';

// Withdrawal request dialog. UPI comes from the organizer profile (read-only);
// amount is validated against the available balance. Never marks paid.
export default function WithdrawDialog({ open, event, finance, withdrawals, upiId, onClose, onRequested }) {
  const collected = finance?.collected || 0;
  const reserved = (withdrawals || [])
    .filter((w) => ['REQUESTED', 'PROCESSING'].includes(w.status))
    .reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const paid = (withdrawals || [])
    .filter((w) => w.status === 'PAID')
    .reduce((s, w) => s + (Number(w.amount) || 0), 0);
  const available = Math.max(0, collected - reserved - paid);
  const hasOpen = (withdrawals || []).some((w) => ['REQUESTED', 'PROCESSING'].includes(w.status));

  const [amount, setAmount] = useState(String(available));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (value - available > 1e-9) {
      setError(`Amount cannot exceed the available balance of ${formatINR(available)}.`);
      return;
    }
    if (hasOpen) {
      setError('A withdrawal request for this event is already open.');
      return;
    }
    setBusy(true);
    try {
      await withdrawalsApi.create({ eventId: event.id, amount: value });
      onRequested();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not submit the withdrawal request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Withdraw Payment</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {event?.eventName}
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Available Amount</Typography>
            <Typography variant="h5" fontWeight={800}>{formatINR(available)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Organizer UPI ID</Typography>
            <Typography variant="body1" fontWeight={600}>{upiId || '—'}</Typography>
          </Box>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!upiId && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No UPI ID is saved on your organizer profile. Ask your admin to add one before withdrawing.
          </Alert>
        )}
        <TextField
          label="Withdrawal Amount (₹)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          fullWidth
          size="small"
          inputProps={{ min: 1, step: 'any', max: available }}
          disabled={!upiId}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          The request stays PENDING until the admin processes the payment. It is never marked paid automatically.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !upiId}>
          {busy ? 'Submitting…' : 'Request Withdrawal'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
