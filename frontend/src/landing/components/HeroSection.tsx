import {
  ArrowForward,
  CalendarMonth,
  ConfirmationNumber,
  Dashboard as DashboardIcon,
  DescriptionOutlined,
  EventAvailableOutlined,
  LocalOfferOutlined,
  PaymentsOutlined,
  QrCodeScanner,
  Search,
} from '@mui/icons-material';
import { Box, Button, Chip, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import type { ElementType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../../participant/events/api/events';
import { unwrapList } from '../../app/api/client';
import { formatINR } from '../../app/utils/format';
import { eventPoster } from '../../app/types';
import type { EventItem } from '../../app/types';

const sidebarItems: { label: string; icon: ElementType; active?: boolean }[] = [
  { label: 'Dashboard', icon: DashboardIcon, active: true },
  { label: 'Events', icon: CalendarMonth },
  { label: 'My Tickets', icon: ConfirmationNumber },
  { label: 'Check-in', icon: QrCodeScanner },
];

const CAPABILITIES: { icon: ElementType; label: string }[] = [
  { icon: ConfirmationNumber, label: 'Digital Tickets' },
  { icon: QrCodeScanner, label: 'QR Check-in' },
  { icon: PaymentsOutlined, label: 'Free & Paid Events' },
  { icon: DescriptionOutlined, label: 'Custom Registration Forms' },
  { icon: EventAvailableOutlined, label: 'Event Management' },
];

function priceLabel(event: EventItem): string {
  if (!event.paymentRequired) return 'Free';
  const amount = event.formStructure?.payment?.amount;
  return typeof amount === 'number' ? formatINR(amount) : 'Paid';
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Live preview of the product: real published events rendered in the actual
// event-card style. Falls back gracefully when the API is unreachable.
function DashboardIllustration() {
  const { data } = useQuery({
    queryKey: ['landing', 'preview-events'],
    queryFn: () => eventsApi.listPublished({ page: 1, limit: 4 }),
    retry: false,
    staleTime: 60_000,
  });
  const events: EventItem[] = data ? unwrapList<EventItem>(data) : [];

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
              {events.length === 0 ? (
                <Box sx={{ gridColumn: '1 / -1', border: '1px dashed', borderColor: 'divider', borderRadius: '14px', p: 2.5, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>No published events right now</Typography>
                  <Typography sx={{ fontSize: 11, color: '#A3A3A3', mt: 0.5 }}>
                    New events appear here automatically once organizers publish them.
                  </Typography>
                </Box>
              ) : (
                events.map((event) => {
                  const poster = eventPoster(event);
                  return (
                    <Box
                      key={event.id}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.4, bgcolor: '#fff', minWidth: 0 }}
                    >
                      {poster ? (
                        <Box component="img" src={poster} alt="" sx={{ height: { xs: 54, sm: 66 }, width: '100%', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
                      ) : (
                        <Box sx={{ height: { xs: 54, sm: 66 }, borderRadius: '10px', bgcolor: '#EDF2FF', display: 'grid', placeItems: 'center' }}>
                          <ConfirmationNumber sx={{ fontSize: 22, color: '#8EA3F7' }} />
                        </Box>
                      )}
                      <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontSize: 12, fontWeight: 700 }}>
                            {event.eventName}
                          </Typography>
                          <Typography noWrap sx={{ fontSize: 10, color: '#A3A3A3', mt: 0.25 }}>
                            {formatShortDate(event.date)}{event.organizer?.name ? ` · ${event.organizer.name}` : ''}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            bgcolor: event.paymentRequired ? '#EDF2FF' : '#E7F7EE',
                            color: event.paymentRequired ? 'primary.main' : '#15803D',
                            borderRadius: 999,
                            px: 1.1,
                            py: 0.4,
                            fontSize: 10,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {priceLabel(event)}
                        </Box>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>

            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocalOfferOutlined sx={{ fontSize: 14, color: '#8EA3F7' }} />
              <Typography sx={{ fontSize: 10.5, color: '#A3A3A3' }}>
                Organizer coupons apply automatically at payment
              </Typography>
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
    <Box component="section" sx={{ overflow: 'hidden', px: { xs: 2, sm: 3, lg: 4 }, pt: { xs: 7, md: 11 }, pb: { xs: 7, md: 9 } }}>
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
            <Chip
              label="Campus event discovery & registration"
              size="small"
              sx={{ bgcolor: '#EAF1FF', color: 'primary.main', fontWeight: 700, mb: 2.5 }}
            />
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
              Discover. Register. Participate.
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
              BePart is the event discovery and registration platform connecting participants
              with event organizers — browse events, register in minutes, get your QR ticket,
              and check in at the gate.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 4.5, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/events')}
                sx={{ px: 3.5, py: 1.3, fontSize: 15.5, boxShadow: 'none', '&:hover': { bgcolor: 'primary.dark', boxShadow: 'none' } }}
              >
                Explore Events
              </Button>
              <Button
                variant="outlined"
                size="large"
                component="a"
                href="#organizers"
                sx={{ px: 3, py: 1.3, fontSize: 15, borderRadius: 999 }}
              >
                I&apos;m an Organizer
              </Button>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 3.5, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
              {CAPABILITIES.map((c) => (
                <Chip
                  key={c.label}
                  icon={<c.icon sx={{ fontSize: 15 }} />}
                  label={c.label}
                  size="small"
                  variant="outlined"
                  sx={{ borderRadius: 999, fontSize: 12 }}
                />
              ))}
            </Box>
          </Box>

          <DashboardIllustration />
        </Box>
      </Container>
    </Box>
  );
}

export default HeroSection;
