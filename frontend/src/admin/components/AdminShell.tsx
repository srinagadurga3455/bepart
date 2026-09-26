import type { ReactNode } from 'react';
import { Avatar, Box, Typography } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  GridViewOutlined,
  GroupsOutlined,
  LogoutOutlined,
  SettingsOutlined,
} from '@mui/icons-material';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../auth/api/auth';
import { logout } from '../../auth/components/RequireRole';
import { adminNav } from '../routes';

// Sidebar application shell for the Admin Console.
// Visual-only chrome: navigation + current admin identity + logout.
// All data/actions live in the pages; this file owns no feature logic.

const NAV_ICONS: Record<string, ReactNode> = {
  '/admin': <GridViewOutlined sx={{ fontSize: 18 }} />,
  '/admin/organizers': <GroupsOutlined sx={{ fontSize: 18 }} />,
  '/admin/withdrawals': <AccountBalanceWalletOutlined sx={{ fontSize: 18 }} />,
  '/admin/account': <SettingsOutlined sx={{ fontSize: 18 }} />,
};

function isNavActive(pathname: string, to: string, end?: boolean): boolean {
  if (to === '/admin') {
    return pathname === '/admin' || pathname === '/admin/dashboard';
  }
  if (end) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function initials(name: string | undefined, email: string | undefined): string {
  const src = (name || '').trim();
  if (src) {
    const parts = src.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return src.slice(0, 2).toUpperCase();
  }
  return (email || 'AD').slice(0, 2).toUpperCase();
}

interface AdminShellProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AdminShell({ title, subtitle, children }: AdminShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: meRes } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => authApi.me() });
  const me = meRes?.data;
  const displayName = me?.name || me?.email || 'Admin';

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F6F8FB' }}>
      {/* LEFT SIDEBAR */}
      <Box
        component="aside"
        sx={{
          width: { xs: 68, sm: 216 },
          flexShrink: 0,
          bgcolor: '#FFFFFF',
          borderRight: '1px solid #ECEEF4',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1.25, sm: 2 },
          py: 2,
        }}
      >
        {/* Logo */}
        <Box
          onClick={() => navigate('/admin')}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer', px: { xs: 0.5, sm: 1 }, mb: 2.5 }}
        >
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              bgcolor: '#2557F5',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: 16, fontWeight: 800, lineHeight: 1 }}>
              B
            </Typography>
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1.2 }}>
            <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>
              BePart
            </Typography>
            <Typography sx={{ fontSize: 11, color: '#98A2B3' }}>
              Admin Console
            </Typography>
          </Box>
        </Box>

        {/* Nav */}
        <Box component="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {adminNav.map((item) => {
            const active = isNavActive(location.pathname, item.to, item.end);
            return (
              <Box
                key={item.to}
                component={NavLink}
                to={item.to}
                end={item.to === '/admin' ? false : item.end}
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
                {NAV_ICONS[item.to] || <GridViewOutlined sx={{ fontSize: 18 }} />}
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {item.label}
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* Bottom admin identity + logout */}
        <Box sx={{ borderTop: '1px solid #F0F2F7', pt: 1.75, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: { xs: 0, sm: 1 }, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#2557F5', fontSize: 12.5, fontWeight: 700 }}>
              {initials(me?.name, me?.email)}
            </Avatar>
            <Typography
              noWrap
              sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 13, fontWeight: 600, color: '#344054', maxWidth: 130 }}
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
                px: { xs: 0, sm: 1 },
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

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ width: '100%', maxWidth: 1060, px: { xs: 2, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
          {title && (
            <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: '#101828' }}>
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography sx={{ fontSize: 13.5, color: '#667085', mt: 0.25, mb: title ? 2.5 : 0 }}>
              {subtitle}
            </Typography>
          )}
          <Box sx={{ mt: title || subtitle ? 0 : 0 }}>
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
