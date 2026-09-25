import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../../shared/api';
import DashboardShell from '../../../shared/components/DashboardShell';
import { logout } from '../../../shared/components/RequireRole';
import { adminNav } from '../routes';

export default function AdminAccountPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => authApi.me() });
  const user = data?.data;

  return (
    <DashboardShell title="Account" navItems={adminNav}>
      <Card variant="outlined" sx={{ borderRadius: 3, maxWidth: 640 }}>
        <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : error || !user ? (
            <Alert severity="error">Could not load account.</Alert>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontWeight: 800 }}>
                  {user.name?.charAt(0)?.toUpperCase() || 'A'}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>{user.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{user.email}</Typography>
                </Box>
                <Chip label={user.role} size="small" variant="outlined" color="error" sx={{ ml: 'auto' }} />
              </Box>
              <Typography variant="body2" color="text.secondary">Phone: {user.phone || '—'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Status: {user.isActive ? 'Active' : 'Inactive'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
                <Button size="small" variant="outlined" color="error" onClick={() => logout(navigate)}>
                  Sign Out
                </Button>
              </Box>
            </>
          )}
          <Divider sx={{ my: 2.5 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>About</Typography>
          <Typography variant="body2" color="text.secondary">
            BePart admin panel. Organizers and events are managed through this dashboard using the platform APIs.
          </Typography>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
