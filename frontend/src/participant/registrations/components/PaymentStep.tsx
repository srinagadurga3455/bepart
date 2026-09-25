import { Alert, Box, Button, Card, CardContent, Divider, Typography } from '@mui/material';
import { ArrowBack, Lock } from '@mui/icons-material';

// Payment step shown after review for PAID events.
// There is currently no online-payment backend, so this step NEVER creates a
// registration or pretends payment succeeded. When a payment provider is
// wired up, pass onPaid(paymentResult) and a Pay button will appear.
export default function PaymentStep({ event, amount, onBack, onPaid }) {
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} color="text.primary" gutterBottom>
          Complete Payment
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          This is a paid event. Your registration is confirmed only after payment.
        </Typography>
      </Box>

      <Divider sx={{ mb: 4 }} />

      <Card variant="outlined" sx={{ borderRadius: 2, mb: 3 }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Registration Fee</Typography>
            <Typography variant="h4" fontWeight={800}>₹{amount}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {event?.eventName}
            </Typography>
          </Box>
          <Lock color="action" sx={{ fontSize: 40 }} />
        </CardContent>
      </Card>

      {!onPaid ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          Online payment is not enabled yet. Please complete the payment of ₹{amount} with the
          event organizer — your registration will be confirmed after payment. No registration
          has been created.
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 3 }}>
          You will be redirected to the secure payment page to pay ₹{amount}.
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="outlined" size="large" startIcon={<ArrowBack />} onClick={onBack} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
          Back to Review
        </Button>
        {onPaid && (
          <Button variant="contained" size="large" onClick={onPaid} sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
            Pay ₹{amount}
          </Button>
        )}
      </Box>
    </Box>
  );
}
