import { Box, Button, Container, Grid, Typography } from '@mui/material';
import {
  ArrowForward,
  AssignmentOutlined,
  DashboardOutlined,
  EventAvailableOutlined,
  LocalOfferOutlined,
  QrCodeScannerOutlined,
  ReceiptOutlined,
  AccountBalanceWalletOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { BEPART_SUPPORT } from '../../app/config/support';

const GROUPS = [
  {
    icon: EventAvailableOutlined,
    title: 'CREATE',
    heading: 'Publish events in minutes',
    points: ['Event details, date and closing time', 'Banner and square posters', 'Free or paid registration type', 'Draft → preview → publish flow'],
  },
  {
    icon: AssignmentOutlined,
    title: 'CUSTOMIZE',
    heading: 'Forms built for your event',
    points: ['Multiple sections per form', 'Text, email, phone, dropdown, radio, checkbox fields', 'Required fields and options', 'Team / repeatable member groups'],
  },
  {
    icon: DashboardOutlined,
    title: 'MANAGE',
    heading: 'Everything in one console',
    points: ['Searchable registrations with dynamic answers', 'Participant details and payment state', 'Coupons with limits and expiry', 'Full transaction visibility per event'],
  },
  {
    icon: QrCodeScannerOutlined,
    title: 'CHECK IN',
    heading: 'Gates that move fast',
    points: ['QR participant verification', 'Valid, already-used and invalid results', 'Persisted check-in status', 'Live attendance counts'],
  },
  {
    icon: AccountBalanceWalletOutlined,
    title: 'WITHDRAW',
    heading: 'Get paid out',
    points: ['Withdraw collected fees anytime', 'REQUESTED → PROCESSING → PAID tracking', 'Transaction ID plus payment screenshot proof', 'Rejection reasons when a request fails'],
  },
];

const EXTRA = [
  { icon: LocalOfferOutlined, text: 'Percentage & fixed coupons' },
  { icon: ReceiptOutlined, text: 'Offline collection confirmation' },
];

// Major organizer platform section (anchor target for nav/footer).
// Describes only shipped organizer capabilities — no invented features.
function OrganizerSection() {
  const navigate = useNavigate();
  return (
    <Box component="section" id="organizers" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 8, md: 11 }, scrollMarginTop: 80 }}>
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: '#0F1F5B', color: '#fff', borderRadius: { xs: 4, md: 6 }, px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
          <Typography sx={{ color: '#9DB4FF', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em' }}>
            FOR ORGANIZERS
          </Typography>
          <Typography component="h2" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.7rem', md: '2.4rem' }, letterSpacing: '-0.04em', mt: 1.5, maxWidth: 640 }}>
            Host your event on BePart — from form to payout.
          </Typography>
          <Typography sx={{ opacity: 0.85, fontSize: 15.5, lineHeight: 1.7, mt: 1.5, maxWidth: 640 }}>
            An admin creates your organizer account in minutes. You sign in with a one-time passcode —
            no passwords — and get everything below in one console.
          </Typography>

          <Grid container spacing={2.5} sx={{ mt: 3 }}>
            {GROUPS.map((g) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={g.title}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 3, p: 2.5, height: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
                    <g.icon sx={{ fontSize: 24, color: '#9DB4FF' }} />
                    <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#9DB4FF' }}>{g.title}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, mb: 1 }}>{g.heading}</Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {g.points.map((p) => (
                      <Typography component="li" key={p} variant="body2" sx={{ opacity: 0.85, lineHeight: 1.65 }}>{p}</Typography>
                    ))}
                  </Box>
                </Box>
              </Grid>
            ))}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {EXTRA.map((e) => (
                  <Box key={e.text} sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 999, px: 2, py: 1 }}>
                    <e.icon sx={{ fontSize: 17, color: '#9DB4FF' }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.text}</Typography>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1.5, mt: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate('/login')}
              sx={{ borderRadius: 999, bgcolor: '#fff', color: '#0F1F5B', fontWeight: 800, px: 3.5, '&:hover': { bgcolor: '#E8EDFF' } }}
            >
              Get Started as Organizer
            </Button>
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              New here? Contact {BEPART_SUPPORT.email} to get your organizer account.
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

export default OrganizerSection;
