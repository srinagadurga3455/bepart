import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, FormControl, InputLabel, MenuItem,
  Pagination, Select, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import { HowToRegOutlined } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import OrganizerShell from '../../components/OrganizerShell';
import { registrationsApi } from '../../events/api/registrations';
import { eventsApi } from '../../events/api/events';
import { checkinApi } from '../../checkin/api/checkin';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import { formatEventDate } from '../../../app/utils/format';
import type { EventItem, RegistrationItem } from '../../../app/types';
import { registrantName } from '../../events/utils/eventData';
import { orgCardSx, orgSectionTitleSx, orgSmallButtonSx } from '../../components/organizerStyles';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';
import {
  CheckInChip, PaymentStatusChip, RegistrationDetailDialog,
} from '../components/RegistrationDetail';

const PAGE_SIZE = 10;

function RegistrationsContent() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [checkinFilter, setCheckinFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<RegistrationItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const { data: eventsRes } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const events: EventItem[] = useMemo(() => unwrapList<EventItem>(eventsRes), [eventsRes]);
  const eventById = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['registrations', 'mine'], queryFn: () => registrationsApi.list(),
  });
  const all: RegistrationItem[] = useMemo(() => (data ? unwrapList<RegistrationItem>(data) : []), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (eventFilter !== 'all' && r.eventId !== eventFilter) return false;
      if (paymentFilter !== 'all' && (r.paymentStatus || 'PENDING') !== paymentFilter) return false;
      if (checkinFilter === 'checked' && !r.checkedInAt) return false;
      if (checkinFilter === 'not-checked' && r.checkedInAt) return false;
      if (!q) return true;
      return [registrantName(r.formData), r.phone, r.registrationId]
        .join(' ').toLowerCase().includes(q);
    });
  }, [all, search, eventFilter, paymentFilter, checkinFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const checkedCount = all.filter((r) => !!r.checkedInAt).length;

  const checkIn = async (r: RegistrationItem) => {
    setBusy(true);
    setError('');
    try {
      await checkinApi.checkIn(r.registrationId);
      queryClient.invalidateQueries({ queryKey: ['registrations', 'mine'] });
      refetch();
      setDetail(null);
      enqueueSnackbar('Checked in successfully.', { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, 'Check-in failed.');
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <LoadingState message="Loading registrations…" />;
  if (loadError) return <ErrorState message="Could not load registrations." onRetry={() => refetch()} />;

  return (
    <Box>
      <Card variant="outlined" sx={{ ...orgCardSx, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', p: { xs: 2, md: 2.5 } }}>
          <Box>
            <Typography variant="caption" color="text.secondary">Total registrations</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{all.length}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Checked in</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{checkedCount}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Paid</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{all.filter((r) => r.paymentStatus === 'PAID').length}</Typography>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ ...orgCardSx }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>Registrations</Typography>
          {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
            <TextField size="small" placeholder="Search name, phone, ID…" value={search}
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
              <InputLabel>Payment</InputLabel>
              <Select label="Payment" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="PAID">Paid</MenuItem>
                <MenuItem value="PENDING">Pending</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140, bgcolor: '#fff' }}>
              <InputLabel>Check-in</InputLabel>
              <Select label="Check-in" value={checkinFilter} onChange={(e) => { setCheckinFilter(e.target.value); setPage(1); }}>
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="checked">Checked in</MenuItem>
                <MenuItem value="not-checked">Not checked in</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {filtered.length === 0 ? (
            <EmptyState
              icon={HowToRegOutlined}
              title={all.length === 0 ? 'No registrations yet' : 'No registrations match your filters'}
              description={all.length === 0 ? 'Share your published events — registrations will appear here.' : 'Try a different search or filter.'}
            />
          ) : (
            <>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 760 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Registrant</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Event</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Payment</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Check-in</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paged.map((r) => (
                      <TableRow key={r.registrationId}>
                        <TableCell sx={{ fontWeight: 600 }}>{registrantName(r.formData)}</TableCell>
                        <TableCell>{eventById[r.eventId]?.eventName || r.event?.eventName || '—'}</TableCell>
                        <TableCell>{r.phone}</TableCell>
                        <TableCell><PaymentStatusChip status={r.paymentStatus} /></TableCell>
                        <TableCell><CheckInChip checkedInAt={r.checkedInAt} /></TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            <Button size="small" variant="outlined" onClick={() => setDetail(r)} sx={{ ...orgSmallButtonSx }}>
                              View
                            </Button>
                            {!r.checkedInAt && (
                              <Button size="small" variant="contained" color="success" disabled={busy}
                                onClick={() => checkIn(r)} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                                Check In
                              </Button>
                            )}
                          </Box>
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

      <RegistrationDetailDialog
        open={!!detail}
        registration={detail}
        formStructure={detail ? (eventById[detail.eventId]?.formStructure ?? detail.event?.formStructure) : null}
        onClose={() => setDetail(null)}
      />
    </Box>
  );
}

export default function OrganizerRegistrationsPage() {
  return (
    <OrganizerShell title="Registrations" subtitle="Participants across your events." hideSearch hideCreate>
      <RegistrationsContent />
    </OrganizerShell>
  );
}
