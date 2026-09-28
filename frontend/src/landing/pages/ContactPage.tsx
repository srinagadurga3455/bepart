import { useState } from 'react';
import { Box, Button, Card, CardContent, Container, FormControl, Grid, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import { EmailOutlined, PhoneOutlined, ScheduleOutlined, SendOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import LegalLayout, { LegalSection } from '../components/LegalLayout';
import { BEPART_BRAND, BEPART_SUPPORT } from '../../app/config/support';

const SUPPORT_CATEGORIES = [
  'Ticket help',
  'Refund request',
  'Registration issue',
  'Organizer onboarding',
  'Payout question',
  'Something else',
];

function ContactCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 3, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ width: 46, height: 46, borderRadius: '50%', bgcolor: '#EAF1FF', color: '#2557F5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{label}</Typography>
          <Typography component="a" href={href} sx={{ fontWeight: 800, fontSize: 16, color: 'inherit', textDecoration: 'none', overflowWrap: 'anywhere', '&:hover': { color: 'primary.main' } }}>
            {value}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

// Contact page uses ONLY the centralized support constants â€” no invented details.
export default function ContactPage() {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState({ name: '', email: '', category: SUPPORT_CATEGORIES[0], message: '' });

  const submit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      enqueueSnackbar('Please fill name, email and message.', { variant: 'warning' });
      return;
    }
    // No ticket backend exists yet: hand the user a pre-addressed email draft.
    const subject = encodeURIComponent(`[${form.category}] BePart support request from ${form.name.trim()}`);
    const body = encodeURIComponent(`${form.message.trim()}\n\nâ€” ${form.name.trim()} (${form.email.trim()})`);
    window.location.href = `mailto:${BEPART_SUPPORT.email}?subject=${subject}&body=${body}`;
    enqueueSnackbar('Opening your email app to send the message.', { variant: 'success' });
  };

  return (
    <LegalLayout
      eyebrow="CONTACT"
      title="Contact Us"
      intro={`Talk to the ${BEPART_BRAND.name} team â€” support, tickets, organizer onboarding and platform questions.`}
    >
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ContactCard icon={<EmailOutlined />} label="Email" value={BEPART_SUPPORT.email} href={`mailto:${BEPART_SUPPORT.email}`} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ContactCard icon={<PhoneOutlined />} label="Phone" value={BEPART_SUPPORT.phone} href={BEPART_SUPPORT.phoneHref} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <ContactCard icon={<ScheduleOutlined />} label="Support hours" value={BEPART_SUPPORT.hours} href={`mailto:${BEPART_SUPPORT.email}`} />
        </Grid>
      </Grid>

      <LegalSection title="Send us a message">
        <p>Fill this in and weâ€™ll open a pre-addressed email to the support team â€” nothing is sent until you hit send in your mail app.</p>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Your name" size="small" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="Your email" size="small" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <FormControl size="small" fullWidth>
            <InputLabel>Topic</InputLabel>
            <Select label="Topic" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {SUPPORT_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="How can we help?" size="small" multiline rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} fullWidth />
          <Box>
            <Button variant="contained" startIcon={<SendOutlined />} onClick={submit} sx={{ borderRadius: 999, boxShadow: 'none', px: 3.5 }}>
              Compose Email
            </Button>
          </Box>
        </Box>
      </LegalSection>

      <LegalSection title="Before you write">
        <ul>
          <li><strong>Ticket issues:</strong> include your ticket ID (from My Tickets) and the event name.</li>
          <li><strong>Refund requests:</strong> contact the event organizer first (see Refund Policy), then us with payment evidence.</li>
          <li><strong>Organizer onboarding:</strong> tell us your club/organization name â€” an admin creates organizer accounts.</li>
        </ul>
      </LegalSection>

      <Container disableGutters sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Response times vary with volume; we reply during support hours above.
        </Typography>
      </Container>
    </LegalLayout>
  );
}
