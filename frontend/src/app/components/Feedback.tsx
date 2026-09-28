import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';

// Shared loading indicator: centered spinner with an optional message.
export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 8 }}>
      <CircularProgress size={40} />
      <Typography color="text.secondary" sx={{ fontSize: 14 }}>
        {message}
      </Typography>
    </Box>
  );
}

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

// Shared error panel with an optional retry action.
export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <Box sx={{ py: 4 }}>
      <Alert
        severity="error"
        action={
          onRetry ? (
            <Button color="inherit" size="small" onClick={onRetry}>
              Retry
            </Button>
          ) : undefined
        }
      >
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2">{message}</Typography>
      </Alert>
    </Box>
  );
}
