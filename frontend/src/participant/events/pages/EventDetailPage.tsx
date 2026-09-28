import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  ArrowBack,
  CalendarMonth,
  ConfirmationNumber,
  GroupsOutlined,
  HourglassEmpty,
  LocalOfferOutlined,
  PersonOutlined,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../api/events';
import ParticipantNavbar from '../../components/ParticipantNavbar';
import { formatINR } from '../../../app/utils/format';
import type { EventItem } from '../../../app/types';

const BLUE = '#2557F5';
const INDIGO = '#7C3AED';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: 'â€”', time: 'â€”' };
  return {
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function priceLabel(event: EventItem): string {
  if (!event.paymentRequired) return 'Free';
  const amount = event.formStructure?.payment?.amount;
  return typeof amount === 'number' ? formatINR(amount) : 'Paid';
}

/** Remaining seats when the backend exposes registration counts. */
export function seatsLeft(event: EventItem): number | null {
  const taken = event._count?.registrations;
  if (typeof taken !== 'number') return null;
  return Math.max(0, event.slots - taken);
}

/** Event gallery: wide banner first, square artwork as a thumbnail strip. */
function EventGallery({ event }: { event: EventItem }) {
  const images = [event.posterRectangleUrl, event.posterSquareUrl].filter((u): u is string => !!u);
  if (images.length === 0) {
    return (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          minHeight: { xs: 220, md: 380 },
          height: '100%',
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${BLUE} 0%, ${INDIGO} 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="img"
        aria-label="Event visual"
      >
        <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.12)', top: -70, right: -70 }} />
        <Box sx={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.10)', bottom: -60, left: -50 }} />
        <Box sx={{ position: 'absolute', width: 120, height: 120, borderRadius: '50%', border: '14px solid rgba(255,255,255,0.14)', bottom: 30, right: 40 }} />
        <Box sx={{ position: 'relative', textAlign: 'center', color: '#fff', px: 3 }}>
          <ConfirmationNumber sx={{ fontSize: 56, opacity: 0.95 }} />
          <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', mt: 1.5 }}>
            {event.eventName}
          </Typography>
          <Typography sx={{ fontSize: 13.5, opacity: 0.85, mt: 0.5 }}>BePart campus event</Typography>
        </Box>
      </Box>
    );
  }
  const [main, ...rest] = images;
  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: { xs: 220, md: 380 }, display: 'flex', flexDirection: 'column', bgcolor: '#0F172A' }}>
      <Box
        component="img"
        src={main}
        alt={`${event.eventName} poster`}
        sx={{ width: '100%', flex: 1, minHeight: 0, objectFit: 'cover', display: 'block' }}
      />
      {rest.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, p: 1.5, bgcolor: '#FFFFFF' }}>
          {images.map((src, i) => (
            <Box
              key={src}
              component="img"
              src={src}
              alt={`${event.eventName} image ${i + 1}`}
              sx={{
                width: 72,
                height: 72,
                objectFit: 'cover',
                borderRadius: 2,
                border: '2px solid',
                borderColor: i === 0 ? BLUE : CARD_BORDER,
                display: 'block',
              }}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function MetaItem({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', minWidth: 0 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          bgcolor: '#EAF1FF',
          color: BLUE,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', color: MUTED }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: INK, lineHeight: 1.35 }}>{value}</Typography>
        {sub && <Typography sx={{ fontSize: 13, color: MUTED }}>{sub}</Typography>}
      </Box>
    </Box>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: CARD_BORDER, boxShadow: '0 10px 28px -20px rgba(16,24,40,0.25)', height: '100%' }}>
      <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 16, color: INK, mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 1, borderBottom: '1px solid', borderColor: CARD_BORDER, '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ fontSize: 13.5, color: MUTED }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: eventResponse, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getPublic(id!),
    enabled: !!id,
  });

  // axios response -> body is the event object
  const event = eventResponse?.data;

  const goToEvents = () => navigate('/events');

  if (isLoading) {
    return (
      <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
        <ParticipantNavbar />
        <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 10 }}>
            <CircularProgress size={48} color="primary" />
            <Typography color="text.secondary">Loading event...</Typography>
          </Box>
        </Container>
      </Box>
    );
  }

  if (error || !event) {
    return (
      <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
        <ParticipantNavbar />
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
          <Button
            component={RouterLink}
            to="/events"
            startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
            sx={{ color: BLUE, fontWeight: 700, borderRadius: 999, mb: 2.5, '&:hover': { bgcolor: '#EAF0FF' } }}
          >
            Back to Events
          </Button>
          <Card sx={{ borderRadius: 4, border: '1px solid', borderColor: CARD_BORDER, textAlign: 'center' }}>
            <CardContent sx={{ py: 7, px: 3 }}>
              <ConfirmationNumber sx={{ fontSize: 52, color: '#C9CFDB', mb: 1.5 }} />
              <Typography variant="h5" sx={{ fontWeight: 800, color: INK, mb: 1 }}>
                Event not found
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 3 }}>
                This event does not exist or is no longer available.
              </Typography>
              <Button variant="contained" component={RouterLink} to="/events" sx={{ borderRadius: 999, px: 4, boxShadow: 'none' }}>
                Back to Events
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  const date = formatDateTime(event.date);
  const closes = formatDateTime(event.closingTime);

  return (
    <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
      <ParticipantNavbar />

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Button
          component={RouterLink}
          to="/events"
          startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
          sx={{ color: BLUE, fontWeight: 700, borderRadius: 999, mb: 2.5, '&:hover': { bgcolor: '#EAF0FF' } }}
        >
          Back to Events
        </Button>

        {/* Hero */}
        <Card
          sx={{
            borderRadius: { xs: 4, md: 5 },
            border: '1px solid',
            borderColor: CARD_BORDER,
            boxShadow: '0 24px 60px -30px rgba(16,24,40,0.28)',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1.1fr' },
              alignItems: 'stretch',
            }}
          >
            <EventGallery event={event} />

            <CardContent sx={{ p: { xs: 3, md: 5 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={event.status}
                  size="small"
                  sx={{ bgcolor: '#EAF1FF', color: BLUE, fontWeight: 800, fontSize: 11.5, borderRadius: 999 }}
                />
                <Chip
                  label={priceLabel(event).toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: event.paymentRequired ? '#F1EAFE' : '#E7F7EE',
                    color: event.paymentRequired ? INDIGO : '#15803D',
                    fontWeight: 800,
                    fontSize: 11.5,
                    borderRadius: 999,
                  }}
                />
                {event.hasCoupon && (
                  <Chip
                    icon={<LocalOfferOutlined sx={{ fontSize: 15 }} />}
                    label="COUPONS ACCEPTED"
                    size="small"
                    sx={{ bgcolor: '#FFF7E6', color: '#B45309', fontWeight: 800, fontSize: 11.5, borderRadius: 999 }}
                  />
                )}
                {seatsLeft(event) !== null && (
                  <Chip
                    label={seatsLeft(event) === 0 ? 'SOLD OUT' : `${seatsLeft(event)} SEATS LEFT`}
                    size="small"
                    sx={{
                      bgcolor: seatsLeft(event) === 0 ? '#FDECEC' : '#EAF1FF',
                      color: seatsLeft(event) === 0 ? '#DC2626' : BLUE,
                      fontWeight: 800,
                      fontSize: 11.5,
                      borderRadius: 999,
                    }}
                  />
                )}
              </Box>

              <Typography
                component="h1"
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontWeight: 800,
                  fontSize: { xs: '1.9rem', md: '2.5rem' },
                  lineHeight: 1.12,
                  letterSpacing: '-0.04em',
                  color: INK,
                }}
              >
                {event.eventName}
              </Typography>

              {event.organizer?.name && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PersonOutlined sx={{ fontSize: 18, color: MUTED }} />
                  <Typography sx={{ fontSize: 14, color: MUTED }}>
                    Organized by <Box component="span" sx={{ fontWeight: 700, color: INK }}>{event.organizer.name}</Box>
                  </Typography>
                </Box>
              )}

              {event.description && (
                <Typography sx={{ fontSize: 14.5, color: MUTED, lineHeight: 1.65 }}>
                  {event.description}
                </Typography>
              )}

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2.25,
                  mt: 1,
                  p: { xs: 2, md: 2.5 },
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: CARD_BORDER,
                  bgcolor: '#FCFCFB',
                }}
              >
                <MetaItem
                  icon={<CalendarMonth sx={{ fontSize: 20 }} />}
                  label="DATE"
                  value={date.date}
                  sub={date.time}
                />
                <MetaItem
                  icon={<HourglassEmpty sx={{ fontSize: 20 }} />}
                  label="REGISTRATION CLOSES"
                  value={closes.date}
                  sub={closes.time}
                />
                <MetaItem
                  icon={<GroupsOutlined sx={{ fontSize: 20 }} />}
                  label="AVAILABLE SLOTS"
                  value={String(event.slots)}
                />
                <MetaItem
                  icon={<PersonOutlined sx={{ fontSize: 20 }} />}
                  label="ORGANIZER"
                  value={event.organizer?.name || 'â€”'}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                <Button
                  variant="contained"
                  size="large"
                  component={RouterLink}
                  to={`/register/${event.id}`}
                  sx={{
                    borderRadius: 3,
                    px: 4,
                    py: 1.4,
                    fontSize: 15,
                    fontWeight: 700,
                    boxShadow: 'none',
                    bgcolor: BLUE,
                    '&:hover': { bgcolor: '#1D46C8', boxShadow: '0 12px 24px -12px rgba(37,87,245,0.6)' },
                  }}
                >
                  Register Now
                </Button>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: MUTED }}>
                  <AccessTime sx={{ fontSize: 17 }} />
                  <Typography sx={{ fontSize: 13 }}>Closes {closes.date} Â· {closes.time}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Box>
        </Card>

        {/* Event Details */}
        <Typography
          component="h2"
          sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 20, md: 24 }, color: INK, letterSpacing: '-0.03em', mt: { xs: 4, md: 5 }, mb: 2 }}
        >
          Event Details
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2.5,
            alignItems: 'stretch',
          }}
        >
          <InfoCard title="Event Information">
            <InfoRow label="Event" value={event.eventName} />
            <InfoRow label="Status" value={event.status} />
            <InfoRow label="Pricing" value={priceLabel(event)} />
            {event.description && <InfoRow label="About" value={event.description} />}
          </InfoCard>

          <InfoCard title="Registration Information">
            <InfoRow label="Date" value={`${date.date} Â· ${date.time}`} />
            <InfoRow label="Registration deadline" value={`${closes.date} Â· ${closes.time}`} />
            <InfoRow label="Available slots" value={String(event.slots)} />
            <InfoRow label="Pricing" value={priceLabel(event)} />
            <Button
              variant="contained"
              fullWidth
              component={RouterLink}
              to={`/register/${event.id}`}
              sx={{ borderRadius: 2.5, mt: 2, py: 1.25, fontWeight: 700, boxShadow: 'none', bgcolor: BLUE, '&:hover': { bgcolor: '#1D46C8' } }}
            >
              Register Now
            </Button>
          </InfoCard>

          <InfoCard title="Organizer Information">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Avatar sx={{ width: 44, height: 44, bgcolor: BLUE, fontWeight: 800 }}>
                {event.organizer?.name?.charAt(0)?.toUpperCase() || 'O'}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800, color: INK }}>{event.organizer?.name || 'â€”'}</Typography>
                <Typography sx={{ fontSize: 13, color: MUTED }}>Event organizer</Typography>
              </Box>
            </Box>
            <InfoRow label="Organizer" value={event.organizer?.name || 'â€”'} />
          </InfoCard>

          <InfoCard title="Availability">
            <InfoRow label="Available slots" value={String(event.slots)} />
            <InfoRow label="Status" value={event.status} />
            <InfoRow label="Registration closes" value={`${closes.date} Â· ${closes.time}`} />
          </InfoCard>
        </Box>

        <Alert severity="info" sx={{ mt: 3, borderRadius: 3 }}>
          Registrations close on {closes.date} at {closes.time}. {event.slots} slots available.
        </Alert>
      </Container>
    </Box>
  );
}
