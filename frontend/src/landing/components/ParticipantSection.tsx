import { Box, Container, Typography } from '@mui/material';
import {
  ConfirmationNumberOutlined,
  CreditCardOutlined,
  ExploreOutlined,
  HowToRegOutlined,
  InfoOutlined,
  LocalOfferOutlined,
  QrCodeScannerOutlined,
} from '@mui/icons-material';

const STAGES = [
  { icon: ExploreOutlined, title: 'Discover', text: 'Browse published events. Search by name or organizer, filter free vs paid, and sort by date.' },
  { icon: InfoOutlined, title: 'Event details', text: 'Open any event for date and closing time, organizer, description, pricing, coupon acceptance and seats left — before you commit.' },
  { icon: HowToRegOutlined, title: 'Register', text: 'Complete the organizer\u2019s custom registration form section by section, with required-field validation and a full review before confirmation.' },
  { icon: CreditCardOutlined, title: 'Payment', text: 'Free events confirm immediately with no payment step. Paid events show the exact fee first; you initiate payment and the organizer confirms it.' },
  { icon: LocalOfferOutlined, title: 'Coupons', text: 'Where the organizer configured coupons, enter the code during payment. It is validated once on the server and the discount is snapshotted on your payment.' },
  { icon: ConfirmationNumberOutlined, title: 'Ticket', text: 'Receive a printable, mobile-friendly digital ticket: event and participant details, registration reference and a QR code.' },
  { icon: QrCodeScannerOutlined, title: 'Check-in', text: 'Show the QR at the gate. Organizers scan it for instant verification — valid, already-used and invalid codes each get a clear result.' },
];

// Full participant journey, one row per stage.
function ParticipantSection() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography align="center" sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Participant Experience
        </Typography>
        <Typography
          component="h2"
          align="center"
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}
        >
          Every stage, explained
        </Typography>

        <Box sx={{ mt: { xs: 4, md: 5 }, display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 860, mx: 'auto' }}>
          {STAGES.map((s, i) => (
            <Box key={s.title} sx={{ display: 'flex', gap: 2, bgcolor: '#FFFFFF', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 2, md: 2.5 }, alignItems: 'flex-start' }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#EAF1FF', color: 'primary.main', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800 }}>
                <s.icon sx={{ fontSize: 22 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 15 }}>
                  <Box component="span" sx={{ color: 'primary.main', mr: 1 }}>{String(i + 1).padStart(2, '0')}</Box>
                  {s.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mt: 0.5 }}>{s.text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default ParticipantSection;
