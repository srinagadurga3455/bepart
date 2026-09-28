import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, TextField, Typography } from '@mui/material';
import { ArrowBack, LocalOfferOutlined, Lock } from '@mui/icons-material';
import type { FlowEventInfo } from './RegistrationFlow';
import { participantPaymentsApi, type PendingPayment } from '../api/payments';
import { apiErrorMessage } from '../../../app/api/client';
import { formatPaise, formatINR, rupeesToPaise } from '../../../app/utils/format';
import type { FormDataRecord } from '../../../app/types';

interface PaymentStepProps {
  eventId: string;
  event?: FlowEventInfo;
  // Fee as entered by the organizer (RUPEES). Converted to paise on submit.
  feeRupees: number | null;
  formData: FormDataRecord;
  phone: string;
  onBack: () => void;
}

// Real paid-event payment step backed by POST /payments/init.
// The backend validates the coupon exactly once and stores the final payable
// amount + pricing snapshot. The participant's answers ride along as
// pendingFormData so organizer confirmation creates the registration.
export default function PaymentStep({ eventId, event, feeRupees, formData, phone, onBack }: PaymentStepProps) {
  const [couponCode, setCouponCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<PendingPayment | null>(null);

  const feePaise = feeRupees != null ? rupeesToPaise(feeRupees) : null;

  const initiate = async () => {
    setError('');
    if (!phone) {
      setError('Phone number is required — go back and fill it in the registration form.');
      return;
    }
    if (feePaise == null) {
      setError('This event has no valid fee configured. Contact the organizer.');
      return;
    }
    setBusy(true);
    try {
      const res = await participantPaymentsApi.init({
        eventId,
        phone,
        amount: feePaise,
        couponCode: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
        formData: { ...formData },
      });
      setPayment(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not initiate payment. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  if (payment) {
    const saved = (payment.originalAmount ?? payment.amount) - payment.amount;
    return (
      <Box sx={{ width: '100%' }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Payment initiated</Typography>
          <Typography>
            Your seat request for <strong>{event?.eventName}</strong> is recorded.
            Complete {formatPaise(payment.amount)} with the organizer — your ticket is issued after payment confirmation.
          </Typography>
        </Alert>
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Amount payable</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{formatPaise(payment.amount)}</Typography>
            </Box>
            {saved > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">Coupon {payment.couponCode} saved you</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }} color="success.main">{formatPaise(saved)}</Typography>
              </Box>
            )}
            {payment.couponCode && (
              <Box><Chip icon={<LocalOfferOutlined />} label={payment.couponCode} size="small" color="success" variant="outlined" /></Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip label={payment.status} size="small" color="warning" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Phone: {payment.phone} · Pay the organizer directly (UPI/cash) and share this phone number for confirmation.
            </Typography>
          </CardContent>
        </Card>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
            Back to Review
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
          Complete Payment
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          This is a paid event. Your registration is confirmed only after payment.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Registration Fee</Typography>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {feeRupees != null ? formatINR(feeRupees) : '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {event?.eventName}
            </Typography>
          </Box>
          <Lock color="action" sx={{ fontSize: 40 }} />
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      <TextField
        label="Coupon code (optional)"
        placeholder="e.g. AICLUB20"
        value={couponCode}
        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
        fullWidth
        size="small"
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        helperText="Applied once on the server — the payable amount is calculated there."
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Online payment is not enabled yet. Initiating creates a pending payment of{' '}
        {feePaise != null ? formatPaise(feePaise) : '—'} for phone {phone}; complete it with the
        event organizer — your registration and ticket are issued after confirmation. No registration
        has been created yet.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          Back to Review
        </Button>
        <Button variant="contained" size="large" onClick={initiate} disabled={busy || feePaise == null}
          sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          {busy ? 'Initiating…' : `Initiate ${feePaise != null ? formatPaise(feePaise) : ''}`.trim()}
        </Button>
      </Box>
    </Box>
  );
}
