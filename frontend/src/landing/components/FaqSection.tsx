import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Container, Typography } from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

export interface FaqItem {
  q: string;
  a: string;
}

// Canonical public FAQ — the 13 questions every visitor asks, answered from
// actual product behavior. Shared by the landing page and the support page.
export const LANDING_FAQS: FaqItem[] = [
  { q: 'What is BePart?', a: 'BePart is a campus event discovery and registration platform. Participants browse events, register through custom forms, pay where required, and get QR tickets. Organizers publish events, manage registrations and payments, run coupons and check-ins, and withdraw collected fees.' },
  { q: 'How do I register for an event?', a: 'Open the event, hit Register, complete the organizer\u2019s form section by section, review your answers and confirm. Free events finish immediately; paid events continue to the payment step.' },
  { q: 'Are all events paid?', a: 'No. Each event is marked Free or Paid. Free registration needs no payment; paid events show the exact fee before you pay.' },
  { q: 'How does a free event work?', a: 'Complete the registration form, confirm, and your digital ticket is issued instantly — no payment step at all.' },
  { q: 'How does a paid event work?', a: 'Complete the form, review the price, optionally apply a coupon, then initiate payment and complete it with the organizer. Your registration and ticket are issued automatically on confirmation.' },
  { q: 'Can I use a coupon?', a: 'Where the organizer configured coupons, yes — enter the code during payment. It is validated once on the server (event, active status, dates, usage limit) and the discount is snapshotted on your payment.' },
  { q: 'How do I receive my ticket?', a: 'Instantly on confirmation. Tickets are printable and mobile-friendly, with event and holder details, a registration reference and a QR code. Find them anytime under My Tickets.' },
  { q: 'What is the QR code?', a: 'Your ticket\u2019s verification link, encoded for scanning. Each ticket has its own code and admits one entry unless the registration covers a team.' },
  { q: 'How does event check-in work?', a: 'Show your QR at the gate. The organizer scans it with BePart: valid tickets check in instantly, already-used tickets show their check-in time, and invalid codes are rejected.' },
  { q: 'Can organizers create custom registration forms?', a: 'Yes — multi-section forms with text, email, phone, dropdown, radio and checkbox questions, required rules, options and repeatable team-member groups, all previewable before publishing.' },
  { q: 'Can organizers manage registrations?', a: 'Yes — searchable, filterable registrations with each participant\u2019s dynamic answers, payment state and check-in status, plus per-event transaction visibility.' },
  { q: 'How do refunds/cancellations work?', a: 'Cancel upcoming registrations anytime from your dashboard. Paid-event refunds are issued by the event organizer; contact them first, then BePart support with your ticket ID if they are unresponsive. Full details are in the Refund & Cancellation Policy.' },
  { q: 'How do I contact BePart?', a: 'Use the Contact page for the official support email and phone, or the Support page for FAQs and ticket lookup.' },
];

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | false>(0);
  return (
    <Box>
      {items.map((f, i) => (
        <Accordion key={f.q} expanded={open === i} onChange={(_, v) => setOpen(v ? i : false)}
          sx={{ borderRadius: 2, mb: 1, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{f.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{f.a}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}

function FaqSection() {
  return (
    <Box component="section" id="faq" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 8, md: 11 }, scrollMarginTop: 80 }}>
      <Container maxWidth="md">
        <Typography align="center" sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          FAQ
        </Typography>
        <Typography component="h2" align="center" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}>
          Questions, answered
        </Typography>
        <Box sx={{ mt: { xs: 3, md: 4 } }}>
          <FaqAccordion items={LANDING_FAQS} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mt: 3, flexWrap: 'wrap' }}>
          <Button variant="outlined" component={RouterLink} to="/support" sx={{ borderRadius: 999 }}>
            More help & FAQs
          </Button>
          <Button variant="outlined" component={RouterLink} to="/contact" sx={{ borderRadius: 999 }}>
            Contact us
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

export default FaqSection;
