import { Alert, Avatar, Box, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { organizersApi } from '../api/organizers';
import DashboardShell from '../../../app/components/DashboardShell';
import { organizerNav } from '../../events/pages/EventWizard';

export default function OrganizerAccountPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['organizer', 'me'], queryFn: () => organizersApi.getMe() });
  const organizer = data?.data;

  return (
    <DashboardShell title="Account" navItems={organizerNav}>
      <Card variant="outlined" sx={{ borderRadius: 3, maxWidth: 640 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : error || !organizer ? (
            <Alert severity="error">Could not load account.</Alert>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
