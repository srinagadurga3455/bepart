import { Fragment } from 'react';
import { Box, Container, Typography } from '@mui/material';
import {
  ArrowForward,
  ConfirmationNumber,
  CreditCard,
  Explore,
  HowToReg,
  QrCodeScanner,
} from '@mui/icons-material';

const steps = [
  {
    title: 'Discover',
    description: 'Find events happening on campus.',
    icon: Explore,
  },
  {
    title: 'Register',
    description: 'Quickly register for events.',
    icon: HowToReg,
  },
  {
    title: 'Pay',
    description: 'Secure and simple payment.',
    icon: CreditCard,
  },
  {
    title: 'Get Ticket',
    description: 'Receive your digital ticket instantly.',
    icon: ConfirmationNumber,
  },
  {
    title: 'Check-in',
    description: 'Scan your QR code and get in.',
    icon: QrCodeScanner,
  },
];

function HowItWorks() {
  return (
    <Box
      component="section"
      sx={{
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 8, md: 11 },
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
          How BePart Works
        </Typography>

        <Typography
          component="h2"
          align="center"
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: '1.5rem', sm: '1.9rem', md: '2.3rem' },
            letterSpacing: '-0.05em',
            lineHeight: 1.2,
            mt: 2,
          }}
        >
          Discover → Register → Pay → Ticket → Check-in
        </Typography>

        <Box
          sx={{
            mt: { xs: 6, md: 8 },
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'flex-start',
            rowGap: 5,
            columnGap: { xs: 3, md: 1.5 },
          }}
        >
          {steps.map((step, index) => (
            <Fragment key={step.title}>
              <Box sx={{ width: { xs: 260, sm: 240, md: 158 }, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    mx: 'auto',
                    borderRadius: '50%',
                    bgcolor: '#EAF0FF',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <step.icon sx={{ fontSize: 26, color: 'primary.main' }} />
                </Box>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontWeight: 800,
                    fontSize: 16,
                    letterSpacing: '-0.03em',
                    mt: 1.75,
                  }}
                >
                  {step.title}
                </Typography>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    mt: 0.75,
                    px: { xs: 2, md: 0 },
                  }}
                >
                  {step.description}
                </Typography>
              </Box>

              {index < steps.length - 1 && (
                <Box
                  sx={{
                    display: { xs: 'none', md: 'flex' },
                    alignItems: 'center',
                    height: 58,
                    mt: 0,
                  }}
                >
                  <ArrowForward sx={{ fontSize: 20, color: '#C4C9D4' }} />
                </Box>
              )}
            </Fragment>
          ))}
        </Box>
      </Container>
    </Box>
  );
}

export default HowItWorks;