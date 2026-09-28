import { Box, Container, Grid, Typography } from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';

const FREE_STEPS = ['Complete the registration form', 'Confirm your registration', 'Receive your digital ticket'];
const PAID_STEPS = [
  'Complete the registration form',
  'Review the price before paying',
  'Apply an eligible coupon, if you have one',
  'Complete the payment',
  'Receive your digital ticket',
];

// Free vs paid, side by side. Refund behavior intentionally references the
// policy page instead of claiming universal rules.
function FreeVsPaid() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography align="center" sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Pricing Models
        </Typography>
        <Typography component="h2" align="center" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}>
          Free or paid — always clear upfront
        </Typography>

        <Grid container spacing={2.5} sx={{ mt: { xs: 3, md: 4 }, maxWidth: 900, mx: 'auto' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ bgcolor: '#E7F7EE', borderRadius: 4, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#15803D' }}>FREE EVENTS</Typography>
              <Typography variant="body2" sx={{ color: '#3F6212', mt: 0.5, mb: 2 }}>No payment. Ticket issued instantly.</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {FREE_STEPS.map((s, i) => (
                  <Box key={s} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', bgcolor: '#fff', borderRadius: 2, p: 1.75 }}>
                    <CheckCircleOutlined sx={{ fontSize: 20, color: '#15803D', flexShrink: 0, mt: 0.1 }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{i + 1}. {s}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ bgcolor: '#EAF1FF', borderRadius: 4, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
              <Typography sx={{ fontWeight: 800, fontSize: 20, color: 'primary.main' }}>PAID EVENTS</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>Fee shown first. Ticket on confirmation.</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {PAID_STEPS.map((s, i) => (
                  <Box key={s} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', bgcolor: '#fff', borderRadius: 2, p: 1.75 }}>
                    <CheckCircleOutlined sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0, mt: 0.1 }} />
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{i + 1}. {s}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Typography align="center" variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
          Cancellation and refund terms depend on the event — see the Refund &amp; Cancellation Policy.
        </Typography>
      </Container>
    </Box>
  );
}

export default FreeVsPaid;
