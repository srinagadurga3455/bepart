import { Box, Button, Container, Grid, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { BEPART_BRAND } from '../../app/config/support';

// "What is BePart" product explainer: what it is, the problem it solves,
// and how each side uses it. Placed right after the hero.
function WhatIsBePart() {
  const navigate = useNavigate();
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography
          align="center"
          sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          What is BePart?
        </Typography>
        <Typography
          component="h2"
          align="center"
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2, maxWidth: 720, mx: 'auto' }}
        >
          One platform for campus events — discovery to check-in.
        </Typography>
        <Typography align="center" sx={{ color: 'text.secondary', fontSize: { xs: 15, md: 16.5 }, lineHeight: 1.7, mt: 2, maxWidth: 680, mx: 'auto' }}>
          {BEPART_BRAND.name} replaces scattered forms, spreadsheets, cash collections and
          gate chaos with one flow: discover, register, pay, ticket, scan.
        </Typography>

        <Grid container spacing={2.5} sx={{ mt: { xs: 3, md: 4 } }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid', borderColor: 'divider', borderRadius: 4, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: 'primary.main' }}>PARTICIPANTS</Typography>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 21, mt: 0.5 }}>Find events. Get tickets.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.75 }}>
                Browse published events, review full details, register through guided forms,
                pay where required with server-validated coupons, and keep QR tickets in one dashboard.
              </Typography>
              <Button variant="text" onClick={() => navigate('/events')} sx={{ mt: 1.5, px: 0, fontWeight: 700 }}>
                Explore events
              </Button>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ bgcolor: '#0F1F5B', color: '#fff', borderRadius: 4, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#9DB4FF' }}>ORGANIZERS</Typography>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 21, mt: 0.5 }}>Host events. Get payouts.</Typography>
              <Typography variant="body2" sx={{ opacity: 0.85, mt: 1, lineHeight: 1.75 }}>
                Publish events with custom registration forms, manage participants, track
                transactions and coupons, scan check-ins, and withdraw collected fees.
              </Typography>
              <Button variant="text" component="a" href="#organizers" sx={{ mt: 1.5, px: 0, fontWeight: 700, color: '#9DB4FF' }}>
                For organizers
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default WhatIsBePart;
