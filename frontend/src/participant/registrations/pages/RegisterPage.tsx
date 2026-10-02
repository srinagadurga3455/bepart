import { useParams, Link } from 'react-router-dom';
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
import { ArrowBack, CheckCircleOutlined, ConfirmationNumber, ErrorOutlined, WhatsApp as WhatsAppIcon } from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { eventsApi } from '../../events/api/events';
import { registrationsApi } from '../api/registrations';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import type { FormDataRecord, RegistrationItem } from '../../../app/types';
import { eventPoster } from '../../../app/types';
import RegistrationFlow from '../components/RegistrationFlow';
import type { PaidRegistrationArgs } from '../components/PaymentStep';
import { getWhatsappGroupLink } from '../utils/whatsappGroup';

const BLUE = '#2557F5';

interface RegisterVariables {
  phone: string;
  [field: string]: unknown;
}

export default function RegisterPage() {
  const { eventId } = useParams();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  // Kept for mutation bookkeeping only (ticket creation still happens
  // server-side). Never rendered or navigated to — the success screen stays
  // on this confirmation and directs the participant to WhatsApp.
  const [ticketId, setTicketId] = useState<string | null>(null);
  void ticketId;

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

  // Paid-event completion: runs ONLY after POST /payments/verify confirms
  // PAID (see PaymentStep). Sends the SAME couponCode priced at init —
  // the backend rejects a mismatch instead of silently full-pricing.
  const createPaidRegistration = useMutation({
    mutationFn: (vars: { phone: string; formData: FormDataRecord; couponCode?: string }) =>
      registrationsApi.create({ eventId: eventId!, phone: vars.phone, formData: vars.formData, couponCode: vars.couponCode }),
    onSuccess: (res) => {
      setTicketId(res?.data?.registrationId || null);
      setSuccess(true);
      setError('');
    },
    onError: async (err) => {
      // Backend auto-fulfills the registration during verify/webhook when the
      // payment carries formData — then this POST 409s because the ticket
      // ALREADY exists. Recover it instead of failing the user.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        try {
          const list = await registrationsApi.list();
          const mine = unwrapList<RegistrationItem>(list).find(
            (r) => String((r as { eventId?: unknown })?.eventId) === String(eventId),
          );
          if (mine?.registrationId) {
            setTicketId(mine.registrationId);
            setSuccess(true);
            setError('');
            return;
          }
        } catch {
          // Fall through to the generic error below.
        }
      }
      setError(apiErrorMessage(err, 'Registration failed after payment. Your payment is recorded — contact the organizer with your phone number.'));
    },
  });

  const handlePaidComplete = (args: PaidRegistrationArgs) => {
    setError('');
    createPaidRegistration.mutate({ phone: args.phone, formData: args.formData, couponCode: args.couponCode });
  };

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
            {/* Success state — confirmation only. No ticket preview, ticket ID,
                QR, or View Ticket button here; the ticket is delivered over
                WhatsApp and opened from there. */}
            {success && (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  px: 2,
                }}
              >
                <CheckCircleOutlined sx={{ fontSize: 72, color: '#22C55E', mb: 2 }} />
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: '1.5rem',
                    color: '#1E293B',
                    mb: 1,
                    fontFamily: '"DM Sans", sans-serif',
                  }}
                >
                  Registration Confirmed!
                </Typography>
                <Typography sx={{ color: '#475569', fontSize: 15, mb: 2.5 }}>
                  You are successfully registered for{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: '#1E293B' }}>
                    {event.eventName}
                  </Box>
                  .
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1.25,
                    bgcolor: '#E7F7EE',
                    border: '1px solid #BBE5C9',
                    borderRadius: 3,
                    px: 2.5,
                    py: 2,
                    mb: 1.5,
                    maxWidth: 440,
                    mx: 'auto',
                  }}
                >
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      bgcolor: '#25D366',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <WhatsAppIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 800,
                      fontSize: 14.5,
                      color: '#15803D',
                      textAlign: 'left',
                      lineHeight: 1.4,
                    }}
                  >
                    Your ticket has been sent to your registered WhatsApp number.
                  </Typography>
                </Box>
                <Typography sx={{ color: '#64748B', fontSize: 14, mb: 3.5, maxWidth: 440, mx: 'auto' }}>
                  Open WhatsApp to access your ticket and QR code. Keep the ticket handy for entry.
                </Typography>
                {/* Optional official event WhatsApp group — rendered only
                    when the event has a group link. Separate from ticket
                    delivery; the participant explicitly clicks to join. */}
                {getWhatsappGroupLink(event) && (
                  <Box
                    sx={{
                      maxWidth: 440,
                      mx: 'auto',
                      mb: 3,
                      px: 2.5,
                      py: 2.5,
                      borderRadius: 3,
                      border: '1px solid #E2E8F0',
                      bgcolor: '#F8FAFC',
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1E293B', mb: 0.75 }}>
                      📢 Join the official event WhatsApp group
                    </Typography>
                    <Typography sx={{ color: '#64748B', fontSize: 13.5, mb: 2 }}>
                      Join the group for event announcements, updates, and important information.
                    </Typography>
                    <Button
                      variant="contained"
                      href={getWhatsappGroupLink(event)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      startIcon={<WhatsAppIcon sx={{ fontSize: 20 }} />}
                      sx={{
                        bgcolor: '#25D366',
                        borderRadius: 2.5,
                        px: 3.5,
                        py: 1.25,
                        fontWeight: 700,
                        textTransform: 'none',
                        fontSize: 14.5,
                        '&:hover': { bgcolor: '#1DA851' },
                      }}
                    >
                      Join WhatsApp Group
                    </Button>
                  </Box>
                )}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
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
                isSubmitting={createRegistration.isPending || createPaidRegistration.isPending}
                eventId={eventId!}
                event={event}
                onPaymentComplete={handlePaidComplete}
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
