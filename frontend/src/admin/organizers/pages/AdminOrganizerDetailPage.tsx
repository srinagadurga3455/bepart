import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Divider,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography,
} from '@mui/material';
import {
  ArrowBack, CalendarMonthOutlined, CheckCircleOutlined,
  EventOutlined, GroupsOutlined, PaymentsOutlined,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { organizersApi } from '../api/organizers';
import { apiErrorMessage } from '../../../app/api/client';
import { formatEventDate, formatPaise } from '../../../app/utils/format';
import type { OrganizerOverviewEvent } from '../../../app/types';
import AdminShell from '../../components/AdminShell';
import { isOrganizerActive, OrganizerStatusChip } from '../components/OrganizerTable';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import EmptyState from '../../../app/components/EmptyState';

const BLUE = '#2557F5';
const CARD_BG = '#FFFFFF';
const CARD_BORDER = '#ECEEF4';
const LABEL_COLOR = '#667085';
const INK = '#101828';

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Box
      sx={{
        bgcolor: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: 3,
        p: 2.25,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.75,
        height: '100%',
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          bgcolor: '#EAF1FF',
          color: BLUE,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: 12, color: LABEL_COLOR, fontWeight: 500 }}>{label}</Typography>
        <Typography
          sx={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: INK,
            lineHeight: 1.2,
          }}
        >
          {value}
        </Typography>
        {sub && (
          <Typography sx={{ fontSize: 11.5, color: LABEL_COLOR, mt: 0.25 }}>{sub}</Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Info row ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: `1px solid ${CARD_BORDER}`, '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ fontSize: 13, fontWeight: 600, color: LABEL_COLOR, width: 110, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, color: INK, wordBreak: 'break-all' }}>{value}</Typography>
    </Box>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <Box sx={{ color: BLUE }}>{icon}</Box>
      <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK, letterSpacing: '-0.01em' }}>
        {title}
      </Typography>
    </Box>
  );
}

