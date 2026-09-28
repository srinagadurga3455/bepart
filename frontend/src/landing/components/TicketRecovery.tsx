import { Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmationNumber } from '@mui/icons-material';

// Ticket recovery strip: participants with a ticket ID jump straight to it.
function TicketRecovery() {
  const navigate = useNavigate();
  const [ticketId, setTicketId] = useState('');

  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Box sx={{ bgcolor: '#EAF1FF', borderRadius: { xs: 4, md: 6 }, px: { xs: 3, md: 5 }, py: { xs: 4, md: 4.5 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 4 }}
            sx={{ textAlign: { xs: 'center', md: 'left' }, alignItems: { xs: 'center', md: 'center' } }}
          >
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: '#DCE6FF', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <ConfirmationNumber sx={{ fontSize: 34, color: 'primary.main' }} />
            </Box>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 21, md: 24 }, letterSpacing: '-0.04em' }}>
                Already registered?
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14.5, mt: 0.5 }}>
                Enter your ticket ID to open your digital ticket.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center', width: { xs: '100%', md: 'auto' } }}>
              <TextField
                size="small"
                placeholder="Ticket ID"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && ticketId.trim()) navigate(`/ticket/${ticketId.trim()}`); }}
                sx={{ bgcolor: '#fff', borderRadius: 2, minWidth: { xs: '100%', sm: 240 } }}
              />
              <Button
                variant="contained"
                disabled={!ticketId.trim()}
                onClick={() => navigate(`/ticket/${ticketId.trim()}`)}
                sx={{ borderRadius: 999, boxShadow: 'none' }}
              >
                Open Ticket
              </Button>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

export default TicketRecovery;
