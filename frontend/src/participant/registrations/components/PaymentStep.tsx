import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, TextField, Typography } from '@mui/material';
import { ArrowBack, LocalOfferOutlined, Lock } from '@mui/icons-material';
import type { FlowEventInfo } from './RegistrationFlow';
import { participantPaymentsApi, type PendingPayment, type VerifyPaymentResult } from '../api/payments';
import { isCheckoutDismissal, openRazorpayCheckout, type RazorpaySuccessResponse } from '../api/razorpay';
import { apiErrorMessage } from '../../../app/api/client';
import { formatINR } from '../../../app/utils/format';
import type { FormDataRecord } from '../../../app/types';

export interface PaidRegistrationArgs {
  payment: PendingPayment;
  /** Coupon code actually applied at init (must be re-sent at registration). */
  couponCode?: string;
  phone: string;
  formData: FormDataRecord;
}

interface PaymentStepProps {
  eventId: string;
  event?: FlowEventInfo;
  // Fee as entered by the organizer (RUPEES). Sent to the API as rupees;
  // the backend converts to paise for Razorpay/storage.
  feeRupees: number | null;
  formData: FormDataRecord;
  phone: string;
  onBack: () => void;
  /** Called only after backend verification confirms PAID. Parent creates the registration. */
  onPaid: (args: PaidRegistrationArgs) => void;
  /** True while the parent is creating the registration after verification. */
  actionPending?: boolean;
}

type Phase = 'form' | 'initiated' | 'paying' | 'verifying' | 'verified';