// ─── Overview content ──────────────────────────────────────────────────────────
function OverviewContent({ id }: { id: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [confirmDeact, setConfirmDeact] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const {
    data: res,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'organizer-overview', id],
    queryFn: () => organizersApi.overview(id),
    enabled: !!id,
  });

  const overview = res?.data;

  const refresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizer-drawer'] });
  };

  const runChange = async (fn: () => Promise<unknown>, okMsg: string, failMsg: string) => {
    setActionError('');
    setBusy(true);
    try {
      await fn();
      refresh();
      enqueueSnackbar(okMsg, { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, failMsg);
      setActionError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
        <CircularProgress size={40} sx={{ color: BLUE }} />
      </Box>
    );
  }

  if (error || !overview) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Could not load organizer overview. Please go back and try again.
      </Alert>
    );
  }

  const { organizer, events, totalEvents, upcomingEvents, completedEvents,
          totalRegistrations, totalRevenuePaise } = overview;

  const totalRevenueRupees = totalRevenuePaise / 100;
  const active = isOrganizerActive(organizer);

  // Events with revenue (only paid events)
  const paidEvents = events.filter((e: OrganizerOverviewEvent) => e.paymentRequired);
  const freeEvents = events.filter((e: OrganizerOverviewEvent) => !e.paymentRequired);

  return (
    <Box>
      {/* ── Top action bar ─────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        <Button
          startIcon={<ArrowBack sx={{ fontSize: 17 }} />}
          onClick={() => navigate('/admin')}
          sx={{
            color: BLUE,
            fontWeight: 600,
            fontSize: 14,
            textTransform: 'none',
            p: 0,
            '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' },
          }}
        >
          Back to Dashboard
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {active ? (
            <Button
              size="small"
              color="error"
              variant="outlined"
              disabled={busy}
              onClick={() => setConfirmDeact(true)}
              sx={{ textTransform: 'none', borderRadius: '8px', fontSize: 13 }}
            >
              Deactivate Organizer
            </Button>
          ) : (
            <Button
              size="small"
              color="success"
              variant="outlined"
              disabled={busy}
              onClick={() =>
                runChange(
                  () => organizersApi.approve(id),
                  'Organizer activated. Their events are visible again.',
                  'Activation failed.',
                )
              }
              sx={{ textTransform: 'none', borderRadius: '8px', fontSize: 13 }}
            >
              {busy ? 'Working…' : 'Activate Organizer'}
            </Button>
          )}
        </Box>
      </Box>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError('')}>
          {actionError}
        </Alert>
      )}

      {/* ── Section 1: Organizer Details ───────────────────────────────── */}
      <Box
        sx={{
          bgcolor: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 3,
          p: { xs: 2.5, md: 3 },
          mb: 2.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, flexWrap: 'wrap' }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: BLUE, fontSize: 22, fontWeight: 800 }}>
            {organizer.name?.charAt(0)?.toUpperCase() || 'O'}
          </Avatar>
          <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: 20,
                color: INK,
                letterSpacing: '-0.03em',
                lineHeight: 1.2,
              }}
            >
              {organizer.name}
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: LABEL_COLOR, mt: 0.25 }}>
              {organizer.email || organizer.user?.email || '—'}
            </Typography>
          </Box>
          <OrganizerStatusChip organizer={organizer} />
        </Box>

        <SectionHeading
          icon={<GroupsOutlined sx={{ fontSize: 19 }} />}
          title="Organizer Details"
        />
        <Box
          sx={{
            bgcolor: '#F6F8FB',
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 2,
            px: 2.5,
            py: 0.5,
          }}
        >
          <InfoRow label="Name" value={organizer.name} />
          <InfoRow label="Email" value={organizer.email || organizer.user?.email || '—'} />
          <InfoRow label="Phone" value={organizer.phone || '—'} />
          <InfoRow label="UPI ID" value={organizer.upiId || '—'} />
          <InfoRow
            label="Status"
            value={
              active
                ? 'Active'
                : `Inactive${organizer.isActive === false ? ' · events hidden' : ''}`
            }
          />
          {organizer.description && (
            <InfoRow label="About" value={organizer.description} />
          )}
        </Box>
      </Box>

      {/* ── Section 5 (top): Summary stats ─────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<EventOutlined sx={{ fontSize: 21 }} />}
            label="Total Events"
            value={totalEvents}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<CalendarMonthOutlined sx={{ fontSize: 21 }} />}
            label="Upcoming Events"
            value={upcomingEvents}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<CheckCircleOutlined sx={{ fontSize: 21 }} />}
            label="Completed Events"
            value={completedEvents}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<GroupsOutlined sx={{ fontSize: 21 }} />}
            label="Total Registrations"
            value={totalRegistrations}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<PaymentsOutlined sx={{ fontSize: 21 }} />}
            label="Total Revenue"
            value={formatPaise(totalRevenuePaise)}
            sub="PAID payments only"
          />
        </Grid>
      </Grid>

      {/* ── Section 2: Events ───────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 3,
          p: { xs: 2.5, md: 3 },
          mb: 2.5,
        }}
      >
        <SectionHeading
          icon={<CalendarMonthOutlined sx={{ fontSize: 19 }} />}
          title={`Events (${totalEvents})`}
        />
        {events.length === 0 ? (
          <EmptyState
            icon={CalendarMonthOutlined}
            title="No events yet"
            description="This organizer has not created any events yet."
          />
        ) : (
          <TableContainer
            sx={{ border: `1px solid #EEF1F7`, borderRadius: 2, overflowX: 'auto' }}
          >
            <Table size="small" sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: '#F4F7FF',
                    '& .MuiTableCell-head': { borderBottom: '1px solid #EEF1F7' },
                  }}
                >
                  {['Event', 'Date', 'Status', 'Slots', 'Registrations', 'Revenue'].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 12, fontWeight: 600, color: LABEL_COLOR }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map((ev: OrganizerOverviewEvent) => (
                  <TableRow
                    key={ev.id}
                    sx={{
                      '& .MuiTableCell-body': {
                        fontSize: 13,
                        borderBottom: '1px solid #F2F4F8',
                        color: INK,
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 600, maxWidth: 220 }}>
                      <Typography noWrap sx={{ fontSize: 13, fontWeight: 600 }}>
                        {ev.eventName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: LABEL_COLOR }}>
                      {formatEventDate(ev.date)}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={ev.status}
                          size="small"
                          variant="outlined"
                          color={ev.status === 'PUBLISHED' ? 'success' : 'default'}
                          sx={{ fontSize: 11 }}
                        />
                        {ev.isActive === false && (
                          <Chip label="Hidden" size="small" color="warning" sx={{ fontSize: 11 }} />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: LABEL_COLOR }}>{ev.slots}</TableCell>
                    <TableCell>{ev.registrationCount}</TableCell>
                    <TableCell>
                      {ev.paymentRequired
                        ? formatPaise(ev.revenuePaise)
                        : <Typography sx={{ fontSize: 12, color: LABEL_COLOR }}>Free</Typography>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* ── Section 3: Registrations per event ─────────────────────────── */}
      <Box
        sx={{
          bgcolor: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 3,
          p: { xs: 2.5, md: 3 },
          mb: 2.5,
        }}
      >
        <SectionHeading
          icon={<GroupsOutlined sx={{ fontSize: 19 }} />}
          title={`Registrations (${totalRegistrations} total)`}
        />
        {totalRegistrations === 0 ? (
          <EmptyState
            icon={GroupsOutlined}
            title="No registrations yet"
            description="No participants have registered for this organizer's events."
          />
        ) : (
          <Box>
            {events
              .filter((e: OrganizerOverviewEvent) => e.registrationCount > 0)
              .map((ev: OrganizerOverviewEvent) => (
                <Box
                  key={ev.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.25,
                    borderBottom: `1px solid ${CARD_BORDER}`,
                    '&:last-child': { borderBottom: 'none' },
                  }}
                >
                  <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600, color: INK }}>
                      {ev.eventName}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: LABEL_COLOR }}>
                      {formatEventDate(ev.date)}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: '#EAF1FF',
                      color: BLUE,
                      borderRadius: 2,
                      px: 1.5,
                      py: 0.5,
                      fontWeight: 700,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {ev.registrationCount} registered
                  </Box>
                </Box>
              ))}
            {events.every((e: OrganizerOverviewEvent) => e.registrationCount === 0) && (
              <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>
                All events have 0 registrations.
              </Typography>
            )}
          </Box>
        )}
      </Box>

      {/* ── Section 4: Revenue ──────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: 3,
          p: { xs: 2.5, md: 3 },
          mb: 2.5,
        }}
      >
        <SectionHeading
          icon={<PaymentsOutlined sx={{ fontSize: 19 }} />}
          title="Revenue"
        />
        <Box
          sx={{
            bgcolor: '#EAF1FF',
            borderRadius: 2.5,
            px: 3,
            py: 2,
            mb: 2.5,
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: 1,
          }}
        >
          <Typography
            sx={{ fontSize: 28, fontWeight: 800, color: BLUE, letterSpacing: '-0.03em' }}
          >
            {formatPaise(totalRevenuePaise)}
          </Typography>
          <Typography sx={{ fontSize: 13, color: LABEL_COLOR }}>
            total collected (PAID payments only)
          </Typography>
        </Box>

        {paidEvents.length === 0 ? (
          <Box>
            <Typography sx={{ fontSize: 13.5, color: LABEL_COLOR }}>
              {events.length === 0
                ? 'No events yet.'
                : 'All events are free — no revenue to display.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Divider sx={{ mb: 2 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: LABEL_COLOR, mb: 1.5 }}>
              Revenue by paid event
            </Typography>
            {paidEvents.map((ev: OrganizerOverviewEvent) => (
              <Box
                key={ev.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  py: 1.25,
                  borderBottom: `1px solid ${CARD_BORDER}`,
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ flex: '1 1 180px', minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: 13.5, fontWeight: 600, color: INK }}>
                    {ev.eventName}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: LABEL_COLOR }}>
                    {ev.registrationCount} registrations · {formatEventDate(ev.date)}
                  </Typography>
                </Box>
                <Typography
                  sx={{ fontSize: 14, fontWeight: 700, color: BLUE, flexShrink: 0 }}
                >
                  {formatPaise(ev.revenuePaise)}
                </Typography>
              </Box>
            ))}
            {freeEvents.length > 0 && (
              <Typography sx={{ fontSize: 12, color: LABEL_COLOR, mt: 1.5 }}>
                {freeEvents.length} free event{freeEvents.length > 1 ? 's' : ''} not shown (₹0 revenue).
              </Typography>
            )}
          </>
        )}
      </Box>

      <ConfirmDialog
        open={confirmDeact}
        title="Deactivate organizer?"
        description="The organizer will lose access and their events will be hidden from participants until reactivation. Event history and data are preserved."
        confirmLabel="Deactivate"
        busy={busy}
        onCancel={() => setConfirmDeact(false)}
        onConfirm={() => {
          setConfirmDeact(false);
          runChange(
            () => organizersApi.deactivate(id),
            'Organizer deactivated. Their events are now hidden.',
            'Deactivation failed.',
          );
        }}
      />
    </Box>
  );
}

// ─── Page shell ────────────────────────────────────────────────────────────────
export default function AdminOrganizerDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AdminShell title="Organizer Overview" subtitle="Events, registrations, and revenue.">
      {id ? <OverviewContent id={id} /> : <Alert severity="error">No organizer ID in URL.</Alert>}
    </AdminShell>
  );
}
