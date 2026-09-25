import { Box, Typography, Button, Card, CardContent, Alert } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';

export default function SuccessState({ event, onDone }) {
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

      <Typography variant="h4" fontWeight={700} color="text.primary" gutterBottom>
        Registration Confirmed!
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph sx={{ maxWidth: 500, mx: 'auto' }}>
        You are successfully registered for <strong>{event?.eventName || 'this event'}</strong>.
        A confirmation has been sent to your phone number.
      </Typography>

      {event && (
        <Card variant="outlined" sx={{ mt: 4, maxWidth: 500, mx: 'auto' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Event Date
            </Typography>
            <Typography variant="body1" fontWeight={500} color="text.primary">
              {new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
              Registration Closes
            </Typography>
            <Typography variant="body1" fontWeight={500} color="text.primary">
              {new Date(event.closingTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Alert severity="success" variant="standard" sx={{ mt: 4 }}>
        <Typography variant="body2">
          Your registration ID has been recorded. Please save this for future reference.
        </Typography>
      </Alert>

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