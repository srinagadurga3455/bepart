import type { ReactNode } from 'react';
import { Box, CircularProgress, Grid, MenuItem, Select, Typography } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  CalendarMonthOutlined,
  CancelOutlined,
  CheckCircleOutlined,
  ConfirmationNumberOutlined,
  GroupsOutlined,
  HourglassEmptyOutlined,
  KeyboardArrowDown,
  PersonOutlined,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../../events/api/events';
import { registrationsApi } from '../../events/api/registrations';
import { unwrapList } from '../../../app/api/client';
import { formatINR } from '../../../app/utils/format';
import { financeByEvent } from '../../events/utils/eventData';
import type { EventItem, RegistrationItem } from '../../../app/types';
import OrganizerShell from '../../components/OrganizerShell';
import { useOrganizerIdentity } from '../../components/useOrganizerIdentity';

const CARD_SX = {
  bgcolor: '#FFFFFF',
  border: '1px solid #ECEEF4',
  borderRadius: '12px',
} as const;

function KpiCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <Box sx={{ ...CARD_SX, p: 2, display: 'flex', gap: 1.5, alignItems: 'flex-start', height: '100%' }}>
      <Box
        sx={{
          width: 42, height: 42, borderRadius: '50%', bgcolor: '#EAF1FF', color: '#2557F5',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 12, color: '#667085', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', color: '#101828', lineHeight: 1.3 }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#98A2B3', mt: 0.25 }}>{hint}</Typography>
      </Box>
    </Box>
  );
}

interface DayBucket {
  key: string;
  label: string;
  count: number;
}

function last7Days(registrations: RegistrationItem[]): DayBucket[] {
  const counts: Record<string, number> = {};
  registrations.forEach((r) => {
    const d = new Date(r.createdAt);
    if (isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const days: DayBucket[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    days.push({
      key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: counts[key] || 0,
    });
  }
  return days;
}

function TrendChart({ days }: { days: DayBucket[] }) {
  const W = 560;
  const H = 210;
  const PAD_L = 26;
  const PAD_B = 24;
  const PAD_T = 10;
  const maxVal = Math.max(5, ...days.map((d) => d.count));
  const step = Math.ceil(maxVal / 5);
  const top = step * 5;
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => i * step);
  const plotW = W - PAD_L - 8;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (plotW * i) / Math.max(1, days.length - 1);
  const y = (v: number) => PAD_T + plotH - (plotH * v) / top;
  const points = days.map((d, i) => `${x(i)},${y(d.count)}`).join(' ');
  const base = days.map((_, i) => `${x(i)},${y(0)}`).join(' ');

  return (
    <Box component="svg" viewBox={`0 0 ${W} ${H}`} sx={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD_L} x2={W - 4} y1={y(t)} y2={y(t)} stroke="#EEF1F7" strokeWidth={1} />
          <text x={PAD_L - 6} y={y(t) + 3.5} textAnchor="end" fontSize={9.5} fill="#98A2B3">{t}</text>
        </g>
      ))}
      {days.map((d, i) => (
        <text key={d.key} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9.5} fill="#98A2B3">{d.label}</text>
      ))}
      <polyline points={base} fill="none" stroke="#7C3AED" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={points} fill="none" stroke="#2557F5" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {days.map((d, i) => (
        <g key={`dot-${d.key}`}>
          <circle cx={x(i)} cy={y(0)} r={2.5} fill="#7C3AED" />
          {d.count > 0 && <circle cx={x(i)} cy={y(d.count)} r={2.5} fill="#2557F5" />}
        </g>
      ))}
    </Box>
  );
}

const DONUT_COLORS = ['#2557F5', '#7C3AED', '#60A5FA', '#A78BFA', '#34D399', '#F59E0B', '#EF4444', '#14B8A6'];

