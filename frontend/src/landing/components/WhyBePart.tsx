import { Box, Container, Grid, Typography } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  ConfirmationNumberOutlined,
  DescriptionOutlined,
  EventAvailableOutlined,
  ExploreOutlined,
  HowToRegOutlined,
  InfoOutlined,
  LocalOfferOutlined,
  PaymentsOutlined,
  QrCodeScannerOutlined,
  ReceiptOutlined,
} from '@mui/icons-material';

const PARTICIPANT_CAPS = [
  { icon: ExploreOutlined, title: 'Event discovery', text: 'Search, filter and sort published events.' },
  { icon: InfoOutlined, title: 'Detailed event information', text: 'Date, organizer, price, coupons and seats before registering.' },
  { icon: HowToRegOutlined, title: 'Online registration', text: 'Guided forms with validation and review.' },
  { icon: PaymentsOutlined, title: 'Free and paid events', text: 'Instant confirmation or fee-first payment flow.' },
  { icon: ConfirmationNumberOutlined, title: 'Digital tickets', text: 'Printable tickets with QR codes.' },
  { icon: QrCodeScannerOutlined, title: 'QR check-in', text: 'Fast verified entry at the gate.' },
  { icon: ReceiptOutlined, title: 'Registration history', text: 'Upcoming, past and cancellations in one dashboard.' },
];

const ORGANIZER_CAPS = [
  { icon: EventAvailableOutlined, title: 'Event creation', text: 'Details, posters, slots, deadlines, publish flow.' },
  { icon: DescriptionOutlined, title: 'Custom forms', text: 'Sections, fields, required rules, team groups.' },
  { icon: HowToRegOutlined, title: 'Registration management', text: 'Searchable participants with dynamic answers.' },
  { icon: LocalOfferOutlined, title: 'Coupons', text: 'Percentage/fixed codes with limits and expiry.' },
  { icon: PaymentsOutlined, title: 'Transaction visibility', text: 'Every payment per event, with pricing snapshots.' },
  { icon: QrCodeScannerOutlined, title: 'QR check-in', text: 'Ownership-enforced scanning with live status.' },
  { icon: AccountBalanceWalletOutlined, title: 'Withdrawal workflow', text: 'Payouts tracked to PAID with proof.' },
];

function CapList({ items }: { items: { icon: React.ElementType; title: string; text: string }[] }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2.5 }}>
      {items.map((c) => (
        <Box key={c.title} sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
          <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#EAF1FF', color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <c.icon sx={{ fontSize: 19 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>{c.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>{c.text}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

// Capability-based "why": only things the platform actually does.
function WhyBePart() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 8, md: 11 } }}>
      <Container maxWidth="lg">
        <Typography
          align="center"
          sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          Why BePart
        </Typography>
        <Typography
          component="h2"
          align="center"
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}
        >
          Built for both sides of the gate
        </Typography>

        <Grid container spacing={2.5} sx={{ mt: { xs: 3, md: 4 } }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid', borderColor: 'divider', borderRadius: 4, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: 'primary.main' }}>FOR PARTICIPANTS</Typography>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 21, mt: 0.5 }}>Everything after “I’m in”</Typography>
              <CapList items={PARTICIPANT_CAPS} />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ bgcolor: '#0F1F5B', color: '#fff', borderRadius: 4, p: { xs: 2.5, md: 3.5 }, height: '100%' }}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', color: '#9DB4FF' }}>FOR ORGANIZERS</Typography>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 21, mt: 0.5 }}>Everything before “welcome in”</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2.5 }}>
                {ORGANIZER_CAPS.map((c) => (
                  <Box key={c.title} sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.1)', color: '#9DB4FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <c.icon sx={{ fontSize: 19 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>{c.title}</Typography>
                      <Typography variant="body2" sx={{ opacity: 0.8, lineHeight: 1.65 }}>{c.text}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default WhyBePart;
