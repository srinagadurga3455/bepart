import { Box, Card, CardContent, CircularProgress, Grid, Typography, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { adminApi, organizersApi } from '../../../shared/api';
import DashboardShell from '../../../shared/components/DashboardShell';
import OrganizerTable from '../components/OrganizerTable';
import { adminNav } from '../routes';

function StatCard({ label, value }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 3, height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { data: orgsRes, isLoading: orgsLoading, error: orgsError } = useQuery({
    queryKey: ['admin', 'organizers'], queryFn: () => organizersApi.list(),
  });
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin', 'events'], queryFn: () => adminApi.events(),
  });

  if (orgsLoading || eventsLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }
  if (orgsError) {
    return <Alert severity="error">Could not load admin data.</Alert>;
  }

  const organizers = Array.isArray(orgsRes?.data) ? orgsRes.data : [];
  const events = Array.isArray(eventsRes?.data) ? eventsRes.data : [];

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.04em', mb: 0.5 }}>
        Admin Dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Platform overview from live data.</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><StatCard label="Total Organizers" value={organizers.length} /></Grid>
        <Grid item xs={12} sm={4}>
          <StatCard label="Active Organizers" value={organizers.filter((o) => o.status === 'APPROVED').length} />
        </Grid>
        <Grid item xs={12} sm={4}><StatCard label="Total Events" value={events.length} /></Grid>
      </Grid>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <OrganizerTable />
        </CardContent>
      </Card>
    </Box>
  );
}

export default function AdminDashboardPage() {
  return (
    <DashboardShell navItems={adminNav}>
      <DashboardContent />
    </DashboardShell>
  );
}
