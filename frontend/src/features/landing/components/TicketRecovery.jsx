import { Box, Button, Container, Stack, TextField, Typography } from '@mui/material';
import { ConfirmationNumber } from '@mui/icons-material';

function TicketRecovery() {
  return (
    <Box
      component="section"
      sx={{
        px: { xs: 2, sm: 3, lg: 4 },
        pb: { xs: 7, md: 9 },
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            bgcolor: '#EAF0FF',
            borderRadius: { xs: 4, md: 6 },
            px: { xs: 3, md: 5 },
            py: { xs: 4, md: 4.5 },
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'center', md: 'center' }}
            spacing={{ xs: 3, md: 4 }}
            sx={{ textAlign: { xs: 'center', md: 'left' } }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: '#DCE6FF',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <ConfirmationNumber sx={{ fontSize: 34, color: 'primary.main' }} />
            </Box>

            <Box sx={{ flexGrow: 1 }}>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: 21, md: 24 },
                  letterSpacing: '-0.04em',
                }}
              >
                Already Registered?
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: 14.5, md: 15 },
                  lineHeight: 1.6,
                  mt: 0.75,
                  maxWidth: 470,
                }}
              >
                Lost or missed your ticket? Find your registration using your registered mobile
                number.
              </Typography>
            </Box>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ width: { xs: '100%', sm: 'auto' }, alignItems: { xs: 'stretch', sm: 'center' } }}
            >
              <TextField
                placeholder="Mobile number"
                inputMode="tel"
                size="small"
                sx={{
                  width: { xs: '100%', sm: 250 },
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 999,
                    bgcolor: '#fff',
                    fontSize: 14,
                  },
                  '& .MuiOutlinedInput-input': { py: 1.15, px: 2 },
                }}
              />
              <Button
                variant="contained"
                sx={{
                  bgcolor: 'text.primary',
                  borderColor: 'text.primary',
                  color: '#fff',
                  px: 3,
                  py: 1.15,
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    borderColor: 'primary.main',
                    boxShadow: 'none',
                  },
                }}
              >
                Find My Ticket
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

export default TicketRecovery;