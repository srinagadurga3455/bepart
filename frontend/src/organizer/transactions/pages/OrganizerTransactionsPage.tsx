import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Pagination, Select, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { ReceiptOutlined } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import OrganizerShell from '../../components/OrganizerShell';
import { paymentsApi } from '../api/payments';
import { eventsApi } from '../../events/api/events';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import type { EventItem, PaymentItem, PaymentStatus } from '../../../app/types';
import { orgCardSx, orgSectionTitleSx, orgSmallButtonSx } from '../../components/organizerStyles';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';
import { PaymentStatusChip } from '../../registrations/components/RegistrationDetail';

const PAGE_SIZE = 10;

function statusColor(s: PaymentStatus): 'success' | 'error' | 'warning' {
  return s === 'PAID' ? 'success' : s === 'FAILED' ? 'error' : 'warning';
}

function TransactionsContent() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<PaymentItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data: eventsRes } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const events: EventItem[] = useMemo(() => unwrapList<EventItem>(eventsRes), [eventsRes]);
  const eventNameById = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e.eventName])), [events]);

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['payments', 'mine'], queryFn: () => paymentsApi.mine(),
  });
  const all: PaymentItem[] = useMemo(() => (data ? unwrapList<PaymentItem>(data) : []), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (eventFilter !== 'all') {
        const eid = p.eventId || p.registration?.eventId;
        if (eid !== eventFilter) return false;
      }
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.id, p.phone || '', p.couponCode || '', p.registrationId || '', eventNameById[p.eventId || ''] || '']
        .join(' ').toLowerCase().includes(q);
    });
  }, [all, search, eventFilter, statusFilter, eventNameById]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const collected = all.filter((p) => p.status === 'PAID').reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const collectedLabel = formatINR(collected);

  const markStatus = async (p: PaymentItem, status: PaymentStatus) => {
    setBusy(true);
    setError('');
    try {
      await paymentsApi.updateStatus(p.id, status);
      queryClient.invalidateQueries({ queryKey: ['payments', 'mine'] });
      setDetail(null);
      refetch();
      enqueueSnackbar(`Payment marked ${status}.`, { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not update payment.');
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading transactions…" />;
  if (loadError) return <ErrorState message="Could not load transactions." onRetry={() => refetch()} />;

  return (
    <Box>
      <Card variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', p: { xs: 2, md: 2.5 } }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Transactions</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{all.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Collected (PAID)</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{collectedLabel}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Pending</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{all.filter((p) => p.status === 'PENDING').length}</Typography>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ ...orgCardSx }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>Transactions</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <TextField size="small" placeholder="Search phone, coupon, ID…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              sx={{ flex: '1 1 200px', bgcolor: '#fff' }} />
            <FormControl size="small" sx={{ minWidth: 160, bgcolor: '#fff' }}>
              <InputLabel>Event</InputLabel>
              <Select label="Event" value={eventFilter} onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}>
                <MenuItem value="all">All events</MenuItem>
                {events.map((e) => <MenuItem key={e.id} value={e.id}>{e.eventName}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140, bgcolor: '#fff' }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as 'all' | PaymentStatus); setPage(1); }}>
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="PAID">Paid</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {filtered.length === 0 ? (
            <EmptyState
              icon={ReceiptOutlined}
              title={all.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
              description={all.length === 0 ? 'Payments for paid events will appear here.' : 'Try a different search or filter.'}
            />
          ) : (
            <>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Coupon</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.event?.eventName || eventNameById[p.eventId || ''] || '—'}</TableCell>
                        <TableCell>{p.phone || p.registration?.phone || '—'}</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{formatINR(p.amount)}</TableCell>
                        <TableCell>{p.couponCode || '—'}</TableCell>
                        <TableCell><PaymentStatusChip status={p.status} /></TableCell>
                        <TableCell>{formatEventDate(p.createdAt)}</TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => setDetail(p)} sx={{ ...orgSmallButtonSx }}>
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination count={totalPages} page={safePage} onChange={(_, v) => setPage(v)} size="small" shape="rounded" />
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onClose={() => setDetail(null)} fullWidth maxWidth="sm"
        sx={{ '& .MuiDialog-paper': { m: { xs: 1.5 }, borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Transaction detail</DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={detail.status} size="small" color={statusColor(detail.status)} />
                {detail.couponCode && <Chip label={`Coupon ${detail.couponCode}`} size="small" variant="outlined" />}
              </Box>
              {[
                ['Event', detail.event?.eventName || eventNameById[detail.eventId || ''] || '—'],
                ['Phone', detail.phone || detail.registration?.phone || '—'],
                ['Amount', formatINR(detail.amount)],
                ['Original', detail.originalAmount != null ? formatINR(detail.originalAmount) : '—'],
                ['Discount', detail.discountAmount != null ? formatINR(detail.discountAmount) : '—'],
                ['Registration', detail.registrationId || '—'],
                ['Date', formatEventDate(detail.createdAt)],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{v}</Typography>
                </Box>
              ))}
              {detail.status === 'PENDING' && (
                <Alert severity="info">
                  Confirm an offline collection by marking this payment PAID (syncs the registration), or FAILED if it will not be paid.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetail(null)}>Close</Button>
          {detail?.status === 'PENDING' && (
            <>
              <Button color="error" disabled={busy} onClick={() => detail && markStatus(detail, 'FAILED')}>Mark Failed</Button>
              <Button variant="contained" color="success" disabled={busy} onClick={() => detail && markStatus(detail, 'PAID')} sx={{ boxShadow: 'none' }}>
                {busy ? 'Working…' : 'Mark Paid'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function OrganizerTransactionsPage() {
  return (
    <OrganizerShell title="Transactions" subtitle="Payments across your events." hideSearch hideCreate>
      <TransactionsContent />
    </OrganizerShell>
  );
}
