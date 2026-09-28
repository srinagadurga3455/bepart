import { Box, Container, Grid, Typography } from '@mui/material';
import { BadgeOutlined, EventOutlined, PersonOutlined, QrCodeScannerOutlined, ScheduleOutlined } from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { BePartMark } from '../../app/components/BePartBrand';

// Realistic ticket preview built from the actual ticket UI structure.
// The sample QR encodes the public ticketing guide (a real route), so the
// preview demonstrates the format without faking a real ticket.
function TicketMock() {
  const sampleValue = `${window.location.origin}/ticketing`;
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 4, overflow: 'hidden', boxShadow: '0 24px 60px -24px rgba(16,24,40,0.3)', maxWidth: 420, mx: 'auto', width: '100%' }}>
      <Box sx={{ bgcolor: '#16A34A', color: '#fff', px: 3, py: 2.5, textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16 }}>Registration Confirmed</Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>Show this ticket at the entry gate</Typography>
      </Box>
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <BePartMark size={26} fontSize={15} />
        <Typography sx={{ fontWeight: 800, fontSize: 20, mt: 1.5 }}>Campus Hackathon 2026</Typography>
        <Typography variant="body2" color="text.secondary">Sample ticket preview · by Tech Club</Typography>

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mt: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, bgcolor: '#EAF1FF', color: 'primary.main', borderRadius: 999, px: 1.5, py: 0.5 }}>CONFIRMED</Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 800, bgcolor: '#E7F7EE', color: '#15803D', borderRadius: 999, px: 1.5, py: 0.5 }}>PAID</Typography>
        </Box>

        <Box sx={{ borderTop: '1px dashed', borderColor: 'divider', my: 2.5 }} />

        <Box sx={{ bgcolor: '#fff', p: 1.5, borderRadius: 3, border: '2px solid', borderColor: 'divider', display: 'inline-block', lineHeight: 0 }}>
          <QRCodeSVG value={sampleValue} size={150} bgColor="#FFFFFF" fgColor="#000000" level="M" includeMargin title="Sample ticket QR preview" />
        </Box>
        <Typography sx={{ fontWeight: 700, fontSize: 13.5, mt: 1 }}>Scan at entry</Typography>
        <Typography variant="caption" color="text.secondary">Entry QR · one scan per ticket</Typography>

        <Box sx={{ borderTop: '1px dashed', borderColor: 'divider', my: 2.5 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left' }}>
          {[
            { icon: <EventOutlined sx={{ fontSize: 16 }} />, k: 'Date', v: '15 March 2026' },
            { icon: <ScheduleOutlined sx={{ fontSize: 16 }} />, k: 'Time', v: '10:00 AM' },
            { icon: <PersonOutlined sx={{ fontSize: 16 }} />, k: 'Holder', v: 'Participant name' },
            { icon: <BadgeOutlined sx={{ fontSize: 16 }} />, k: 'Reference', v: 'Issued per registration' },
          ].map((r) => (
            <Box key={r.k} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box sx={{ color: 'text.secondary', display: 'grid', placeItems: 'center' }}>{r.icon}</Box>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 70 }}>{r.k}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.v}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

const POINTS = [
  { title: 'Event details', text: 'Name, date and time, organizer and registration reference on every ticket.' },
  { title: 'Participant details', text: 'Holder name and submitted answers travel with the ticket for verification.' },
  { title: 'QR code', text: 'Each ticket encodes its own verification link — one scan per ticket.' },
  { title: 'Check-in status', text: 'Valid scans check in instantly; already-used tickets show their check-in time; invalid codes are rejected.' },
];

function TicketShowcase() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography align="center" sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Digital Tickets
        </Typography>
        <Typography component="h2" align="center" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}>
          A ticket that works as good as it looks
        </Typography>
        <Typography align="center" color="text.secondary" sx={{ mt: 1.5, maxWidth: 620, mx: 'auto', fontSize: 15, lineHeight: 1.7 }}>
          Printable and mobile-friendly, with everything the gate needs — and nothing it doesn&apos;t.
        </Typography>

        <Grid container spacing={4} sx={{ mt: { xs: 3, md: 4 }, alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TicketMock />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {POINTS.map((p, i) => (
                <Box key={p.title} sx={{ display: 'flex', gap: 2, bgcolor: '#FFFFFF', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#EAF1FF', color: 'primary.main', display: 'grid', placeItems: 'center', fontWeight: 800, flexShrink: 0 }}>
                    {i + 1}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 15 }}>{p.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, mt: 0.5 }}>{p.text}</Typography>
                  </Box>
                </Box>
              ))}
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', bgcolor: '#F8FAFF', border: '1px dashed', borderColor: '#D9E2FF', borderRadius: 3, p: 2.5 }}>
                <QrCodeScannerOutlined color="primary" />
                <Typography variant="body2" color="text.secondary">
                  At the gate, organizers scan with the BePart check-in tool — ownership-enforced, persisted, instant.
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default TicketShowcase;
