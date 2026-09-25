import {
  ArrowForward,
  CalendarMonth,
  ConfirmationNumber,
  Dashboard as DashboardIcon,
  QrCodeScanner,
  Search,
} from '@mui/icons-material';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const sidebarItems = [
  { label: 'Dashboard', icon: DashboardIcon, active: true },
  { label: 'Events', icon: CalendarMonth },
  { label: 'My Tickets', icon: ConfirmationNumber },
  { label: 'Check-in', icon: QrCodeScanner },
];

const previewEvents = [
  { title: 'Tech Conference 2026', meta: 'STEM Center · 10:00 AM', price: '₱ 250' },
  { title: 'Charity Fun Run', meta: 'Campus Oval · 6:00 AM', price: '₱ 150' },
  { title: 'Cultural Night', meta: 'Auditorium · 6:00 PM', price: 'Free' },
  { title: "Dean's Welcome", meta: 'Alumni Hall · 9:00 AM', price: 'Free' },
];

function DashboardIllustration() {
  return (
    <Box sx={{ position: 'relative' }}>
      <Box
        sx={{
          position: 'absolute',
          top: { xs: -20, md: -50 },
          right: { xs: -12, md: -44 },
          width: { xs: 150, md: 300 },
          height: { xs: 150, md: 300 },
          borderRadius: '50%',
          bgcolor: '#E2EAFF',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: { xs: -14, md: -36 },
          left: { xs: -14, md: -40 },
          width: { xs: 120, md: 220 },
          height: { xs: 120, md: 220 },
          borderRadius: '50%',
          bgcolor: '#DCE6FF',
          zIndex: 0,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: { xs: '38%', md: '44%' },
          right: { xs: -8, md: -54 },
          width: 76,
          height: 76,
          borderRadius: '50%',
          border: '10px solid #E2EAFF',
          zIndex: 0,
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          bgcolor: '#fff',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '24px',
          boxShadow: '0 24px 60px -18px rgba(23, 23, 23, 0.14)',
          overflow: 'hidden',
          transform: { xs: 'rotate(1.5deg)', md: 'rotate(3deg)' },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.4,
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: '#FCFCFB',
          }}
        >
          <Box sx={{ display: 'flex', gap: 0.7 }}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#E4E4E0' }} />
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#E4E4E0' }} />
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: '#E4E4E0' }} />
          </Box>
          <Box
            sx={{
              flexGrow: 1,
              maxWidth: 260,
              mx: 'auto',
              bgcolor: '#F3F3F0',
              borderRadius: 999,
              px: 2,
              py: 0.3,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#A3A3A3' }}>
              bepart.app / events
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex' }}>
          <Box
            sx={{
              width: 158,
              p: 2,
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: '#FCFCFB',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9, mb: 2.5 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: '7px',
                  bgcolor: 'text.primary',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: '-0.08em',
                  }}
                >
                  b.
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: 12.5,
                  fontWeight: 800,
                  letterSpacing: '-0.05em',
                }}
              >
                BePart
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gap: 0.7 }}>
              {sidebarItems.map((item) => (
                <Box
                  key={item.label}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.25,
                    py: 0.85,
                    borderRadius: '9px',
                    bgcolor: item.active ? '#E9EDFF' : 'transparent',
                    color: item.active ? 'text.primary' : '#A3A3A3',
                    fontSize: 11.5,
                    fontWeight: item.active ? 700 : 500,
                  }}
                >
                  <item.icon sx={{ fontSize: 14 }} />
                  {item.label}
                </Box>
              ))}
            </Box>
          </Box>

          <Box sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
              <Box>
                <Typography
                  sx={{
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: { xs: 16, sm: 20 },
                    fontWeight: 800,
                    letterSpacing: '-0.05em',
                  }}
                >
                  Campus Events
                </Typography>
                <Typography sx={{ fontSize: { xs: 10, sm: 11 }, color: '#A3A3A3', mt: 0.4 }}>
                  What&apos;s happening on campus this week
                </Typography>
              </Box>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  bgcolor: '#E9EDFF',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                <Search sx={{ fontSize: 15 }} />
              </Box>
            </Box>

            <Box
              sx={{
                mt: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                bgcolor: '#F3F3F0',
                borderRadius: 999,
                px: 1.75,
                py: 0.85,
              }}
            >
              <Search sx={{ fontSize: 14, color: '#A3A3A3' }} />
              <Typography sx={{ fontSize: 11, color: '#A3A3A3' }}>Search events</Typography>
            </Box>

            <Box
              sx={{
                mt: 2,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
              }}
            >
              {previewEvents.map((event) => (
                <Box
                  key={event.title}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '14px',
                    p: 1.4,
                    bgcolor: '#fff',
                  }}
                >
                  <Box
                    sx={{
                      height: { xs: 54, sm: 66 },
                      borderRadius: '10px',
                      bgcolor: '#EDF2FF',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <ConfirmationNumber sx={{ fontSize: 22, color: '#8EA3F7' }} />
                  </Box>
                  <Box
                    sx={{
                      mt: 1.25,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: 12, fontWeight: 700 }}>
                        {event.title}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: 10, color: '#A3A3A3', mt: 0.25 }}>
                        {event.meta}
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        bgcolor: '#EDF2FF',
                        color: 'primary.main',
                        borderRadius: 999,
                        px: 1.1,
                        py: 0.4,
                        fontSize: 10,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {event.price}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function HeroSection() {
  const navigate = useNavigate();

  return (
    <Box
      component="section"
      sx={{
        overflow: 'hidden',
        px: { xs: 2, sm: 3, lg: 4 },
        pt: { xs: 7, md: 11 },
        pb: { xs: 7, md: 9 },
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
            gap: { xs: 6, md: 8 },
            alignItems: 'center',
          }}
        >
          <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
            <Typography
              component="h1"
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontWeight: 800,
                fontSize: { xs: '2.5rem', sm: '3rem', md: '3.4rem', lg: '3.9rem' },
                lineHeight: 1.06,
                letterSpacing: '-0.06em',
              }}
            >
              Every event.
              <br />
              Everyone gets to
              <br />
              <Box component="span" sx={{ color: 'primary.main' }}>
                BePart.
              </Box>
            </Typography>

            <Typography
              sx={{
                color: 'text.secondary',
                fontSize: { xs: 15.5, md: 17 },
                lineHeight: 1.65,
                mt: 3,
                maxWidth: 470,
                mx: { xs: 'auto', md: 0 },
              }}
            >
              One platform for every campus event — discover, register, pay, get your ticket, and
              check in.
            </Typography>

            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate('/events')}
              sx={{
                mt: 4.5,
                px: 3.5,
                py: 1.3,
                fontSize: 15.5,
                boxShadow: 'none',
                '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' },
              }}
            >
              Explore Campus Events
            </Button>
          </Box>

          <DashboardIllustration />
        </Box>
      </Container>
    </Box>
  );
}

export default HeroSection;