// Paid-event payment step: form → POST /payments/init (coupon priced ONCE on
// the backend) → Razorpay Checkout → POST /payments/verify → parent creates
// the registration. The backend verifies the signature server-side, marks
// payment PAID and sends notifications (email/WhatsApp) best-effort.
// Success is shown only after the registration exists. The participant's
// answers ride along as formData so the registration can still be fulfilled
// if the browser closes mid-payment. If Razorpay is not configured
// server-side, falls back to the offline pending-payment flow (organizer
// confirms manually).
export default function PaymentStep({ eventId, event, feeRupees, formData, phone, onBack, onPaid, actionPending = false }: PaymentStepProps) {
  const [couponCode, setCouponCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payment, setPayment] = useState<PendingPayment | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [lastCheckout, setLastCheckout] = useState<RazorpaySuccessResponse | null>(null);
  // POST /payments/init and /payments/verify require a signed-in session.
  const [needsLogin, setNeedsLogin] = useState(false);

  const discount = (payment?.originalAmount ?? payment?.amount ?? 0) - (payment?.amount ?? 0);

  const initiate = async () => {
    if (busy) return;
    setError('');
    setNotice('');
    setNeedsLogin(false);
    if (!phone) {
      setError('Phone number is required — go back and fill it in the registration form.');
      return;
    }
    if (feeRupees == null || !Number.isFinite(feeRupees) || feeRupees <= 0) {
      setError('This event has no valid fee configured. Contact the organizer.');
      return;
    }
    setBusy(true);
    try {
      // RUPEES only: the backend prices the coupon and converts to paise.
      const res = await participantPaymentsApi.init({
        eventId,
        phone,
        amount: feeRupees,
        couponCode: couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
        formData: { ...formData },
      });
      setPayment(res.data);
      setPhase('initiated');
    } catch (err) {
      if ((err as { response?: { status?: number } })?.response?.status === 401) {
        setNeedsLogin(true);
        setError('Online payment needs a signed-in session. Sign in, then return here — your form answers are kept.');
      } else {
        setError(apiErrorMessage(err, 'Could not initiate payment. Try again.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyAndComplete = async (checkout: RazorpaySuccessResponse) => {
    setPhase('verifying');
    setError('');
    try {
      const res = await participantPaymentsApi.verify({
        razorpay_order_id: checkout.razorpay_order_id,
        razorpay_payment_id: checkout.razorpay_payment_id,
        razorpay_signature: checkout.razorpay_signature,
      });
      const body: VerifyPaymentResult = res.data;
      if (!body?.success) throw new Error('Payment verification failed. No registration was created.');
      setPhase('verified');
      setLastCheckout(null);
      // Hand off to the parent, which creates the registration and shows
      // success ONLY once the registration exists.
      onPaid({ payment: payment!, couponCode: payment?.couponCode ?? undefined, phone, formData: { ...formData } });
    } catch (err) {
      setPhase('initiated');
      setLastCheckout(checkout);
      setError(apiErrorMessage(err, 'Payment verification failed. No registration was created — you can retry.'));
    }
  };

  const pay = async () => {
    if (busy || !payment) return;
    if (!payment.razorpayOrderId || !payment.razorpayKeyId) return;
    setError('');
    setNotice('');
    setBusy(true);
    setPhase('paying');
    try {
      // Boundary conversion: Checkout requires paise. The payable figure
      // itself always comes from the backend (never computed here).
      const amountPaise = Math.round(payment.amount * 100);
      const checkout = await openRazorpayCheckout({
        key: payment.razorpayKeyId,
        orderId: payment.razorpayOrderId,
        amountPaise,
        eventName: event?.eventName,
        prefillContact: phone,
      });
      await verifyAndComplete(checkout);
    } catch (err) {
      setPhase('initiated');
      if (isCheckoutDismissal(err)) {
        // Cancelled: same order is still PENDING — Pay reuses it, no re-init.
        setNotice('Payment window closed before completion. No amount was charged — press Pay to retry with the same order.');
      } else {
        setError(apiErrorMessage(err, 'Payment failed. No registration was created — you can retry.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const retryVerify = async () => {
    if (busy || !lastCheckout) return;
    setBusy(true);
    try {
      await verifyAndComplete(lastCheckout);
    } finally {
      setBusy(false);
    }
  };

  // ---- Verified / waiting-for-registration ---------------------------------
  if (payment && (phase === 'verified' || actionPending)) {
    return (
      <Box sx={{ width: '100%' }}>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>Payment successful — registration confirmed</Typography>
          <Typography>
            Your registration for <strong>{event?.eventName}</strong> is confirmed for {formatINR(payment.amount)}.
            Your ticket was emailed/WhatsApped and is ready below.
          </Typography>
        </Alert>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography variant="body2" color="text.secondary">Confirming registration — do not close this page.</Typography>
        </Box>
        <Alert severity="info" sx={{ mt: 3 }}>
          Recover your ticket anytime from the home page with phone {payment.phone} — or ask the organizer. Ticket notifications were sent best-effort (email/WhatsApp).
        </Alert>
      </Box>
    );
  }

  // ---- Initiated: backend-priced summary + Pay --------------------------------
  if (payment) {
    const onlineReady = !!payment.razorpayOrderId && !!payment.razorpayKeyId;
    const working = busy || phase === 'paying' || phase === 'verifying';
    return (
      <Box sx={{ width: '100%' }}>
        <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {payment.originalAmount != null && discount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">Original price</Typography>
                <Typography variant="body2" sx={{ textDecoration: 'line-through' }}>{formatINR(payment.originalAmount)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Amount payable</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{formatINR(payment.amount)}</Typography>
            </Box>
            {discount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Typography variant="body2" color="text.secondary">Coupon {payment.couponCode} saved you</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }} color="success.main">{formatINR(discount)}</Typography>
              </Box>
            )}
            {payment.couponCode && (
              <Box><Chip icon={<LocalOfferOutlined />} label={payment.couponCode} size="small" color="success" variant="outlined" /></Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Status</Typography>
              <Chip label={phase === 'verifying' ? 'VERIFYING' : payment.status} size="small" color="warning" />
            </Box>
            <Typography variant="caption" color="text.secondary">
              Phone: {payment.phone} · {onlineReady ? 'Razorpay test mode — use a test card/UPI.' : 'Pay the organizer directly (UPI/cash) and share this phone number for confirmation.'}
            </Typography>
          </CardContent>
        </Card>

        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}
        {notice && <Alert severity="info" sx={{ mb: 3 }} onClose={() => setNotice('')}>{notice}</Alert>}

        {!onlineReady ? (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>Payment initiated</Typography>
            <Typography>
              Your seat request for <strong>{event?.eventName}</strong> is recorded.
              Complete {formatINR(payment.amount)} with the organizer — your ticket is issued after payment confirmation.
            </Typography>
          </Alert>
        ) : phase === 'verifying' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">Verifying payment with the bank — do not close this page.</Typography>
          </Box>
        ) : null}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} disabled={working}
            sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
            Back to Review
          </Button>
          {onlineReady ? (
            <Button variant="contained" size="large" onClick={pay} disabled={working}
              sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
              {phase === 'paying' ? 'Opening payment…' : `Pay ${formatINR(payment.amount)}`}
            </Button>
          ) : (
            <Button variant="text" size="large" component={Link} to="/events" sx={{ px: 4, py: 1.5, fontWeight: 600 }}>
              Back to Events
            </Button>
          )}
          {lastCheckout && (
            <Button variant="outlined" size="large" onClick={retryVerify} disabled={working}
              sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
              Retry verification
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  // ---- Coupon + initiate ------------------------------------------------------
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

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => { setError(''); setNeedsLogin(false); }}>
          {error}
          {needsLogin && (
            <Box sx={{ mt: 1 }}>
              <Button component={Link} to="/login" variant="outlined" size="small" sx={{ borderRadius: 2 }}>
                Go to sign in
              </Button>
            </Box>
          )}
        </Alert>
      )}

      <TextField
        label="Coupon code (optional)"
        placeholder="e.g. AICLUB20"
        value={couponCode}
        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
        fullWidth
        size="small"
        disabled={busy}
        sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        helperText="Validated on the server — the payable amount is calculated there, never here."
      />

      <Alert severity="info" sx={{ mb: 3 }}>
        Secure online payment via Razorpay (test mode). The final amount is set by the server —{' '}
        {feeRupees != null ? formatINR(feeRupees) : '—'} before coupon. If online payment is unavailable,
        a pending payment is created for phone {phone} and the organizer confirms it manually.
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} disabled={busy}
          sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          Back to Review
        </Button>
        <Button variant="contained" size="large" onClick={initiate} disabled={busy || feeRupees == null}
          sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          {busy ? 'Initiating…' : `Continue to Pay ${feeRupees != null ? formatINR(feeRupees) : ''}`.trim()}
        </Button>
      </Box>
    </Box>
  );
}
