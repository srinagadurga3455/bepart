import { Box, Container, Typography } from '@mui/material';
import {
  AppRegistrationOutlined,
  BlockOutlined,
  DashboardCustomizeOutlined,
  ReceiptLongOutlined,
  SearchOffOutlined,
  StadiumOutlined,
} from '@mui/icons-material';

const PROBLEMS = [
  { icon: SearchOffOutlined, title: 'Scattered event discovery', text: 'Events buried in chats, posters and word of mouth — easy to miss, hard to compare.' },
  { icon: AppRegistrationOutlined, title: 'Separate registration forms', text: 'A different form link for every event, none of them connected to tickets or payments.' },
  { icon: DashboardCustomizeOutlined, title: 'Manual participant management', text: 'Spreadsheets of names, phones and payments maintained by hand.' },
  { icon: ReceiptLongOutlined, title: 'Manual ticket handling', text: 'Screenshots, lists and guesswork at the gate instead of verifiable tickets.' },
  { icon: StadiumOutlined, title: 'Difficult attendance & check-in', text: 'No reliable way to know who showed up, or to stop duplicate entries.' },
  { icon: BlockOutlined, title: 'Fragmented organizer workflows', text: 'Forms here, payments there, payouts somewhere else — nothing in one place.' },
];

// The problem BePart addresses, then the unification payoff.
function ProblemSection() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography
          align="center"
          sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}
        >
          The Problem
        </Typography>
        <Typography
          component="h2"
          align="center"
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2, maxWidth: 700, mx: 'auto' }}
        >
          Campus events run on chaos. BePart brings the whole workflow together.
        </Typography>

        <Box
          sx={{
            mt: { xs: 4, md: 6 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 2,
          }}
        >
          {PROBLEMS.map((p) => (
            <Box key={p.title} sx={{ bgcolor: '#FFFFFF', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: '50%', bgcolor: '#FDECEC', color: '#DC2626', display: 'grid', placeItems: 'center', mb: 1.5 }}>
                <p.icon sx={{ fontSize: 22 }} />
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: 15, mb: 0.5 }}>{p.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{p.text}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 3, bgcolor: '#EAF1FF', borderRadius: 3, px: { xs: 2.5, md: 4 }, py: { xs: 2.5, md: 3 }, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: 15, md: 17 }, letterSpacing: '-0.01em' }}>
            One flow instead of six workarounds: discover → details → register → pay → ticket → check-in.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Participants get tickets in minutes. Organizers get registrations, payments, coupons, check-in and payouts in one console.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

export default ProblemSection;
