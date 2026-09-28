import { Fragment } from 'react';
import { Box, Container, Typography } from '@mui/material';
import {
  ArrowForward,
  AssignmentOutlined,
  ConfirmationNumberOutlined,
  CreditCardOutlined,
  EventOutlined,
  LocalOfferOutlined,
  QrCodeScannerOutlined,
  RateReviewOutlined,
} from '@mui/icons-material';

const FLOW = [
  { icon: EventOutlined, label: 'Event' },
  { icon: AssignmentOutlined, label: 'Registration Form' },
  { icon: RateReviewOutlined, label: 'Review' },
  { icon: LocalOfferOutlined, label: 'Coupon (if applicable)' },
  { icon: CreditCardOutlined, label: 'Payment' },
  { icon: ConfirmationNumberOutlined, label: 'Confirmation + Digital Ticket' },
  { icon: QrCodeScannerOutlined, label: 'QR Check-in' },
];

// Visual paid-event pipeline: what happens, in order, with the fee shown first.
function PaidFlowSection() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: '#0F1F5B', color: '#fff', borderRadius: { xs: 4, md: 6 }, px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
          <Typography sx={{ color: '#9DB4FF', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em' }}>
            PAID EVENT FLOW
          </Typography>
          <Typography component="h2" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', md: '2.2rem' }, letterSpacing: '-0.04em', mt: 1.5 }}>
            The registration fee is shown before you pay. Always.
          </Typography>
          <Typography sx={{ opacity: 0.85, fontSize: 15, lineHeight: 1.7, mt: 1.5, maxWidth: 640 }}>
            Fill the form, review everything including the exact payable amount, apply an eligible
            coupon, then complete payment. Your ticket is issued on confirmation — free events skip
            the coupon and payment steps entirely.
          </Typography>

          <Box sx={{ mt: 4, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch', gap: 0, rowGap: 2 }}>
            {FLOW.map((s, i) => (
              <Fragment key={s.label}>
                <Box sx={{ flex: '1 1 120px', minWidth: 0, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, p: 2, textAlign: 'center' }}>
                  <s.icon sx={{ fontSize: 26, color: '#9DB4FF' }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 13, mt: 1, lineHeight: 1.4 }}>{s.label}</Typography>
                </Box>
                {i < FLOW.length - 1 && (
                  <Box sx={{ display: { xs: 'none', md: 'grid' }, placeItems: 'center', px: 1 }}>
                    <ArrowForward sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
                  </Box>
                )}
              </Fragment>
            ))}
          </Box>

          <Typography variant="body2" sx={{ opacity: 0.7, mt: 3 }}>
            Coupon discounts are calculated once on the server and snapshotted with your payment — the amount you confirm is final.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default PaidFlowSection;
