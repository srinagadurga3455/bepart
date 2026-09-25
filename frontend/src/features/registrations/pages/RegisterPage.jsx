import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Container, Typography, Box, Button, Card, CardContent, Alert, Chip, Avatar, CircularProgress, Stack, Divider } from '@mui/material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { eventsApi, registrationsApi } from '../../../shared/api';
import RegistrationFlow from '../components/RegistrationFlow';

export default function RegisterPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState(null);

  const { data: eventResponse, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.getPublic(eventId),
    enabled: !!eventId,
  });

  const event = eventResponse?.data;

  const { data: formStructureResponse, isLoading: formLoading } = useQuery({
    queryKey: ['event', eventId, 'registration-form'],
    queryFn: () => eventsApi.getRegistrationForm(eventId),
    enabled: !!eventId,
  });

  const formStructure = formStructureResponse?.data;

  const createRegistration = useMutation({
    // Backend requires phone BOTH top-level and inside formData (validated against formStructure).
    // Keep the full dynamic formData intact; only add the top-level phone from it.
    mutationFn: (values) => registrationsApi.create({ eventId: parseInt(eventId), phone: values.phone, formData: { ...values } }),
    onSuccess: (res) => {
      setTicketId(res?.data?.registrationId || null);
      setSuccess(true);
      setError('');
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    },
  });

  if (eventLoading || formLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} color="primary" />
      </Container>
    );
  }

  if (eventError || !event) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" variant="filled">
          <Typography variant="h6" gutterBottom>Event Not Found</Typography>
          <Typography>The event you are looking for does not exist or is not available for registration.</Typography>
          <Button variant="contained" component={Link} to="/events" sx={{ mt: 2 }}>Back to Events</Button>
        </Alert>
      </Container>
    );
  }

  const handleFormSubmit = (formData) => {
    const phone = formData.phone?.trim();
    if (!phone) {
      setError('Phone number is required');
      return;
    }
    createRegistration.mutate({ ...formData, phone });
  };

  const handleRegistrationSuccess = () => {
    navigate('/events');
  };

  const handleBackToEvent = () => {
    navigate(`/events/${eventId}`);
  };

  const isFormEmpty = !formStructure?.sections?.length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack direction="column" spacing={3} sx={{ maxWidth: 800, mx: 'auto', width: '100%' }}>
        <Link to="/events" sx={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 1, color: 'primary.main', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}>
          <Box component="span" sx={{ fontSize: 20 }}>←</Box>
          Back to Events
        </Link>

        <Card elevation={0} variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <CardContent sx={{ p: { xs: 3, md: 4 } }}>
            <Stack direction="column" spacing={2} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                  <Chip label={event.status} color="success" variant="outlined" size="small" sx={{ mb: 1.5 }} />
                  <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ lineHeight: 1.2 }}>
                    {event.eventName}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                      {event.organizer?.name?.charAt(0) || 'E'}
                    </Avatar>
                    <Typography variant="body2">{event.organizer?.name}</Typography>
                  </Box>
                </Box>
              </Box>

              {event.description && (
                <Typography variant="body1" color="text.secondary" paragraph>{event.description}</Typography>
              )}

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 1, md: 3 }, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                  <span style={{ fontSize: 18 }}>📅</span>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Event Date</Typography>
                    <Typography variant="body2" fontWeight={500}>{new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                  <span style={{ fontSize: 18 }}>⏰</span>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Registration Closes</Typography>
                    <Typography variant="body2" fontWeight={500}>{new Date(event.closingTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: 'text.secondary' }}>
                  <span style={{ fontSize: 18 }}>🎟️</span>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Available Slots</Typography>
                    <Typography variant="body2" fontWeight={500}>{event.slots}</Typography>
                  </Box>
                </Box>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {success && (
              <Alert severity="success" variant="filled" icon={<span style={{ fontSize: 24 }}>✓</span>} sx={{ mb: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Registration Successful!</Typography>
                <Typography>Your registration for <strong>{event.eventName}</strong> has been confirmed. You will receive a confirmation shortly.</Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                  {ticketId && (
                    <Button variant="contained" color="success" onClick={() => navigate(`/ticket/${ticketId}`)}>
                      View Ticket
                    </Button>
                  )}
                  <Button variant="outlined" component={Link} to="/events" sx={{ color: 'success.main', borderColor: 'success.main' }}>
                    Browse More Events
                  </Button>
                </Box>
              </Alert>
            )}

            {error && !success && (
              <Alert severity="error" variant="filled" icon={<span style={{ fontSize: 24 }}>✕</span>} sx={{ mb: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom>Registration Failed</Typography>
                <Typography>{error}</Typography>
              </Alert>
            )}

            {!success && !isFormEmpty && (
              <RegistrationFlow
                formStructure={formStructure}
                onSubmit={handleFormSubmit}
                isSubmitting={createRegistration.isPending}
                event={event}
                onBackToEvent={handleBackToEvent}
              />
            )}

            {isFormEmpty && !success && (
              <Alert severity="info" variant="filled" sx={{ mt: 2 }}>
                <Typography variant="body1">This event doesn't have a custom registration form configured. The organizer will collect your details separately.</Typography>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (!event) return;
                    createRegistration.mutate({ phone: '', eventId: parseInt(eventId), formData: {} });
                  }}
                  disabled={createRegistration.isPending}
                  sx={{ mt: 1.5 }}
                >
                  {createRegistration.isPending ? 'Registering...' : 'Register Anyway'}
                </Button>
              </Alert>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}