import { Box, Button, Container, Grid, Typography } from '@mui/material';
import { ArrowForward, CalendarMonthOutlined } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../../participant/events/api/events';
import { unwrapList } from '../../app/api/client';
import { EventCard } from '../../participant/events/pages/EventsPage';
import type { EventItem } from '../../app/types';
import EmptyState from '../../app/components/EmptyState';

// Live discovery preview reusing the actual EventCard component and real
// published events — identical styling to the events page, zero duplication.
function DiscoverySection() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['landing', 'discovery-events'],
    queryFn: () => eventsApi.listPublished({ page: 1, limit: 3 }),
    retry: false,
    staleTime: 60_000,
  });
  const events: EventItem[] = data ? unwrapList<EventItem>(data) : [];

  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography align="center" sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Event Discovery
        </Typography>
        <Typography component="h2" align="center" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}>
          Find your next event
        </Typography>
        <Typography align="center" color="text.secondary" sx={{ mt: 1.5, maxWidth: 620, mx: 'auto', fontSize: 15, lineHeight: 1.7 }}>
          Search, filter and open any event to review full details — date, organizer, price,
          coupons and seats — before you register.
        </Typography>

        <Box sx={{ mt: { xs: 3, md: 4 } }}>
          {events.length === 0 ? (
            <EmptyState
              icon={CalendarMonthOutlined}
              title="Fresh events land here"
              description="These cards show live published events. Browse the full catalog to get started."
              actionLabel="Explore Events"
              onAction={() => navigate('/events')}
            />
          ) : (
            <Grid container spacing={3}>
              {events.map((event) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={event.id}>
                  <EventCard event={event} saved={false} onToggleSaved={() => {}} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3.5 }}>
          <Button variant="contained" size="large" endIcon={<ArrowForward />} onClick={() => navigate('/events')}
            sx={{ borderRadius: 999, px: 4, boxShadow: 'none' }}>
            Explore All Events
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

export default DiscoverySection;
