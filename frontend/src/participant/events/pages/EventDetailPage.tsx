import { useParams, Link } from 'react-router-dom';
import { Container, Typography, Box, Button, Card, CardContent, Chip, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../../../shared/api';

export default function EventDetailPage() {
  const { id } = useParams();
  const { data: eventResponse, isLoading, error } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.getPublic(id),
    enabled: !!id,
  });

  // axios response -> body is the event object
  const event = eventResponse?.data;

  if (isLoading) return <Typography>Loading event...</Typography>;
  if (error) return <Alert severity="error">Event not found</Alert>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Link to="/events" sx={{ display: 'inline-block', mb: 2 }}>
        <Button variant="text" startIcon={<span>←</span>}>Back to Events</Button>
      </Link>
      <Card>
        {event.posterUrl && (
          <Box
            component="img"
            src={event.posterUrl}
            alt={`${event.eventName} poster`}
            sx={{ width: '100%', maxHeight: 380, objectFit: 'cover' }}
          />
        )}
        <CardContent>
          <Typography variant="h4" gutterBottom>{event.eventName}</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip label={event.status} color="primary" variant="outlined" />
            <Chip
              label={event.paymentRequired ? `Paid${event.formStructure?.payment?.amount ? ` · ₹${event.formStructure.payment.amount}` : ''}` : 'Free'}
              color={event.paymentRequired ? 'secondary' : 'success'}
              variant="outlined"
            />
          </Box>
          <Typography paragraph>{event.description}</Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Date</Typography>
              <Typography>{new Date(event.date).toLocaleString()}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Registration Closes</Typography>
              <Typography>{new Date(event.closingTime).toLocaleString()}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Available Slots</Typography>
              <Typography>{event.slots}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Organizer</Typography>
              <Typography>{event.organizer?.name}</Typography>
            </Box>
          </Box>
          <Button variant="contained" size="large" href={`/register/${event.id}`}>
            Register Now
          </Button>
        </CardContent>
      </Card>
    </Container>
  );
}