function ByEventDonut({ events, regCountByEvent }: { events: EventItem[]; regCountByEvent: Record<number, number> }) {
  const R = 62;
  const C = 2 * Math.PI * R;
  const total = events.reduce((s, e) => s + (regCountByEvent[e.id] || 0), 0);
  const fracs = events.map((e) => (total > 0 ? (regCountByEvent[e.id] || 0) / total : 0));
  const arcs = events
    .map((e, i) => {
      const start = fracs.slice(0, i).reduce((s, f) => s + f, 0);
      return {
        color: DONUT_COLORS[i % DONUT_COLORS.length],
        dash: fracs[i] * C,
        offset: -start * C,
        key: e.id,
      };
    })
    .filter((a) => a.dash > 0);

  return (
    <Box sx={{ position: 'relative', width: 168, height: 168, mx: 'auto', my: 1 }}>
      <Box
        component="svg"
        viewBox="0 0 168 168"
        sx={{ width: '100%', height: '100%', display: 'block', transform: 'rotate(-90deg)' }}
      >
        <circle cx={84} cy={84} r={R} fill="none" stroke="#EEF1F7" strokeWidth={20} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            cx={84}
            cy={84}
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth={20}
            strokeDasharray={`${a.dash} ${C - a.dash}`}
            strokeDashoffset={a.offset}
            strokeLinecap="butt"
          />
        ))}
      </Box>
      <Box
        sx={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: 24, fontWeight: 800, color: '#101828', lineHeight: 1 }}>
          {events.length}
        </Typography>
        <Typography sx={{ fontSize: 11, color: '#98A2B3', mt: 0.5 }}>Total Events</Typography>
      </Box>
    </Box>
  );
}

interface LifecycleRow {
  name: string;
  count: number;
  description: string;
  icon: ReactNode;
}

