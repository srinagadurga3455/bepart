import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  Grid,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import {
  AccessTime,
  ArrowForward,
  BookmarkBorder,
  Bookmark,
  CalendarMonth,
  ConfirmationNumber,
  GroupsOutlined,
  Search,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../api/events';
import { unwrapList } from '../../../app/api/client';
import { useAuth } from '../../../auth/components/RequireRole';
import type { EventItem } from '../../../app/types';

const BLUE = '#2557F5';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function priceLabel(event: EventItem): string {
  if (!event.paymentRequired) return 'Free';
  const amount = event.formStructure?.payment?.amount;
  return typeof amount === 'number' ? `₹${amount}` : 'Paid';
}

/** Correct BePart mark: blue circle with a white capital "B" (no dot). Local to this page. */
function BePartMark() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          bgcolor: BLUE,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 19,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          B
        </Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontSize: 21,
          fontWeight: 800,
          letterSpacing: '-0.05em',
          color: INK,
        }}
      >
        BePart
      </Typography>
    </Box>
  );
}

function ExploreNavbar({
  query,
  onQuery,
}: {
  query: string;
  onQuery: (value: string) => void;
}) {
  const navigate = useNavigate();
  const { loading, user } = useAuth();

  return (
    <Box
      component="header"
      sx={{
        bgcolor: '#FFFFFF',
        borderBottom: '1px solid',
        borderColor: CARD_BORDER,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, md: 3 },
            py: { xs: 1.5, md: 2 },
          }}
        >
          <Box
            onClick={() => navigate('/')}
            sx={{ cursor: 'pointer', flexShrink: 0 }}
            role="link"
            aria-label="BePart home"
          >
            <BePartMark />
          </Box>

          <TextField
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search for events, clubs, or keywords..."
            size="small"
            fullWidth
            slotProps={{
              input: {
                startAdornment: <Search sx={{ fontSize: 20, color: MUTED, mr: 1 }} />,
              },
            }}
            sx={{
              maxWidth: 560,
              mx: 'auto',
              display: { xs: 'none', sm: 'flex' },
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
                bgcolor: '#F5F7FF',
                fontSize: 14,
              },
            }}
          />

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            {loading ? (
              <CircularProgress size={24} />
            ) : user ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
                    {user.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.2 }}>{user.role}</Typography>
                </Box>
                <Avatar sx={{ width: 38, height: 38, bgcolor: BLUE, fontWeight: 800 }}>
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              </Box>
            ) : (
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{ borderRadius: 999, boxShadow: 'none', px: 3 }}
              >
                Login
              </Button>
            )}
          </Box>
        </Box>

        <TextField
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search for events, clubs, or keywords..."
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: <Search sx={{ fontSize: 20, color: MUTED, mr: 1 }} />,
            },
          }}
          sx={{
            display: { xs: 'flex', sm: 'none' },
            pb: 1.5,
            '& .MuiOutlinedInput-root': { borderRadius: 999, bgcolor: '#F5F7FF', fontSize: 14 },
          }}
        />
      </Container>
    </Box>
  );
}

