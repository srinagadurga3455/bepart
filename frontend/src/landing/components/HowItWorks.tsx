import { Fragment } from 'react';
import { Box, Container, Typography } from '@mui/material';
import {
  ArrowForward,
  ConfirmationNumber,
  CreditCard,
  Explore,
  HowToReg,
  InfoOutlined,
  QrCodeScanner,
  VerifiedOutlined,
} from '@mui/icons-material';

// 7-step participant workflow with anchor id for nav/footer links.
const steps = [
  {
    title: 'Discover Event',
    description: 'Browse published events and find one to join.',
    icon: Explore,
  },
  {
    title: 'View Details',
    description: 'Date, organizer, price, slots and coupon info.',
    icon: InfoOutlined,
  },
  {
    title: 'Register',
    description: 'Fill the organizer\u2019s custom form and review.',
    icon: HowToReg,
  },
  {
    title: 'Pay if Required',
    description: 'Free events skip this. Paid events show the fee first.',
    icon: CreditCard,
  },
  {
    title: 'Receive Ticket',
    description: 'Digital ticket with QR is issued on confirmation.',
    icon: ConfirmationNumber,
  },
  {
    title: 'QR Check-in',
    description: 'Scan at the gate for instant verification.',
    icon: QrCodeScanner,
  },
  {
    title: 'Participate',
    description: 'Attend and enjoy the event.',
    icon: VerifiedOutlined,
  },
];

function HowItWorks() {
  return (
    <Box
      component="section"
      id="how-it-works"
      sx={{
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 8, md: 11 },
        scrollMarginTop: 80,
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
            fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' },
            letterSpacing: '-0.05em',
            lineHeight: 1.15,
            mt: 2,
          }}
        >
          From discovery to check-in in seven steps
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
              <Box sx={{ width: { xs: 260, sm: 240, md: 140 }, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 58,
                    height: 58,
                    mx: 'auto',
                    borderRadius: '50%',
                    bgcolor: '#EAF1FF',
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
                    fontSize: 15,
                    letterSpacing: '-0.02em',
                    mt: 1.75,
                  }}
                >
                  {index + 1}. {step.title}
                </Typography>
                <Typography
                  sx={{
                    color: 'text.secondary',
                    fontSize: 13,
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
