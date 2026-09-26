import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Avatar, Box, Button, ClickAwayListener, InputAdornment, List, ListItemButton,
  TextField, Typography,
} from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  Add,
  CalendarMonthOutlined,
  GridViewOutlined,
  LogoutOutlined,
  PersonOutlined,
  Search,
} from '@mui/icons-material';
import { Link as RouterLink, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { eventsApi } from '../events/api/events';
import { useOrganizerIdentity } from './useOrganizerIdentity';
import { unwrapList } from '../../app/api/client';
import type { EventItem } from '../../app/types';
import { logout } from '../../auth/components/RequireRole';

// Sidebar shell for ALL Organizer Console pages (Dashboard, Events, Withdraw,
// Account, Event create/edit). Visual chrome only: same sidebar, page background,
// and header language everywhere. Page content and controls stay in the pages.

// Navigation mirrors organizerNav (src/organizer/events/pages/EventWizard.tsx)
// exactly — same labels and destinations, only restyled to the dashboard reference.
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/organizer', icon: <GridViewOutlined sx={{ fontSize: 18 }} /> },
  { label: 'My Events', to: '/organizer/events', icon: <CalendarMonthOutlined sx={{ fontSize: 18 }} /> },
  { label: 'Withdrawals', to: '/organizer/withdrawals', icon: <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} /> },
  { label: 'Account', to: '/organizer/account', icon: <PersonOutlined sx={{ fontSize: 18 }} /> },
];

function isNavActive(pathname: string, to: string): boolean {
  if (to === '/organizer') return pathname === '/organizer' || pathname === '/organizer/dashboard';
  return pathname === to || pathname.startsWith(`${to}/`);
}

function initials(name: string | undefined): string {
  const src = (name || '').trim();
  if (!src) return 'OR';
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  // Same query key/fn as the dashboard content: served from cache, no extra fetch.
  const { data: eventsRes } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const events: EventItem[] = unwrapList<EventItem>(eventsRes);
  const query = q.trim().toLowerCase();
  const matches = query
    ? events.filter((e) => (e.eventName || '').toLowerCase().includes(query)).slice(0, 6)
    : [];

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box sx={{ position: 'relative', width: { xs: '100%', sm: 340 } }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search events, registrations..."
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches.length > 0) {
              setOpen(false);
              navigate(`/organizer/events/${matches[0].id}`);
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 17, color: '#98A2B3' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '10px',
              fontSize: 13,
              bgcolor: '#FFFFFF',
              '& fieldset': { borderColor: '#E6EAF2' },
            },
          }}
        />
        {open && query && (
          <List
            sx={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 20,
              bgcolor: '#FFFFFF',
              border: '1px solid #ECEEF4',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(16,24,40,0.08)',
              py: 0.5,
              maxHeight: 260,
              overflow: 'auto',
            }}
          >
            {matches.length === 0 ? (
              <Typography sx={{ fontSize: 13, color: '#667085', px: 2, py: 1.25 }}>
                No matching events.
              </Typography>
            ) : (
              matches.map((e) => (
                <ListItemButton
                  key={e.id}
                  component={RouterLink}
                  to={`/organizer/events/${e.id}`}
                  onClick={() => setOpen(false)}
                  sx={{ fontSize: 13, py: 1 }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 600, color: '#101828' }}>
                      {e.eventName}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: '#98A2B3' }}>
                      {e.status}
                    </Typography>
                  </Box>
                </ListItemButton>
              ))
            )}
          </List>
        )}
      </Box>
    </ClickAwayListener>
  );
}

export default function OrganizerShell({
  children,
  title,
  subtitle,
  hideSearch,
  hideCreate,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  hideSearch?: boolean;
  hideCreate?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { organizer, user } = useOrganizerIdentity();
  const displayName = organizer?.name || user?.name || user?.email || 'Organizer';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F6F8FB' }}>
      {/* LEFT SIDEBAR */}
      <Box
        component="aside"
        sx={{
          width: { xs: 64, sm: 200 },
          flexShrink: 0,
          bgcolor: '#FFFFFF',
          borderRight: '1px solid #ECEEF4',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1, sm: 1.75 },
          py: 2,
        }}
      >
        <Box
          onClick={() => navigate('/organizer')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', px: { xs: 0.25, sm: 0.75 }, mb: 2.5, justifyContent: { xs: 'center', sm: 'flex-start' } }}
        >
          <Avatar sx={{ width: 30, height: 30, bgcolor: '#2557F5', fontSize: 14, fontWeight: 800 }}>
            B
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}>
            <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: '#101828' }}>
              BePart
            </Typography>
            <Typography sx={{ fontSize: 10.5, color: '#98A2B3' }}>
              organiser console
            </Typography>
          </Box>
        </Box>

        <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(location.pathname, item.to);
            return (
              <Box
                key={item.to}
                component={NavLink}
                to={item.to}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  px: { xs: 0, sm: 1.5 },
                  py: 1,
                  justifyContent: { xs: 'center', sm: 'flex-start' },
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: 13.5,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#2557F5' : '#667085',
                  bgcolor: active ? '#EAF1FF' : 'transparent',
                  '&:hover': { bgcolor: active ? '#EAF1FF' : '#F4F6FB' },
                }}
              >
                {item.icon}
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {item.label}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ borderTop: '1px solid #F0F2F7', pt: 1.75, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: { xs: 0, sm: 0.75 }, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
            <Avatar sx={{ width: 30, height: 30, bgcolor: '#2557F5', fontSize: 12, fontWeight: 700 }}>
              {initials(organizer?.name || user?.name)}
            </Avatar>
            <Typography
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 12.5, fontWeight: 600, color: '#344054', maxWidth: 120 }}
            >
              {displayName}
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={() => logout(navigate)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: '100%' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                px: { xs: 0, sm: 0.75 },
                py: 1,
                mt: 0.5,
                justifyContent: { xs: 'center', sm: 'flex-start' },
                borderRadius: '10px',
                fontSize: 13,
                fontWeight: 500,
                color: '#667085',
                '&:hover': { bgcolor: '#F4F6FB' },
              }}
            >
              <LogoutOutlined sx={{ fontSize: 17 }} />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Logout
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* MAIN */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: 1120, px: { xs: 2, md: 3.5 }, py: { xs: 2, md: 2.5 } }}>
          {(!hideSearch || !hideCreate) && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                flexWrap: 'wrap',
                mb: 2.5,
              }}
            >
              {!hideSearch && (
                <Box sx={{ flex: '1 1 220px', display: 'flex', justifyContent: { xs: 'stretch', sm: 'center' } }}>
                  <HeaderSearch />
                </Box>
              )}
              {!hideCreate && (
                <Button
                  variant="contained"
                  startIcon={<Add sx={{ fontSize: 17 }} />}
                  component={RouterLink}
                  to="/organizer/events/create"
                  sx={{ borderRadius: '9px', fontSize: 13, fontWeight: 700, textTransform: 'none', boxShadow: 'none', px: 2, py: 1 }}
                >
                  Create New Event
                </Button>
              )}
            </Box>
          )}
          {title && (
            <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#101828' }}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography sx={{ fontSize: 13, color: '#667085', mt: 0.25, mb: 2.5 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </Box>
      </Box>
    </Box>
  );
}
