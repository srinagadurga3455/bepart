import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { withdrawalsApi } from '../api/withdrawals';
import { unwrapList } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import type { WithdrawalItem } from '../../../app/types';
import DashboardShell from '../../../app/components/DashboardShell';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';
import { adminNav } from '../../routes';

export default function AdminWithdrawalsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'withdrawals'], queryFn: () => withdrawalsApi.list(),
  });
  const withdrawals: WithdrawalItem[] = data ? unwrapList<WithdrawalItem>(data) : [];

  return (
    <DashboardShell title="Withdrawal Requests" navItems={adminNav}>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
          ) : error ? (
            <Alert severity="error">Could not load withdrawal requests.</Alert>
          ) : withdrawals.length === 0 ? (
            <Alert severity="info">No withdrawal requests yet.</Alert>
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organizer</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Requested</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {withdrawals.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.organizer?.name || '—'}</TableCell>
                      <TableCell>{w.event?.eventName || `Event ${w.eventId}`}</TableCell>
                      <TableCell>{formatINR(w.amount)}</TableCell>
                      <TableCell>{formatEventDate(w.requestedAt)}</TableCell>
                      <TableCell><WithdrawalStatusChip status={w.status} /></TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" component={RouterLink} to={`/admin/withdrawals/${w.id}`}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {withdrawals.length} request{withdrawals.length === 1 ? '' : 's'} total.
          </Typography>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
