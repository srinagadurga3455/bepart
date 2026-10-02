import { Box, Typography, Button } from '@mui/material';
import { CheckCircle, WhatsApp as WhatsAppIcon } from '@mui/icons-material';
import type { FlowEventInfo } from './RegistrationFlow';
import { getWhatsappGroupLink } from '../utils/whatsappGroup';

interface SuccessStateProps {
  event?: FlowEventInfo;
  onDone?: () => void;
}

// Confirmation-only success state: no ticket preview, ticket/registration
// IDs, QR, or View Ticket button. The ticket is delivered over WhatsApp.
export default function SuccessState({ event, onDone }: SuccessStateProps) {
  return (
    <Box sx={{ width: '100%', textAlign: 'center', py: 6 }}>
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4caf50, #81c784)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2.5rem',
          margin: '0 auto 3',
          boxShadow: '0 8 24 rgba(76, 175, 80, 0.3)',
        }}
      >
        <CheckCircle />
      </Box>

      <Typography variant="h4" color="text.primary" gutterBottom sx={{ fontWeight: 700 }}>
        Registration Confirmed!
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 2 }}>
        You are successfully registered for <strong>{event?.eventName || 'this event'}</strong>.
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
          maxWidth: 500,
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
        <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: '#15803D', textAlign: 'left', lineHeight: 1.4 }}>
          Your ticket has been sent to your registered WhatsApp number.
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 2 }}>
        Open WhatsApp to access your ticket and QR code. Keep the ticket handy for entry.
      </Typography>

      {getWhatsappGroupLink(event) && (
        <Box
          sx={{
            maxWidth: 500,
            mx: 'auto',
            mb: 2,
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
              borderRadius: 2,
              px: 4,
              py: 1.25,
              fontWeight: 700,
              textTransform: 'none',
              '&:hover': { bgcolor: '#1DA851' },
            }}
          >
            Join WhatsApp Group
          </Button>
        </Box>
      )}

      <Box sx={{ mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          onClick={onDone}
          sx={{ px: 6, py: 1.5, fontWeight: 600, borderRadius: 2 }}
        >
          Back to Events
        </Button>
      </Box>
    </Box>
  );
}