function LifecycleCard({ rows }: { rows: LifecycleRow[] }) {
  return (
    <Box sx={{ ...CARD_SX, p: 2.25, height: '100%' }}>
      <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: '#101828' }}>
        Event Lifecycle
      </Typography>
      <Typography sx={{ fontSize: 12, color: '#667085', mb: 1.5 }}>
        {rows[0].count > 0 ? 'Track event progress' : 'No upcoming event'}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((row) => (
          <Box key={row.name} sx={{ display: 'flex', gap: 1.5, py: 1.1, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 15, height: 15, borderRadius: '50%', border: '1.5px solid #D9DEE8',
                mt: 0.6, flexShrink: 0,
              }}
            />
            <Box
              sx={{
                width: 32, height: 32, borderRadius: '50%', bgcolor: '#EAF1FF', color: '#2557F5',
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              {row.icon}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#101828' }}>
                {row.name}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#667085' }}>
                <Box component="span" sx={{ fontWeight: 800, color: '#101828' }}>{row.count}</Box>
                {'  '}{row.description}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function DashboardContent() {
  const { organizer, user } = useOrganizerIdentity();
  const { data: eventsRes, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const { data: regsRes, isLoading: regsLoading } = useQuery({
    queryKey: ['registrations', 'mine'], queryFn: () => registrationsApi.list(),
  });

  const name = organizer?.name || user?.name || user?.email || 'Organizer';
  const events: EventItem[] = unwrapList<EventItem>(eventsRes);
  const registrations: RegistrationItem[] = unwrapList<RegistrationItem>(regsRes);

  const regCountByEvent: Record<number, number> = {};
  registrations.forEach((r) => {
    regCountByEvent[r.eventId] = (regCountByEvent[r.eventId] || 0) + 1;
  });
  const finance = financeByEvent(events, registrations);
  const totalRevenue = Object.values(finance).reduce((s, f) => s + f.collected, 0);
  const published = events.filter((e) => e.status === 'PUBLISHED').length;
  const eventsWithRegs = events.filter((e) => (regCountByEvent[e.id] || 0) > 0).length;

  // Total Check-ins: the backend exposes no check-in field, so the real value is 0.
  const totalCheckins = 0;

  const days = last7Days(registrations);

  const lifecycle: LifecycleRow[] = [
    { name: 'Upcoming & Published', count: published, description: 'Events ready to go', icon: <CalendarMonthOutlined sx={{ fontSize: 17 }} /> },
    { name: 'In Progress', count: events.filter((e) => e.status === 'DRAFT').length, description: 'Events currently active', icon: <PersonOutlined sx={{ fontSize: 17 }} /> },
    { name: 'Approval Required', count: events.filter((e) => e.status === 'PREVIEW').length, description: 'Pending admin approval', icon: <HourglassEmptyOutlined sx={{ fontSize: 17 }} /> },
    { name: 'Ended', count: events.filter((e) => e.status === 'COMPLETED').length, description: 'Past events', icon: <CheckCircleOutlined sx={{ fontSize: 17 }} /> },
    { name: 'Cancelled', count: events.filter((e) => e.status === 'CANCELLED').length, description: 'Cancelled events', icon: <CancelOutlined sx={{ fontSize: 17 }} /> },
  ];

  if (eventsLoading || regsLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#101828' }}>
        Good Day, {name} 👋
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#667085', mb: 2.5 }}>
        Here&apos;s how your {name} events are performing across registrations, tickets, and revenue.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            icon={<CalendarMonthOutlined sx={{ fontSize: 21 }} />}
            label="Total Events"
            value={String(events.length)}
            hint={events.length === 0 ? 'No events created yet.' : `${published} published`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            icon={<GroupsOutlined sx={{ fontSize: 21 }} />}
            label="Total Registrations"
            value={String(registrations.length)}
            hint={registrations.length === 0 ? 'No registrations yet.' : `Across ${eventsWithRegs} event${eventsWithRegs === 1 ? '' : 's'}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            icon={<AccountBalanceWalletOutlined sx={{ fontSize: 21 }} />}
            label="Total Revenue"
            value={formatINR(totalRevenue)}
            hint={totalRevenue === 0 ? 'No revenue yet from events.' : `From ${registrations.length} registration${registrations.length === 1 ? '' : 's'}`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            icon={<ConfirmationNumberOutlined sx={{ fontSize: 21 }} />}
            label="Total Check-ins"
            value={String(totalCheckins)}
            hint="Check-ins tracking not available"
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Box sx={{ ...CARD_SX, p: 2.25, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
              <Box sx={{ mr: 'auto' }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: '#101828' }}>
                  Registration & Check-in Trend
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#667085' }}>
                  Daily visitor flow, check-ins and registrations.
                </Typography>
              </Box>
              <Select
                size="small"
                value="7d"
                IconComponent={KeyboardArrowDown}
                sx={{ fontSize: 12, borderRadius: '8px', '& .MuiOutlinedInput-input': { py: 0.75 } }}
              >
                <MenuItem value="7d" sx={{ fontSize: 12 }}>Last 7 days</MenuItem>
              </Select>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2557F5' }} />
                <Typography sx={{ fontSize: 11.5, color: '#667085' }}>Registrations ({registrations.length})</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7C3AED' }} />
                <Typography sx={{ fontSize: 11.5, color: '#667085' }}>Check-ins ({totalCheckins})</Typography>
              </Box>
            </Box>
            <TrendChart days={days} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Box sx={{ ...CARD_SX, p: 2.25, height: '100%' }}>
            <Typography sx={{ fontSize: 14.5, fontWeight: 800, color: '#101828' }}>
              By Event
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#667085' }}>
              {registrations.length} total registrations
            </Typography>
            <ByEventDonut events={events} regCountByEvent={regCountByEvent} />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 4 }}>
          <LifecycleCard rows={lifecycle} />
        </Grid>
      </Grid>
    </Box>
  );
}

export default function DashboardPage() {
  return (
    <OrganizerShell>
      <DashboardContent />
    </OrganizerShell>
  );
}
