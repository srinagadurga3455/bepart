import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load Razorpay checkout. Check your connection and retry.')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your connection and retry.'));
    document.body.appendChild(script);
  });
}

// Paid-event payment step: POST /payments/init (server decides the final
// amount) -> Razorpay Checkout (test mode) -> POST /payments/verify.
// The backend verifies the signature server-side, marks payment PAID,
// creates the registration + ticket idempotently and sends notifications.
// If Razorpay is not configured server-side, falls back to the offline
// pending-payment flow (organizer confirms manually).
export default function PaymentStep({ eventId, event, feeRupees, formData, phone, onBack }: PaymentStepProps) {
  const [couponCode, setCouponCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [verified, setVerified] = useState(false);
  const [alreadyPaid, setAlreadyPaid] = useState(false);

  const feePaise = feeRupees != null ? rupeesToPaise(feeRupees) : null;
  const onlineReady = !!payment?.razorpayOrderId && !!payment?.razorpayKeyId;

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
      setVerified(false);
      setAlreadyPaid(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not initiate payment. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = async () => {
    if (!payment?.razorpayOrderId || !payment?.razorpayKeyId) return;
    setError('');
    setPaying(true);
    try {
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error('Razorpay checkout failed to load.');
      const rzp = new window.Razorpay({
        key: payment.razorpayKeyId,
        amount: payment.amount,
        currency: 'INR',
        name: 'BePart',
        description: event?.eventName ?? 'Event registration',
        order_id: payment.razorpayOrderId,
        prefill: { contact: phone },
        notes: { paymentId: payment.id, eventId },
        theme: { color: '#2557F5' },
        handler: async (resp: unknown) => {
          const r = resp as { razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string };
          setVerifying(true);
          try {
            const vres = await participantPaymentsApi.verify({
              razorpay_order_id: r.razorpay_order_id ?? payment.razorpayOrderId!,
              razorpay_payment_id: r.razorpay_payment_id!,
              razorpay_signature: r.razorpay_signature!,
            });
            setVerified(true);
            setAlreadyPaid(!!vres.data?.alreadyPaid);
          } catch (err) {
            setError(apiErrorMessage(err, 'Payment verification failed. If money was deducted, the ticket will still arrive via webhook — check with the organizer.'));
          } finally {
            setVerifying(false);
            setPaying(false);
          }
        },
      });
      rzp.on('payment.failed', () => {
        setPaying(false);
        setError('Payment failed or was cancelled. No ticket was issued — try again.');
      });
      rzp.open();
    } catch (err) {
      setPaying(false);
      setError(err instanceof Error ? err.message : 'Could not open Razorpay checkout.');
    }
  };

  if (payment && (verified || alreadyPaid)) {
    return (
      <Box sx={{ width: '100%' }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Payment successful — registration confirmed</Typography>
          <Typography>
            Your registration for <strong>{event?.eventName}</strong> is confirmed for {formatPaise(payment.amount)}.
            Your ticket was emailed/WhatsApped and is ready below.
          </Typography>
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
            Back to Review
          </Button>
        </Box>
        <Alert severity="info" sx={{ mt: 3 }}>
          Recover your ticket anytime from the home page with phone {payment.phone} — or ask the organizer. Ticket notifications were sent best-effort (email/WhatsApp).
        </Alert>
      </Box>
    );
  }

  if (payment) {
    const saved = (payment.originalAmount ?? payment.amount) - payment.amount;
    return (
      <Box sx={{ width: '100%' }}>
        <Alert severity={onlineReady ? 'info' : 'success'} sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>{onlineReady ? 'Order created — complete payment' : 'Payment initiated'}</Typography>
          <Typography>
            {onlineReady
              ? <>Your seat request for <strong>{event?.eventName}</strong> is reserved. Pay {formatPaise(payment.amount)} online to get your ticket instantly.</>
              : <>Your seat request for <strong>{event?.eventName}</strong> is recorded.
            Complete {formatPaise(payment.amount)} with the organizer — your ticket is issued after payment confirmation.</>}
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
              <Chip label={verifying ? 'VERIFYING' : payment.status} size="small" color="warning" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Phone: {payment.phone} · {onlineReady ? 'Razorpay test mode — use a test card/UPI.' : 'Pay the organizer directly (UPI/cash) and share this phone number for confirmation.'}
            </Typography>
          </CardContent>
        </Card>
        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
            Back to Review
          </Button>
          {onlineReady ? (
            <Button variant="contained" size="large" onClick={openCheckout} disabled={paying || verifying}
              sx={{ px: 4, py: 1.5, fontWeight: 700, borderRadius: 2 }}>
              {verifying ? 'Verifying…' : paying ? 'Opening Razorpay…' : `Pay ${formatPaise(payment.amount)}`}
            </Button>
          ) : (
            <Button variant="text" size="large" component={RouterLink} to="/events" sx={{ px: 4, py: 1.5, fontWeight: 600 }}>
              Back to Events
            </Button>
          )}
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
        Secure online payment via Razorpay (test mode). The final amount is set by the server —{' '}
        {feePaise != null ? formatPaise(feePaise) : '—'} before coupon. If online payment is unavailable,
        a pending payment is created for phone {phone} and the organizer confirms it manually.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          Back to Review
        </Button>
        <Button variant="contained" size="large" onClick={initiate} disabled={busy || feePaise == null}
          sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          {busy ? 'Initiating…' : `Continue to Pay ${feePaise != null ? formatPaise(feePaise) : ''}`.trim()}
        </Button>
      </Box>
    </Box>
  );
}
