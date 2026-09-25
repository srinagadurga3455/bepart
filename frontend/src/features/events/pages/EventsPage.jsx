import { Container, Typography, Box, Button, Grid, Card, CardContent, CardActions, CircularProgress, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../../../shared/api';

function EventCard({ event }) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {event.posterUrl && (
        <Box
          component="img"
          src={event.posterUrl}
          alt={`${event.eventName} poster`}
          sx={{ width: '100%', height: 160, objectFit: 'cover' }}
        />
      )}
      <CardContent>
        <Typography variant="h6" gutterBottom>{event.eventName}</Typography>
        <Typography color="text.secondary" paragraph>{event.description}</Typography>
        <Typography variant="body2" color="text.secondary">
          Date: {new Date(event.date).toLocaleDateString()}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Slots: {event.slots}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Status: {event.status}
        </Typography>
        <Typography variant="body2" color={event.paymentRequired ? 'secondary.main' : 'success.main'} fontWeight={600}>
          {event.paymentRequired ? `Paid${event.formStructure?.payment?.amount ? ` · ₹${event.formStructure.payment.amount}` : ''}` : 'Free entry'}
        </Typography>
      </CardContent>
      <CardActions>
        <Button variant="outlined" size="small" href={`/events/${event.id}`}>
          View Details
        </Button>
        <Button variant="contained" size="small" href={`/register/${event.id}`}>
          Register
        </Button>
      </CardActions>
    </Card>
  );
}

export default function EventsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.listPublished({ page: 1, limit: 10 }),
  });

  if (isLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={48} color="primary" />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error" variant="filled">
          <Typography variant="h6" gutterBottom>Failed to Load Events</Typography>
          <Typography>{error.message || 'Unknown error occurred'}</Typography>
        </Alert>
      </Container>
    );
  }

  // axios response -> body { data: [...], meta: {...} } -> events array
  const body = data?.data;
  const events = Array.isArray(body) ? body : body?.data || [];

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h3" gutterBottom>Upcoming Events</Typography>
      {events.length === 0 ? (
        <Alert severity="info" variant="filled">
          <Typography>No published events available at the moment.</Typography>
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={event.id}>
              <EventCard event={event} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}