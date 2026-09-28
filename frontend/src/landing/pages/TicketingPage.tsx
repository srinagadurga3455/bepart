import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Card, CardContent, Grid, Typography } from '@mui/material';
import {
  ArrowForward, ConfirmationNumberOutlined, CreditCardOutlined, ExploreOutlined,
  HowToRegOutlined, LocalOfferOutlined, QrCodeScannerOutlined, ReceiptOutlined,
  UndoOutlined,
} from '@mui/icons-material';
import LegalLayout, { LegalSection } from '../components/LegalLayout';

function StepCard({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#EAF1FF', color: '#2557F5', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>
            {n}
          </Box>
          {icon}
        </Box>
        <Typography sx={{ fontWeight: 800, mb: 0.5 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{text}</Typography>
      </CardContent>
    </Card>
  );
}

// Public explainer describing ONLY the registration & ticketing flow as
// actually implemented in BePart today.
export default function TicketingPage() {
  return (
    <LegalLayout
      eyebrow="GUIDE Â· PARTICIPANTS"
      title="Event Registration & Ticketing"
      intro="Exactly how discovering, registering, paying, ticketing and check-in work on BePart â€” no surprises on event day."
    >
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="1" icon={<ExploreOutlined color="primary" />} title="Discover an event"
            text="Browse the events page, search by name/organizer, and filter free vs paid. Each card shows the date, organizer, price and slots." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="2" icon={<ConfirmationNumberOutlined color="primary" />} title="Open event details"
            text="The detail page shows the banner gallery, organizer, date and closing time, description, price, coupon acceptance, seats left and a Register button." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="3" icon={<HowToRegOutlined color="primary" />} title="Complete registration"
            text="Fill the organizer's section-by-section form (required fields are enforced, team options expand as needed), then review everything before confirming. No login is needed." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="4" icon={<ReceiptOutlined color="primary" />} title="Free events: done instantly"
            text="Free events create your registration immediately after review. Your ticket page opens right away â€” no payment, no waiting." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="5" icon={<CreditCardOutlined color="primary" />} title="Paid events: initiate, then confirm"
            text="You initiate a pending payment with your phone number. Complete the amount with the organizer; they confirm it, and your registration plus ticket are issued automatically." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="6" icon={<LocalOfferOutlined color="primary" />} title="Coupons where accepted"
            text="Enter the code on the payment step. The server validates it (event, active status, dates, usage limit) and calculates the discount exactly once â€” the payable amount, original price and savings are snapshotted on your payment." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="7" icon={<ConfirmationNumberOutlined color="primary" />} title="Digital ticket + QR"
            text="Every confirmed registration gets a printable, mobile-friendly ticket: event branding, holder name, date/time, details and a QR code encoding your ticket link. The raw ticket ID is never displayed." />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StepCard n="8" icon={<QrCodeScannerOutlined color="primary" />} title="Event check-in"
            text="Show your QR at the gate. Organizers scan it: valid tickets check in instantly, already-used tickets are flagged with their check-in time, invalid codes are rejected." />
        </Grid>
      </Grid>

      <LegalSection title="Managing your tickets">
        <ul>
          <li><strong>My Tickets dashboard</strong> â€” sign in to see upcoming and past events, open tickets, and cancel upcoming registrations.</li>
          <li><strong>Lost a ticket?</strong> â€” open it directly with the ticket ID from your confirmation.</li>
          <li><strong>Payment confirmation</strong> â€” paid registrations appear with their status; pending ones activate once the organizer confirms.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Refunds & cancellations">
        <ul>
          <li>Cancel upcoming registrations anytime from the dashboard.</li>
          <li>Paid-event refunds are issued by the event organizer (see the full policy).</li>
        </ul>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.5 }}>
          <Button variant="outlined" component={RouterLink} to="/refunds" sx={{ borderRadius: 999 }}>
            Refund & Cancellation Policy
          </Button>
          <Button variant="outlined" component={RouterLink} to="/support" sx={{ borderRadius: 999 }}>
            Help & FAQ
          </Button>
        </Box>
      </LegalSection>

      <LegalSection title="Cancellations by organizers">
        <p>
          If an organizer cancels an event it disappears from discovery immediately. Contact the
          organizer for a refund of any amount paid, then BePart support if they are unresponsive.
        </p>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
          <Button variant="contained" component={RouterLink} to="/events" endIcon={<ArrowForward />} sx={{ borderRadius: 999, boxShadow: 'none' }}>
            Browse events
          </Button>
          <Button variant="outlined" component={RouterLink} to="/contact" startIcon={<UndoOutlined />} sx={{ borderRadius: 999 }}>
            Contact support
          </Button>
        </Box>
      </LegalSection>
    </LegalLayout>
  );
}
