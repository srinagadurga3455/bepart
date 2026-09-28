import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, Card, CardContent,
  Container, Grid, TextField, Typography,
} from '@mui/material';
import {
  ConfirmationNumberOutlined, EmailOutlined, HeadsetMicOutlined,
  LocalOfferOutlined, PaymentsOutlined, PhoneOutlined, QrCodeScannerOutlined,
  ScheduleOutlined,
} from '@mui/icons-material';
import ParticipantNavbar from '../../components/ParticipantNavbar';
import { BEPART_BRAND, BEPART_SUPPORT } from '../../../app/config/support';
import { BePartMark } from '../../../app/components/BePartBrand';
import { FaqAccordion } from '../../../landing/components/FaqSection';
import { usePageMeta } from '../../../app/utils/pageMeta';

const PARTICIPANT_FAQS = [
  {
    q: 'How do I register for an event?',
    a: 'Browse events, open the one you like, and hit Register. Fill the organizer\u2019s form section by section, review your answers, and confirm. For paid events you initiate the payment and complete it with the organizer â€” your ticket is issued after confirmation.',
  },
  {
    q: 'Where is my ticket?',
    a: 'After registration you get a ticket page with a QR code. Lost it? Open My Tickets from the navbar and enter your ticket ID, or sign in to see all your registrations.',
  },
  {
    q: 'How do coupons work?',
    a: 'If the event accepts coupons, enter your code on the payment step. The discount is calculated on the server exactly once â€” what you see as payable is final, and the price snapshot stays on your registration.',
  },
  {
    q: 'What happens at the gate?',
    a: 'Show your ticket QR. The organizer scans it with the BePart check-in tool: valid tickets check in instantly, already-used tickets are flagged, and invalid codes are rejected.',
  },
  {
    q: 'Can I cancel a registration?',
    a: 'Yes â€” open My Tickets (sign in first) and cancel any upcoming registration. Paid registrations follow the organizer\u2019s refund policy; contact them or the BePart team.',
  },
];

const ORGANIZER_FAQS = [
  {
    q: 'How do I start hosting on BePart?',
    a: 'An admin creates your organizer account, you sign in with OTP, then create events: details, a custom multi-section registration form with preview, posters, and publish.',
  },
  {
    q: 'Can I collect payments and offer coupons?',
    a: 'Yes. Mark events paid with a registration fee, create percentage or fixed-amount coupons with usage limits and expiry, and track every transaction. Offline collections can be confirmed in one click.',
  },
  {
    q: 'How do payouts work?',
    a: 'Request a withdrawal against collected fees any time. The admin processes it, uploads the transaction proof, and you track REQUESTED \u2192 PROCESSING \u2192 PAID (or REJECTED with a reason) in real time.',
  },
  {
    q: 'How do I manage participants on event day?',
    a: 'Use the Check-In page to scan tickets, the Registrations page to search/filter every participant with their dynamic answers, and the dashboard for revenue and attendance at a glance.',
  },
];

function StepCard({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#EAF1FF', color: '#2557F5', display: 'grid', placeItems: 'center', fontWeight: 800, mb: 1.5 }}>
          {n}
        </Box>
        <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{text}</Typography>
      </CardContent>
    </Card>
  );
}

