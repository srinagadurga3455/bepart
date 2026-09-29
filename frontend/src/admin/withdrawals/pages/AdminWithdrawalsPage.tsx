import { useMemo, useState } from 'react';
import {
  Box, Button, Card, CardContent, FormControl, InputLabel, MenuItem, Pagination,
  Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import { AccountBalanceWalletOutlined, SearchOffOutlined } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { withdrawalsApi } from '../api/withdrawals';
import { unwrapList } from '../../../app/api/client';
import { formatEventDate, formatPaise } from '../../../app/utils/format';
import type { PageMeta, WithdrawalItem, WithdrawalStatus } from '../../../app/types';
import AdminShell from '../../components/AdminShell';
import WithdrawalStatusChip from '../../../app/components/WithdrawalStatus';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

const PAGE_SIZE = 10;
const MUTED = '#667085';
const BLUE = '#2557F5';

export default function AdminWithdrawalsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WithdrawalStatus>('all');
  const [page, setPage] = useState(1);

  // When search/filter is active, fetch all so results span the full dataset.
  // When neither is active, use server-side pagination.
  const isFiltering = search.trim().length > 0 || statusFilter !== 'all';

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'withdrawals', isFiltering ? 'all' : page, PAGE_SIZE],
    queryFn: () =>
      isFiltering
        ? withdrawalsApi.list()
        : withdrawalsApi.list({ page, limit: PAGE_SIZE }),
  });

  // Extract server meta when present (paged response)
  const body = data?.data;
  const pagedMeta: PageMeta | null =
    body && !Array.isArray(body) && typeof body === 'object' && 'meta' in body
      ? (body as { data: WithdrawalItem[]; meta: PageMeta }).meta
      : null;

  const all: WithdrawalItem[] = useMemo(() => (data ? unwrapList<WithdrawalItem>(data) : []), [data]);

  // Client-side filter when searching/filtering (operates on current page rows)
  const filtered = useMemo(() => {
    if (!isFiltering) return all; // no client filter needed; server already sliced
    const q = search.trim().toLowerCase();
    return all.filter((w) => {
      if (statusFilter !== 'all' && w.status !== statusFilter) return false;
      if (!q) return true;
      return [w.organizer?.name || '', w.event?.eventName || '', w.upiId || '', w.transactionId || '']
        .join(' ').toLowerCase().includes(q);
    });
  }, [all, search, statusFilter, isFiltering]);

  // Pagination logic
  const serverTotalPages = pagedMeta?.totalPages ?? 1;
  const clientTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const totalPages = isFiltering ? clientTotalPages : serverTotalPages;
  const safePage = Math.min(page, Math.max(1, totalPages));

  // When filtering, slice client-side too; otherwise backend already sliced
  const paged = isFiltering
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filtered;

  // Pending count for subtitle — from full server total when not filtering
  const totalAll = pagedMeta?.total ?? all.length;
  const pendingOnPage = all.filter((w) => w.status === 'REQUESTED' || w.status === 'PROCESSING').length;

  return (
    <AdminShell
      title="Withdrawal Requests"
      subtitle={`Review and settle organizer payouts${pendingOnPage ? ` · ${pendingOnPage} pending on this page` : ''}.`}
      hideBrand
    >
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <TextField
              size="small"
              placeholder="Search organizer, event, UPI…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              sx={{ flex: '1 1 220px', bgcolor: '#fff' }}
            />
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value as 'all' | WithdrawalStatus); setPage(1); }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="REQUESTED">Requested</MenuItem>
                <MenuItem value="PROCESSING">Processing</MenuItem>
                <MenuItem value="PAID">Paid</MenuItem>
                <MenuItem value="REJECTED">Rejected</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {isLoading ? (
            <LoadingState message="Loading withdrawal requests…" />
          ) : error ? (
            <ErrorState message="Could not load withdrawal requests." onRetry={() => refetch()} />
          ) : totalAll === 0 ? (
            <EmptyState
              icon={AccountBalanceWalletOutlined}
              title="No withdrawal requests yet"
              description="Organizer payout requests will appear here for review."
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchOffOutlined}
              title="No requests match your filters"
              description="Try a different search term or status."
            />
          ) : (
            <>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Organizer</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Requested</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{w.organizer?.name || '—'}</TableCell>
                        <TableCell>{w.event?.eventName || `Event ${w.eventId}`}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{formatPaise(w.amount)}</TableCell>
                        <TableCell>{formatEventDate(w.requestedAt)}</TableCell>
                        <TableCell><WithdrawalStatusChip status={w.status} /></TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            component={RouterLink}
                            to={`/admin/withdrawals/${w.id}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 2,
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {isFiltering
                    ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
                    : `${totalAll} request${totalAll === 1 ? '' : 's'} total`}
                </Typography>
                {totalPages > 1 && (
                  <Pagination
                    count={totalPages}
                    page={safePage}
                    onChange={(_, v) => setPage(v)}
                    size="small"
                    shape="rounded"
                    sx={{
                      '& .MuiPaginationItem-root': { fontSize: 12.5, color: MUTED },
                      '& .Mui-selected': {
                        bgcolor: '#EAF1FF !important',
                        color: BLUE,
                        fontWeight: 700,
                      },
                    }}
                  />
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}
