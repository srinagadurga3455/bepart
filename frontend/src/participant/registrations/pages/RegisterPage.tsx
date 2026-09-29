import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Button,
  Alert,
  CircularProgress,
  Paper,
} from '@mui/material';
import { ArrowBack, CheckCircleOutlined, ConfirmationNumber, ErrorOutlined } from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { eventsApi } from '../../events/api/events';
import { registrationsApi } from '../api/registrations';
import { apiErrorMessage } from '../../../app/api/client';
import type { FormDataRecord } from '../../../app/types';
import RegistrationFlow from '../components/RegistrationFlow';

const BLUE = '#2557F5';

interface RegisterVariables {
  phone: string;
  [field: string]: unknown;
}

export default function RegisterPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const { data: eventResponse, isLoading: eventLoading, error: eventError } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventsApi.getPublic(eventId!),
    enabled: !!eventId,
  });

  const event = eventResponse?.data;

  const { data: formStructureResponse, isLoading: formLoading } = useQuery({
    queryKey: ['event', eventId, 'registration-form'],
    queryFn: () => eventsApi.getRegistrationForm(eventId!),
    enabled: !!eventId,
  });

  const formStructure = formStructureResponse?.data;

  const createRegistration = useMutation({
    // Backend requires phone BOTH top-level and inside formData (validated against formStructure).
    // Keep the full dynamic formData intact; only add the top-level phone from it.
    mutationFn: (values: RegisterVariables) =>
      registrationsApi.create({
        eventId: eventId!,
        phone: values.phone,
        formData: { ...values } as FormDataRecord,
      }),
    onSuccess: (res) => {
      setTicketId(res?.data?.registrationId || null);
      setSuccess(true);
      setError('');
    },
    onError: (err) => {
      setError(apiErrorMessage(err, 'Registration failed. Please try again.'));
    },
  });

  /* ── Loading state ───────────────────────────────────────────── */
  if (eventLoading || formLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: '#F0F4FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress size={48} sx={{ color: BLUE }} />
      </Box>
    );
  }

  /* ── Event not found ─────────────────────────────────────────── */
  if (eventError || !event) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#F0F4FF', py: 6 }}>
        <Container maxWidth="sm">
          <Paper
            elevation={0}
            sx={{ borderRadius: 4, p: { xs: 3, sm: 5 }, border: '1px solid #E2E8F0' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <ErrorOutlined sx={{ color: '#EF4444', fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B' }}>
                Event Not Found
              </Typography>
            </Box>
            <Typography sx={{ color: '#64748B', mb: 3 }}>
              The event you are looking for does not exist or is not available for registration.
            </Typography>
            <Button
              variant="contained"
              component={Link}
              to="/events"
              startIcon={<ArrowBack />}
              sx={{
                bgcolor: BLUE,
                borderRadius: 2.5,
                fontWeight: 700,
                textTransform: 'none',
                '&:hover': { bgcolor: '#1D46C8' },
              }}
            >
              Back to Events
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  /* ── Submit handler ──────────────────────────────────────────── */
  const handleFormSubmit = (formData: FormDataRecord) => {
    const phoneValue = formData.phone;
    const phone = typeof phoneValue === 'string' ? phoneValue.trim() : '';
    if (!phone) {
      setError('Phone number is required');
      return;
    }
    createRegistration.mutate({ ...formData, phone });
  };

  const isFormEmpty = !formStructure?.sections?.length;

  /* ── Main page ───────────────────────────────────────────────── */
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F0F4FF' }}>
      <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 5 } }}>
        {/* Back navigation */}
        <Box sx={{ mb: 3 }}>
          <Button
            component={Link}
            to={`/events/${eventId}`}
            startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
            sx={{
              color: BLUE,
              fontWeight: 600,
              fontSize: 14,
              textTransform: 'none',
              p: 0,
              '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
            }}
          >
            Back to Event
          </Button>
        </Box>

        {/* Registration card */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            border: '1px solid #E2E8F0',
            bgcolor: '#FFFFFF',
            overflow: 'hidden',
          }}
        >
          {/* Card header strip */}
          <Box
            sx={{
              bgcolor: BLUE,
              px: { xs: 3, sm: 4 },
              py: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.18)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <ConfirmationNumber sx={{ fontSize: 26, color: '#FFFFFF' }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontFamily: '"DM Sans", sans-serif',
                fontWeight: 800,
                fontSize: { xs: '1.35rem', sm: '1.6rem' },
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
              }}
            >
              Registration Form
            </Typography>
            <Typography
              sx={{
                fontSize: 13.5,
                color: 'rgba(255,255,255,0.75)',
                mt: 0.5,
                fontFamily: '"DM Sans", sans-serif',
              }}
            >
              {event.eventName}
            </Typography>
            </Box>
          </Box>

          {/* Card body */}
          <Box sx={{ px: { xs: 3, sm: 4 }, py: { xs: 3, sm: 4 } }}>
            {/* Success state */}
            {success && (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  px: 2,
                }}
              >
                <CheckCircleOutlined sx={{ fontSize: 64, color: '#22C55E', mb: 2 }} />
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.35rem',
                    color: '#1E293B',
                    mb: 1,
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >
                  Registration Successful!
                </Typography>
                <Typography sx={{ color: '#64748B', fontSize: 14.5, mb: 3.5 }}>
                  Your registration for{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: '#1E293B' }}>
                    {event.eventName}
                  </Box>{' '}
                  has been confirmed.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {ticketId && (
                    <Button
                      variant="contained"
                      onClick={() => navigate(`/ticket/${ticketId}`)}
                      sx={{
                        bgcolor: BLUE,
                        borderRadius: 2.5,
                        px: 3.5,
                        py: 1.25,
                        fontWeight: 700,
                        textTransform: 'none',
                        fontSize: 14.5,
                        '&:hover': { bgcolor: '#1D46C8' },
                      }}
                    >
                      View Ticket
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    component={Link}
                    to="/events"
                    sx={{
                      borderColor: BLUE,
                      color: BLUE,
                      borderRadius: 2.5,
                      px: 3.5,
                      py: 1.25,
                      fontWeight: 700,
                      textTransform: 'none',
                      fontSize: 14.5,
                      '&:hover': { bgcolor: '#EEF2FF' },
                    }}
                  >
                    Browse More Events
                  </Button>
                </Box>
              </Box>
            )}

            {/* Error banner */}
            {error && !success && (
              <Alert
                severity="error"
                sx={{ mb: 3, borderRadius: 2.5, fontSize: 14 }}
                onClose={() => setError('')}
              >
                {error}
              </Alert>
            )}

            {/* Registration form */}
            {!success && !isFormEmpty && formStructure && (
              <RegistrationFlow
                formStructure={formStructure}
                onSubmit={handleFormSubmit}
                isSubmitting={createRegistration.isPending}
                eventId={eventId!}
                event={event}
              />
            )}

            {/* No-form fallback */}
            {isFormEmpty && !success && (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography sx={{ color: '#64748B', mb: 3, fontSize: 14.5 }}>
                  This event doesn't have a custom registration form. The organizer will collect
                  your details separately.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (!event) return;
                    createRegistration.mutate({ phone: '', eventId: eventId!, formData: {} });
                  }}
                  disabled={createRegistration.isPending}
                  sx={{
                    bgcolor: BLUE,
                    borderRadius: 2.5,
                    px: 4,
                    py: 1.25,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: 14.5,
                    '&:hover': { bgcolor: '#1D46C8' },
                    '&:disabled': { bgcolor: '#93A8F4' },
                  }}
                >
                  {createRegistration.isPending ? 'Registering…' : 'Register Anyway'}
                </Button>
              </Box>
            )}
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
