import { Box, Grid, Typography } from '@mui/material';
import { AccountBalanceWalletOutlined, CalendarMonthOutlined, GroupsOutlined, PersonAddAltOutlined } from '@mui/icons-material';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api/admin';
import { organizersApi } from '../../organizers/api/organizers';
import { withdrawalsApi } from '../../withdrawals/api/withdrawals';
import { unwrapList } from '../../../app/api/client';
import type { EventItem, OrganizerItem, WithdrawalItem } from '../../../app/types';
import { isOrganizerActive } from '../../organizers/components/OrganizerTable';
import AdminShell from '../../components/AdminShell';
import OrganizerTable from '../../organizers/components/OrganizerTable';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: '1px solid #ECEEF4',
        borderRadius: '12px',
        p: 2.25,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.75,
        height: '100%',
      }}
    >
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          bgcolor: '#EAF1FF',
          color: '#2557F5',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12.5, color: '#667085', fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.02em', color: '#101828', lineHeight: 1.25 }}>
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

function DashboardContent() {
  const { data: orgsRes, isLoading: orgsLoading, error: orgsError, refetch } = useQuery({
    queryKey: ['admin', 'organizers'], queryFn: () => organizersApi.list(),
  });
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ['admin', 'events'], queryFn: () => adminApi.events(),
  });
  const { data: wdsRes, isLoading: wdsLoading } = useQuery({
    queryKey: ['admin', 'withdrawals'], queryFn: () => withdrawalsApi.list(),
  });

  if (orgsLoading || eventsLoading || wdsLoading) {
    return <LoadingState message="Loading admin dashboard…" />;
  }
  if (orgsError) {
    return <ErrorState message="Could not load admin data. Check your connection and try again." onRetry={() => refetch()} />;
  }

  const organizers: OrganizerItem[] = orgsRes ? unwrapList<OrganizerItem>(orgsRes) : [];
  const events: EventItem[] = eventsRes ? unwrapList<EventItem>(eventsRes) : [];
  const withdrawals: WithdrawalItem[] = wdsRes ? unwrapList<WithdrawalItem>(wdsRes) : [];
  const pendingPayouts = withdrawals.filter((w) => w.status === 'REQUESTED' || w.status === 'PROCESSING').length;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={<GroupsOutlined sx={{ fontSize: 22 }} />} label="Total Organizers" value={organizers.length} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<PersonAddAltOutlined sx={{ fontSize: 22 }} />}
            label="Active Organizers"
            value={organizers.filter((o) => isOrganizerActive(o)).length}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={<CalendarMonthOutlined sx={{ fontSize: 22 }} />} label="Total Events" value={events.length} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard icon={<AccountBalanceWalletOutlined sx={{ fontSize: 22 }} />} label="Pending Payouts" value={pendingPayouts} />
        </Grid>
      </Grid>

      <OrganizerTable />
    </Box>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminShell title="Admin Dashboard" subtitle="Manage campus organizers and events from one place.">
      <DashboardContent />
    </AdminShell>
  );
}
