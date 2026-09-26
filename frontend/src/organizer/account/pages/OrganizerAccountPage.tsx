import { Alert, Avatar, Box, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import OrganizerShell from '../../components/OrganizerShell';
import { useOrganizerIdentity } from '../../components/useOrganizerIdentity';
import {
  orgCardSx,
  orgPageSubtitleSx,
  orgPageTitleSx,
} from '../../components/organizerStyles';

export default function OrganizerAccountPage() {
  const { organizer, user, isLoading } = useOrganizerIdentity();

  return (
    <OrganizerShell hideSearch hideCreate>
      <Typography sx={{ ...orgPageTitleSx }}>Account</Typography>
      <Typography sx={{ ...orgPageSubtitleSx, mb: 2.5 }}>Your organizer profile.</Typography>
      <Card variant="outlined" sx={{ ...orgCardSx, maxWidth: 640 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : organizer ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontWeight: 800 }}>
                  {organizer.name?.charAt(0)?.toUpperCase() || 'O'}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>{organizer.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{organizer.email || organizer.user?.email}</Typography>
                </Box>
                <Chip label={organizer.status} size="small" variant="outlined" color="success" sx={{ ml: 'auto' }} />
              </Box>
              <Typography variant="body2" color="text.secondary">Phone: {organizer.phone || '—'}</Typography>
              <Typography variant="body2" color="text.secondary">
                UPI ID: {organizer.upiId || '—'}
                <Typography component="span" variant="caption" color="text.secondary"> (set by admin, used for withdrawals)</Typography>
              </Typography>
              {organizer.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{organizer.description}</Typography>
              )}
            </>
          ) : user ? (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                No organizer profile is linked to this login yet. Showing your account details below.
              </Alert>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontWeight: 800 }}>
                  {user.name?.charAt(0)?.toUpperCase() || 'O'}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>{user.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                </Box>
                <Chip label={user.role} size="small" variant="outlined" color="primary" sx={{ ml: 'auto' }} />
              </Box>
              <Typography variant="body2" color="text.secondary">Phone: {user.phone || '—'}</Typography>
              <Typography variant="body2" color="text.secondary">
                Status: {user.isActive ? 'Active' : 'Inactive'}
              </Typography>
            </>
          ) : (
            <Alert severity="error">Could not load account.</Alert>
          )}
        </CardContent>
      </Card>
    </OrganizerShell>
  );
}