export default function SupportPage() {
  usePageMeta('Support & FAQ', 'BePart help center: how registration, tickets, QR check-in and payouts work, plus support contact details.');
  const [ticketId, setTicketId] = useState('');
  return (
    <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
      <ParticipantNavbar />

      {/* Hero */}
      <Box sx={{ bgcolor: '#0F1F5B', color: '#fff', overflow: 'hidden' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 5, md: 7 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 4, alignItems: 'center' }}>
          <Box>
            <Box sx={{ display: 'inline-flex', bgcolor: 'rgba(255,255,255,0.14)', borderRadius: 999, px: 2, py: 0.5, mb: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>HELP CENTER</Typography>
            </Box>
            <Typography component="h1" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 30, md: 42 }, letterSpacing: '-0.04em', lineHeight: 1.1, mb: 2 }}>
              Campus events, without the chaos.
            </Typography>
            <Typography sx={{ fontSize: 15.5, opacity: 0.85, lineHeight: 1.7, maxWidth: 560 }}>
              {BEPART_BRAND.name} replaces scattered Google Forms, spreadsheets, cash collections and
              gate chaos with one flow: discover â†’ register â†’ pay â†’ ticket â†’ scan. Participants get
              tickets in minutes; organizers get registrations, payments, coupons, check-in and payouts in one console.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
              <Button variant="contained" component={RouterLink} to="/events" sx={{ borderRadius: 999, bgcolor: '#fff', color: '#0F1F5B', fontWeight: 800, '&:hover': { bgcolor: '#E8EDFF' } }}>
                Find an event
              </Button>
              <Button variant="outlined" component={RouterLink} to="/login" sx={{ borderRadius: 999, color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }}>
                Organizer sign in
              </Button>
            </Box>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'grid' }, placeItems: 'center' }}>
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 5, p: 4, textAlign: 'center' }}>
              <HeadsetMicOutlined sx={{ fontSize: 72, opacity: 0.9 }} />
              <Typography sx={{ fontWeight: 800, mt: 1 }}>{BEPART_SUPPORT.email}</Typography>
              <Typography sx={{ opacity: 0.8, fontSize: 14 }}>{BEPART_SUPPORT.phone} Â· {BEPART_SUPPORT.hours}</Typography>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* How it works */}
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em', mb: 0.5 }}>How {BEPART_BRAND.name} works</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>One platform, two happy sides.</Typography>
        <Grid container spacing={2.5} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StepCard n="1" title="Organizers publish" text="Details, custom multi-section forms, posters, fees and coupons â€” previewed exactly as participants see them." />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StepCard n="2" title="Participants register" text="Section-by-section forms with validation, review before confirm, server-calculated coupons, instant tickets with QR." />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StepCard n="3" title="Gates scan & check in" text="QR check-in validates tickets live: valid, already-used and invalid codes each get a clear result." />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StepCard n="4" title="Money settles" text="Transactions stay visible per event; organizers withdraw collected fees and track payouts to PAID with proof." />
          </Grid>
        </Grid>

        {/* Feature highlights */}
        <Grid container spacing={2.5} sx={{ mb: 5 }}>
          {[
            { icon: <ConfirmationNumberOutlined color="primary" />, t: 'Tickets with QR', d: 'Printable, mobile-friendly tickets with entry QR and instructions.' },
            { icon: <LocalOfferOutlined color="primary" />, t: 'Coupons & pricing', d: 'Percentage/fixed codes with limits, expiry and price snapshots.' },
            { icon: <QrCodeScannerOutlined color="primary" />, t: 'Gate check-in', d: 'Ownership-enforced scanning with persisted attendance.' },
            { icon: <PaymentsOutlined color="primary" />, t: 'Payouts with proof', d: 'Withdrawal lifecycle with transaction IDs and screenshots.' },
          ].map((f) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={f.t}>
              <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
                <CardContent>
                  {f.icon}
                  <Typography sx={{ fontWeight: 800, mt: 1 }}>{f.t}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.d}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* FAQs */}
        <Grid container spacing={3} sx={{ mb: 5 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>For participants</Typography>
            <FaqAccordion items={PARTICIPANT_FAQS} />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>For organizers</Typography>
            <FaqAccordion items={ORGANIZER_FAQS} />
          </Grid>
        </Grid>

        {/* Ticket lookup + contact */}
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Lost your ticket?</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Enter the ticket ID from your confirmation.</Typography>
                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                  <TextField label="Ticket ID" size="small" value={ticketId} onChange={(e) => setTicketId(e.target.value)}
                    sx={{ flex: '1 1 200px' }} />
                  <Button variant="contained" component={RouterLink} to={`/ticket/${ticketId.trim()}`} disabled={!ticketId.trim()}
                    sx={{ borderRadius: 999, boxShadow: 'none' }}>
                    Open
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined" sx={{ borderRadius: 3, height: '100%', bgcolor: '#0F1F5B', color: '#fff' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>Talk to the {BEPART_BRAND.name} team</Typography>
                <Typography variant="body2" sx={{ opacity: 0.85, mb: 2 }}>
                  Support, tickets and platform questions â€” {BEPART_SUPPORT.hours}.
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <EmailOutlined sx={{ fontSize: 18, opacity: 0.8 }} />
                    <Typography sx={{ fontWeight: 700 }}>{BEPART_SUPPORT.email}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <PhoneOutlined sx={{ fontSize: 18, opacity: 0.8 }} />
                    <Typography sx={{ fontWeight: 700 }}>{BEPART_SUPPORT.phone}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <ScheduleOutlined sx={{ fontSize: 18, opacity: 0.8 }} />
                    <Typography variant="body2" sx={{ opacity: 0.85 }}>{BEPART_SUPPORT.hours}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5, opacity: 0.9 }}>
          <BePartMark size={28} fontSize={16} />
        </Box>
      </Container>
    </Box>
  );
}
