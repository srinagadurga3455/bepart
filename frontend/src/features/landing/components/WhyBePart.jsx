import { Box, Container, Stack, Typography } from '@mui/material';
import {
  CalendarMonth,
  ConfirmationNumber,
  Payments,
  QrCodeScanner,
  WhatsApp,
} from '@mui/icons-material';

const features = [
  {
    title: 'Digital Tickets',
    description: 'Get your event ticket instantly.',
    icon: ConfirmationNumber,
  },
  {
    title: 'Secure Payments',
    description: 'Payments are verified before tickets are issued.',
    icon: Payments,
  },
  {
    title: 'WhatsApp Delivery',
    description: 'Receive your ticket through WhatsApp.',
    icon: WhatsApp,
  },
  {
    title: 'Fast QR Check-in',
    description: 'Scan and verify tickets at the event entrance.',
    icon: QrCodeScanner,
  },
];

function WhyBePart() {
  return (
    <Box
      component="section"
      sx={{
        px: { xs: 2, sm: 3, lg: 4 },
        pb: { xs: 8, md: 11 },
      }}
    >
      <Container maxWidth="lg">
        <Typography
          align="center"
          sx={{
            color: 'primary.main',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          Why BePart
        </Typography>

        <Typography
          component="h2"
          align="center"
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' },
            letterSpacing: '-0.05em',
            lineHeight: 1.15,
            mt: 2,
          }}
        >
          Everything you need for campus events.
        </Typography>

        <Box
          sx={{
            mt: { xs: 5, md: 7 },
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: { xs: 2.5, md: 2.5 },
          }}
        >
          {features.map(({ title, description, icon: Icon }) => (
            <Box
              key={title}
              sx={{
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '18px',
                px: 3,
                py: 4,
                textAlign: 'center',
                boxShadow: '0 1px 2px rgba(23, 23, 23, 0.03)',
              }}
            >
              <Box
                sx={{
                  width: 50,
                  height: 50,
                  mx: 'auto',
                  borderRadius: '50%',
                  bgcolor: '#EAF0FF',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Icon sx={{ fontSize: 24, color: 'primary.main' }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: 16.5,
                  letterSpacing: '-0.03em',
                  mt: 2.25,
                }}
              >
                {title}
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  mt: 1,
                }}
              >
                {description}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            position: 'relative',
            overflow: 'hidden',
            mt: { xs: 7, md: 9 },
            borderRadius: { xs: 4, md: 6 },
            bgcolor: '#EAF0FF',
            px: { xs: 3, md: 6 },
            py: { xs: 4.5, md: 5.5 },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              width: { xs: 170, md: 260 },
              height: { xs: 170, md: 260 },
              borderRadius: '50%',
              bgcolor: '#DCE6FF',
              right: { xs: -60, md: 40 },
              bottom: { xs: -90, md: -110 },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: { xs: 90, md: 130 },
              height: { xs: 90, md: 130 },
              borderRadius: '50%',
              bgcolor: '#D6E2FF',
              right: { xs: 40, md: 250 },
              top: { xs: -40, md: -50 },
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              width: 70,
              height: 70,
              borderRadius: '50%',
              border: '10px solid #D6E2FF',
              right: { xs: -24, md: -20 },
              top: { xs: '30%', md: '35%' },
            }}
          />

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            spacing={3}
            sx={{ position: 'relative', zIndex: 1 }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: '#fff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarMonth sx={{ fontSize: 30, color: 'primary.main' }} />
            </Box>
            <Box>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: 24, md: 28 },
                  letterSpacing: '-0.05em',
                }}
              >
                BePart
              </Typography>
              <Typography
                sx={{
                  color: 'text.secondary',
                  fontSize: { xs: 14.5, md: 15.5 },
                  mt: 0.5,
                }}
              >
                One platform for every campus event.
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

export default WhyBePart;