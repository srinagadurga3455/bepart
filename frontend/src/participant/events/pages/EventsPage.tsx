import { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container, FormControl, Grid, IconButton, InputLabel, MenuItem, Pagination, Select, TextField, Typography } from '@mui/material';
import {
  AccessTime,
  ArrowForward,
  BookmarkBorder,
  Bookmark,
  CalendarMonth,
  ConfirmationNumber,
  GroupsOutlined,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../api/events';
import { unwrapList } from '../../../app/api/client';
import ParticipantNavbar from '../../components/ParticipantNavbar';
import { formatINR } from '../../../app/utils/format';
import { usePageMeta } from '../../../app/utils/pageMeta';
import { eventPoster } from '../../../app/types';
import EmptyState from '../../../app/components/EmptyState';
import { SearchOffOutlined } from '@mui/icons-material';
import type { EventItem } from '../../../app/types';

const PAGE_SIZE = 9;

const BLUE = '#2557F5';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'â€”';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'â€”';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function priceLabel(event: EventItem): string {
  if (!event.paymentRequired) return 'Free';
  const amount = event.formStructure?.payment?.amount;
  return typeof amount === 'number' ? formatINR(amount) : 'Paid';
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
            Featured: {featured.eventName} Â· {formatDate(featured.date)} Â· {priceLabel(featured)}
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
        {featured && eventPoster(featured) ? (
          <Box
            component="img"
            src={eventPoster(featured)!}
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
              ? `${formatDate(featured.date)} Â· ${formatTime(featured.date)}${featured.organizer?.name ? ` Â· by ${featured.organizer.name}` : ''}`
              : 'Check back soon for upcoming campus events.'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function EventCard({
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
        {eventPoster(event) ? (
          <Box
            component="img"
            src={eventPoster(event)!}
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
            {event.slots} slots{event.organizer?.name ? ` Â· by ${event.organizer.name}` : ''}
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
  usePageMeta('Explore Events', 'Browse campus events on BePart — search, filter free and paid events, and register in minutes.');
  const [query, setQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [sortOrder, setSortOrder] = useState<'soonest' | 'latest'>('soonest');
  const [page, setPage] = useState(1);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.listPublished({ page: 1, limit: 50 }),
  });

  const events: EventItem[] = useMemo(() => (data ? unwrapList<EventItem>(data) : []), [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = events.filter((event) => {
      if (priceFilter === 'free' && event.paymentRequired) return false;
      if (priceFilter === 'paid' && !event.paymentRequired) return false;
      if (!q) return true;
      return [event.eventName, event.description || '', event.organizer?.name || '']
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    return [...list].sort((a, b) => {
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return sortOrder === 'soonest' ? diff : -diff;
    });
  }, [events, query, priceFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resetFilters = () => {
    setQuery('');
    setPriceFilter('all');
    setSortOrder('soonest');
    setPage(1);
  };

  const featured: EventItem | null = useMemo(
    () => events.find((event) => eventPoster(event)) || events[0] || null,
    [events]
  );

  const hasActiveFilters = query.trim() !== '' || priceFilter !== 'all' || sortOrder !== 'soonest';

  const toggleSaved = (id: string) => {
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
        <ParticipantNavbar query={query} onQuery={setQuery} />
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
        <ParticipantNavbar query={query} onQuery={setQuery} />
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
      <ParticipantNavbar query={query} onQuery={setQuery} />

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <HeroSection featured={featured} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: { xs: 4, md: 6 }, mb: 2, flexWrap: 'wrap' }}>
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
          {hasActiveFilters && (
            <Button
              variant="text"
              size="small"
              endIcon={<ArrowForward sx={{ fontSize: 16 }} />}
              onClick={resetFilters}
              sx={{ ml: 'auto', borderRadius: 999, color: BLUE, fontWeight: 700 }}
            >
              Clear filters
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#fff', borderRadius: 999 }}>
            <InputLabel>Price</InputLabel>
            <Select label="Price" value={priceFilter}
              onChange={(e) => { setPriceFilter(e.target.value as 'all' | 'free' | 'paid'); setPage(1); }}
              sx={{ borderRadius: 999 }}>
              <MenuItem value="all">All prices</MenuItem>
              <MenuItem value="free">Free</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#fff', borderRadius: 999 }}>
            <InputLabel>Sort by</InputLabel>
            <Select label="Sort by" value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value as 'soonest' | 'latest'); setPage(1); }}
              sx={{ borderRadius: 999 }}>
              <MenuItem value="soonest">Soonest first</MenuItem>
              <MenuItem value="latest">Latest first</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {filtered.length === 0 ? (
          <EmptyState
            icon={events.length === 0 ? CalendarMonth : SearchOffOutlined}
            title={events.length === 0 ? 'No published events yet' : 'No events match your search'}
            description={events.length === 0
              ? 'Check back soon â€” organizers are preparing upcoming campus events.'
              : 'Try a different keyword or clear your filters.'}
            actionLabel={events.length === 0 ? undefined : 'Clear filters'}
            onAction={events.length === 0 ? undefined : resetFilters}
          />
        ) : (
          <>
            <Grid container spacing={3}>
              {paged.map((event) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                  <EventCard event={event} saved={savedIds.has(event.id)} onToggleSaved={() => toggleSaved(event.id)} />
                </Grid>
              ))}
            </Grid>
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination count={totalPages} page={safePage} onChange={(_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} color="primary" shape="rounded" />
              </Box>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}