function HeroSection({ featured }: { featured: EventItem | null }) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        bgcolor: '#EAF0FF',
        borderRadius: { xs: 4, md: 6 },
        px: { xs: 3, md: 6 },
        py: { xs: 4, md: 6 },
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' },
        gap: { xs: 4, md: 6 },
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
        <Chip
          label="Campus events discovery"
          size="small"
          sx={{
            bgcolor: '#FFFFFF',
            color: BLUE,
            fontWeight: 700,
            fontSize: 12,
            mb: 2,
            borderRadius: 999,
          }}
        />
        <Typography
          component="h1"
          sx={{
            fontFamily: 'Manrope, sans-serif',
            fontWeight: 800,
            fontSize: { xs: '2rem', sm: '2.6rem', md: '3rem' },
            lineHeight: 1.08,
            letterSpacing: '-0.05em',
            color: INK,
          }}
        >
          Discover campus events worth joining.
        </Typography>
        <Typography sx={{ color: MUTED, fontSize: { xs: 14.5, md: 16 }, lineHeight: 1.65, mt: 2, maxWidth: 460, mx: { xs: 'auto', md: 0 } }}>
          Browse live events, register in minutes, and keep your ticket ready for entry.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, mt: 3.5, flexWrap: 'wrap', justifyContent: { xs: 'center', md: 'flex-start' } }}>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForward />}
            onClick={() => {
              if (featured) navigate(`/events/${featured.id}`);
            }}
            disabled={!featured}
            sx={{ borderRadius: 999, px: 3.5, boxShadow: 'none' }}
          >
            {featured ? 'View featured event' : 'No featured event'}
          </Button>
          {featured && (
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate(`/register/${featured.id}`)}
              sx={{ borderRadius: 999, px: 3.5, borderColor: BLUE, color: BLUE }}
            >
              Register
            </Button>
          )}
        </Box>
        {featured && (
          <Typography sx={{ mt: 2.5, fontSize: 13, color: MUTED }}>
            Featured: {featured.eventName} · {formatDate(featured.date)} · {priceLabel(featured)}
          </Typography>
        )}
      </Box>

      <Box
        sx={{
          bgcolor: '#fff',
          border: '1px solid',
          borderColor: CARD_BORDER,
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0 24px 60px -24px rgba(37, 87, 245, 0.28)',
        }}
      >
        {featured?.posterUrl ? (
          <Box
            component="img"
            src={featured.posterUrl}
            alt={`${featured.eventName} poster`}
            sx={{ width: '100%', height: { xs: 220, md: 300 }, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: { xs: 220, md: 300 },
              display: 'grid',
              placeItems: 'center',
              bgcolor: '#EDF2FF',
              color: BLUE,
            }}
          >
            <ConfirmationNumber sx={{ fontSize: 56 }} />
          </Box>
        )}
        <Box sx={{ p: 2.5 }}>
          <Typography sx={{ fontWeight: 800, color: INK, fontSize: 17 }}>
            {featured?.eventName || 'No events published yet'}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: MUTED, mt: 0.5 }}>
            {featured
              ? `${formatDate(featured.date)} · ${formatTime(featured.date)}${featured.organizer?.name ? ` · by ${featured.organizer.name}` : ''}`
              : 'Check back soon for upcoming campus events.'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

function EventCard({
  event,
  saved,
  onToggleSaved,
}: {
  event: EventItem;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 4,
        border: '1px solid',
        borderColor: CARD_BORDER,
        boxShadow: '0 10px 28px -18px rgba(16, 24, 40, 0.25)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'relative' }}>
        {event.posterUrl ? (
          <Box
            component="img"
            src={event.posterUrl}
            alt={`${event.eventName} poster`}
            sx={{ width: '100%', height: 170, objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: 170,
              display: 'grid',
              placeItems: 'center',
              bgcolor: '#EDF2FF',
              color: BLUE,
            }}
          >
            <ConfirmationNumber sx={{ fontSize: 44 }} />
          </Box>
        )}
        <IconButton
          onClick={onToggleSaved}
          aria-label={saved ? 'Remove bookmark' : 'Bookmark event'}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            bgcolor: '#fff',
            width: 34,
            height: 34,
            boxShadow: '0 6px 16px -8px rgba(16,24,40,0.4)',
            '&:hover': { bgcolor: '#fff' },
          }}
        >
          {saved ? <Bookmark sx={{ fontSize: 19, color: BLUE }} /> : <BookmarkBorder sx={{ fontSize: 19, color: INK }} />}
        </IconButton>
        <Chip
          label={priceLabel(event)}
          size="small"
          sx={{
            position: 'absolute',
            left: 10,
            bottom: 10,
            bgcolor: event.paymentRequired ? BLUE : '#16A34A',
            color: '#fff',
            fontWeight: 700,
            fontSize: 11.5,
            borderRadius: 999,
          }}
        />
      </Box>

      <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1 }}>
        <Chip
          label={event.status}
          size="small"
          variant="outlined"
          sx={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, borderRadius: 999 }}
        />
        <Typography sx={{ fontWeight: 800, color: INK, fontSize: 16.5, lineHeight: 1.3 }}>
          {event.eventName}
        </Typography>
        {event.description && (
          <Typography noWrap sx={{ fontSize: 13.5, color: MUTED }}>
            {event.description}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          <CalendarMonth sx={{ fontSize: 16, color: MUTED }} />
          <Typography sx={{ fontSize: 13, color: MUTED }}>
            {formatDate(event.date)}
          </Typography>
          <AccessTime sx={{ fontSize: 16, color: MUTED, ml: 1 }} />
          <Typography sx={{ fontSize: 13, color: MUTED }}>{formatTime(event.date)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupsOutlined sx={{ fontSize: 16, color: MUTED }} />
          <Typography sx={{ fontSize: 13, color: MUTED }}>
            {event.slots} slots{event.organizer?.name ? ` · by ${event.organizer.name}` : ''}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mt: 'auto', pt: 1.5 }}>
          <Typography sx={{ fontWeight: 800, color: INK, fontSize: 16 }}>{priceLabel(event)}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              component={RouterLink}
              to={`/events/${event.id}`}
              sx={{ borderRadius: 999, px: 2 }}
            >
              Details
            </Button>
            <Button
              variant="contained"
              size="small"
              component={RouterLink}
              to={`/register/${event.id}`}
              sx={{ borderRadius: 999, px: 2.25, boxShadow: 'none' }}
            >
              Register
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function EventsPage() {
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.listPublished({ page: 1, limit: 10 }),
  });

  const events: EventItem[] = useMemo(() => (data ? unwrapList<EventItem>(data) : []), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) =>
      [event.eventName, event.description || '', event.organizer?.name || '']
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [events, query]);

  const featured: EventItem | null = useMemo(
    () => events.find((event) => event.posterUrl) || events[0] || null,
    [events]
  );

  const toggleSaved = (id: number) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
        <ExploreNavbar query={query} onQuery={setQuery} />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={48} color="primary" />
          </Box>
        </Container>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
        <ExploreNavbar query={query} onQuery={setQuery} />
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Alert severity="error" variant="filled">
            <Typography variant="h6" gutterBottom>Failed to Load Events</Typography>
            <Typography>{error.message || 'Unknown error occurred'}</Typography>
          </Alert>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#F7F7F4', minHeight: '100vh' }}>
      <ExploreNavbar query={query} onQuery={setQuery} />

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <HeroSection featured={featured} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: { xs: 4, md: 6 }, mb: 2.5, flexWrap: 'wrap' }}>
          <CalendarMonth sx={{ color: BLUE }} />
          <Typography
            component="h2"
            sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 21, md: 25 }, color: INK, letterSpacing: '-0.03em' }}
          >
            Upcoming Events
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: MUTED }}>
            {filtered.length} event{filtered.length === 1 ? '' : 's'}
          </Typography>
          {query.trim() && (
            <Button
              variant="text"
              size="small"
              endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
              onClick={() => setQuery('')}
              sx={{ ml: 'auto', borderRadius: 999, color: BLUE, fontWeight: 700 }}
            >
              View All
            </Button>
          )}
        </Box>

        {filtered.length === 0 ? (
          <Alert severity="info" variant="filled">
            <Typography>
              {events.length === 0
                ? 'No published events available at the moment.'
                : 'No events match your search. Try a different keyword.'}
            </Typography>
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {filtered.map((event) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                <EventCard event={event} saved={savedIds.has(event.id)} onToggleSaved={() => toggleSaved(event.id)} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
