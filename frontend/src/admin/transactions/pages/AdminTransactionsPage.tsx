import { useMemo, useState } from 'react';
import {
  Alert, Box, Card, CardContent, Chip, Dialog, DialogActions,
  DialogContent, DialogTitle, Button, Divider, FormControl,
  InputAdornment, InputLabel, MenuItem, Pagination, Select,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material';
import {
  ReceiptLongOutlined, SearchOffOutlined, Search,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { adminPaymentsApi } from '../api/payments';
import type { PaymentPage } from '../api/payments';
import { unwrapList } from '../../../app/api/client';
import { formatEventDate, formatPaise } from '../../../app/utils/format';
import type { PaymentItem, PaymentStatus } from '../../../app/types';
import AdminShell from '../../components/AdminShell';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

const PAGE_SIZE = 10;
const BLUE = '#2557F5';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

// ─── Status chip ───────────────────────────────────────────────────────────────
function PaymentStatusChip({ status }: { status: string | null | undefined }) {
  const color =
    status === 'PAID' ? 'success' : status === 'FAILED' ? 'error' : 'warning';
  return (
    <Chip label={status || 'PENDING'} size="small" variant="outlined" color={color} />
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Box
      sx={{
        bgcolor: '#FFFFFF',
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 3,
        p: 2.25,
        flex: '1 1 150px',
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>{label}</Typography>
      <Typography
        sx={{ fontSize: 24, fontWeight: 800, color: INK, letterSpacing: '-0.02em', lineHeight: 1.25 }}
      >
        {value}
      </Typography>
      {sub && <Typography sx={{ fontSize: 11.5, color: MUTED, mt: 0.25 }}>{sub}</Typography>}
    </Box>
  );
}

// ─── Detail row ────────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 2,
        py: 1,
        borderBottom: `1px solid ${CARD_BORDER}`,
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Typography sx={{ fontSize: 13, color: MUTED, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: INK, textAlign: 'right', wordBreak: 'break-all' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ─── Main content ──────────────────────────────────────────────────────────────
function TransactionsContent() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<PaymentItem | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'transactions', page, PAGE_SIZE],
    queryFn: () => adminPaymentsApi.all({ page, limit: PAGE_SIZE }),
  });

  // Extract paged meta (present when server returns { data, meta })
  const body = data?.data;
  const pagedResponse = (
    body && !Array.isArray(body) && typeof body === 'object' && 'meta' in body
  ) ? (body as PaymentPage) : null;

  const rows: PaymentItem[] = data ? unwrapList<PaymentItem>(data) : [];

  // Client-side filter on current page rows (search + status)
  // Stats come from server meta so they always reflect the full dataset
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return [
        p.id,
        p.phone || '',
        p.couponCode || '',
        p.registrationId || '',
        p.event?.eventName || '',
        (p.event as any)?.organizer?.name || '',
        p.registration?.event?.eventName || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, statusFilter]);

  // Pagination: use server meta when no local filter active
  const isLocalFiltering = search.trim().length > 0 || statusFilter !== 'all';
  const serverTotalPages = pagedResponse?.meta.totalPages ?? 1;
  const clientTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const totalPages = isLocalFiltering ? clientTotalPages : serverTotalPages;
  const safePage = Math.min(page, Math.max(1, totalPages));

  // When local filtering, also slice client-side (single page of filtered rows)
  const displayRows = isLocalFiltering
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filtered;

  // Summary stats — always from server meta (full dataset, not current page)
  const totalCount = pagedResponse?.meta.total ?? rows.length;
  const totalPaidPaise = pagedResponse?.meta.totalPaidPaise ?? 0;
  const pendingCount = pagedResponse?.meta.pendingCount ?? 0;
  const failedCount = pagedResponse?.meta.failedCount ?? 0;

  if (isLoading) return <LoadingState message="Loading transactions…" />;
  if (error) return <ErrorState message="Could not load transactions." onRetry={() => refetch()} />;

  const eventName = (p: PaymentItem) =>
    p.event?.eventName || p.registration?.event?.eventName || `Event ${p.eventId || '—'}`;

  const organizerName = (p: PaymentItem) =>
    (p.event as any)?.organizer?.name ||
    (p.registration?.event as any)?.organizer?.name ||
    '—';

  return (
    <Box>
      {/* ── Stats — always represent full dataset totals ────────────── */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
        <StatCard label="Total Transactions" value={totalCount} />
        <StatCard
          label="Total Collected"
          value={formatPaise(totalPaidPaise)}
          sub="PAID payments only"
        />
        <StatCard label="Pending" value={pendingCount} />
        <StatCard label="Failed" value={failedCount} />
      </Box>

      {/* ── Table card ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: '12px',
          p: { xs: 2, md: 2.5 },
        }}
      >
        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ mr: 'auto', fontSize: 17, fontWeight: 800, color: INK }}>
            All Transactions
          </Typography>
          <TextField
            size="small"
            placeholder="Search phone, event, coupon, ID…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 17, color: '#98A2B3' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: { xs: '100%', sm: 260 },
              '& .MuiOutlinedInput-root': { borderRadius: '9px', fontSize: 13, bgcolor: '#FFFFFF' },
            }}
          />
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
            <InputLabel id="txn-status-filter">Status</InputLabel>
            <Select
              labelId="txn-status-filter"
              label="Status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'all' | PaymentStatus); setPage(1); }}
              sx={{ borderRadius: '9px', fontSize: 13, bgcolor: '#FFFFFF' }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="PAID">Paid</MenuItem>
              <MenuItem value="FAILED">Failed</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Empty state */}
        {totalCount === 0 ? (
          <EmptyState
            icon={ReceiptLongOutlined}
            title="No transactions yet"
            description="Payments from paid events will appear here once participants start registering."
          />
        ) : filtered.length === 0 && isLocalFiltering ? (
          <EmptyState
            icon={SearchOffOutlined}
            title="No transactions match your filters"
            description="Try a different search term or status filter."
          />
        ) : (
          <>
            <TableContainer
              sx={{ overflowX: 'auto', border: '1px solid #EEF1F7', borderRadius: '10px' }}
            >
              <Table size="small" sx={{ minWidth: 820 }}>
                <TableHead>
                  <TableRow
                    sx={{
                      bgcolor: '#F4F7FF',
                      '& .MuiTableCell-head': { borderBottom: '1px solid #EEF1F7' },
                    }}
                  >
                    {['Event', 'Organizer', 'Phone', 'Amount', 'Coupon', 'Status', 'Date', ''].map(
                      (h) => (
                        <TableCell key={h} sx={{ fontSize: 12, fontWeight: 600, color: MUTED }}>
                          {h}
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayRows.map((p) => (
                    <TableRow
                      key={p.id}
                      sx={{
                        '& .MuiTableCell-body': {
                          fontSize: 13,
                          borderBottom: '1px solid #F2F4F8',
                          color: INK,
                        },
                        '&:hover': { bgcolor: '#FAFBFF' },
                      }}
                    >
                      <TableCell sx={{ maxWidth: 200 }}>
                        <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                          {eventName(p)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: MUTED }}>{organizerName(p)}</TableCell>
                      <TableCell sx={{ color: MUTED }}>{p.phone || p.registration?.phone || '—'}</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: BLUE }}>{formatPaise(p.amount)}</TableCell>
                      <TableCell sx={{ color: MUTED }}>{p.couponCode || '—'}</TableCell>
                      <TableCell><PaymentStatusChip status={p.status} /></TableCell>
                      <TableCell sx={{ color: MUTED, whiteSpace: 'nowrap' }}>
                        {formatEventDate(p.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setDetail(p)}
                          sx={{ fontSize: 12, textTransform: 'none', borderRadius: '7px' }}
                        >
                          Details
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
              <Typography sx={{ fontSize: 12.5, color: MUTED }}>
                {isLocalFiltering
                  ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'} on this page`
                  : `${totalCount} transaction${totalCount === 1 ? '' : 's'} total`}
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
      </Box>

      {/* ── Transaction detail dialog ──────────────────────────────────── */}
      <Dialog
        open={!!detail}
        onClose={() => setDetail(null)}
        fullWidth
        maxWidth="sm"
        sx={{ '& .MuiDialog-paper': { m: { xs: 1.5 }, borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, fontSize: 16, color: INK }}>
          Transaction Details
        </DialogTitle>
        <DialogContent dividers>
          {detail && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                <PaymentStatusChip status={detail.status} />
                {detail.couponCode && (
                  <Chip
                    label={`Coupon: ${detail.couponCode}`}
                    size="small"
                    variant="outlined"
                    color="info"
                  />
                )}
              </Box>
              <Box
                sx={{
                  bgcolor: '#F6F8FB',
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 2,
                  px: 2.5,
                  py: 0.5,
                  mb: 2,
                }}
              >
                <DetailRow label="Payment ID" value={detail.id} />
                <DetailRow label="Event" value={eventName(detail)} />
                <DetailRow label="Organizer" value={organizerName(detail)} />
                <DetailRow label="Phone" value={detail.phone || detail.registration?.phone || '—'} />
                <DetailRow label="Amount" value={formatPaise(detail.amount)} />
                {detail.originalAmount != null && (
                  <DetailRow label="Original Amount" value={formatPaise(detail.originalAmount)} />
                )}
                {detail.discountAmount != null && detail.discountAmount > 0 && (
                  <DetailRow label="Discount" value={formatPaise(detail.discountAmount)} />
                )}
                {detail.couponCode && (
                  <DetailRow label="Coupon Code" value={detail.couponCode} />
                )}
                <DetailRow label="Registration ID" value={detail.registrationId || '—'} />
                <DetailRow label="Date" value={formatEventDate(detail.createdAt)} />
              </Box>
              {((detail as any).razorpayOrderId || (detail as any).razorpayPaymentId) && (
                <>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: MUTED, mb: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Razorpay
                  </Typography>
                  <Box
                    sx={{
                      bgcolor: '#F6F8FB',
                      border: `1px solid ${CARD_BORDER}`,
                      borderRadius: 2,
                      px: 2.5,
                      py: 0.5,
                    }}
                  >
                    {(detail as any).razorpayOrderId && (
                      <DetailRow label="Order ID" value={(detail as any).razorpayOrderId} />
                    )}
                    {(detail as any).razorpayPaymentId && (
                      <DetailRow label="Payment ID" value={(detail as any).razorpayPaymentId} />
                    )}
                  </Box>
                </>
              )}
              {detail.status === 'PENDING' && (
                <Alert severity="info" sx={{ mt: 2, borderRadius: 2, fontSize: 13 }}>
                  This payment is pending. It will become PAID once the participant completes the
                  Razorpay checkout or the organizer confirms an offline collection.
                </Alert>
              )}
              {detail.status === 'FAILED' && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontSize: 13 }}>
                  This payment failed or was cancelled. The participant did not complete checkout.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetail(null)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Page shell ────────────────────────────────────────────────────────────────
export default function AdminTransactionsPage() {
  return (
    <AdminShell
      title="Transactions"
      subtitle="All platform payment records across every paid event."
      hideBrand
    >
      <TransactionsContent />
    </AdminShell>
  );
}
