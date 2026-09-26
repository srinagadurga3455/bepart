import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Card, CardContent, Chip, CircularProgress, Typography } from '@mui/material';
import { LogoutOutlined, PersonOutlined } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../../../auth/api/auth';
import AdminShell from '../../components/AdminShell';
import { logout } from '../../../auth/components/RequireRole';

const BLUE = '#2557F5';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

function roleLabel(role: string | undefined): string {
  if (role === 'ADMIN') return 'Administrator';
  if (role === 'ORGANIZER') return 'Organizer';
  return role || '—';
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ py: 1.5, borderBottom: '1px solid', borderColor: CARD_BORDER, '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ fontSize: 12, color: MUTED, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{value}</Typography>
    </Box>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, mt: 3, mb: 0.5 }}>
      {children.toUpperCase()}
    </Typography>
  );
}

export default function AdminAccountPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['auth', 'me'], queryFn: () => authApi.me() });
  const user = data?.data;

  return (
    <AdminShell title="Account" subtitle="Your admin profile and session.">
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px 1fr' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Left: account navigation */}
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: CARD_BORDER }}>
          <CardContent sx={{ p: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK, px: 1.5, pt: 0.5, pb: 1.5 }}>
              My Account
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                bgcolor: '#EAF1FF',
                color: BLUE,
              }}
            >
              <PersonOutlined sx={{ fontSize: 20 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Profile</Typography>
            </Box>
            <Box sx={{ mt: 6 }}>
              <Box
                component="button"
                onClick={() => logout(navigate)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  border: 'none',
                  bgcolor: 'transparent',
                  color: '#DC2626',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  '&:hover': { bgcolor: '#FEF2F2' },
                }}
              >
                <LogoutOutlined sx={{ fontSize: 20 }} />
                Logout
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Right: profile content */}
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: CARD_BORDER }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: INK, mb: 2.5 }}>
              Profile
            </Typography>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : error || !user ? (
              <Alert severity="error">Could not load account.</Alert>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2.5, borderBottom: '1px solid', borderColor: CARD_BORDER }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: BLUE, fontWeight: 800, fontSize: 26 }}>
                    {user.name?.charAt(0)?.toUpperCase() || 'A'}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: INK }}>
                      {user.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{roleLabel(user.role)}</Typography>
                  </Box>
                  <Chip label={user.role} size="small" variant="outlined" sx={{ ml: 'auto' }} />
                </Box>

                <SectionTitle>Account Details</SectionTitle>
                <FieldRow label="Email Address" value={user.email} />
                <FieldRow label="Phone Number" value={user.phone || '—'} />
                <FieldRow label="Status" value={user.isActive ? 'Active' : 'Inactive'} />

                <SectionTitle>Personal Details</SectionTitle>
                <FieldRow label="Full Name" value={user.name} />
                <FieldRow label="Role" value={roleLabel(user.role)} />
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </AdminShell>
  );
}
