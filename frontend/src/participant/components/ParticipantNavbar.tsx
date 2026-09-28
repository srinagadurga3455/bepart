import { Avatar, Box, Button, CircularProgress, Container, TextField, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/components/RequireRole';
import { BePartMark } from '../../app/components/BePartBrand';

const MUTED = '#667085';
const INK = '#101828';
const CARD_BORDER = '#ECEEF4';
const BLUE = '#2557F5';

interface ParticipantNavbarProps {
  query?: string;
  onQuery?: (value: string) => void;
  onSearchSubmit?: () => void;
}

// Single public navbar for all participant pages (events, event detail,
// registration, ticket, dashboard, support). Search box is optional.
export default function ParticipantNavbar({ query, onQuery, onSearchSubmit }: ParticipantNavbarProps) {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const showSearch = onQuery !== undefined;

  const searchField = (mobile: boolean) => (
    <TextField
      value={query ?? ''}
      onChange={(e) => onQuery?.(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSearchSubmit?.();
      }}
      placeholder="Search for events, clubs, or keywords..."
      size="small"
      fullWidth
      slotProps={{
        input: {
          startAdornment: <Search sx={{ fontSize: 20, color: MUTED, mr: 1 }} />,
        },
      }}
      sx={
        mobile
          ? {
              display: { xs: 'flex', sm: 'none' },
              pb: 1.5,
              '& .MuiOutlinedInput-root': { borderRadius: 999, bgcolor: '#F5F7FF', fontSize: 14 },
            }
          : {
              maxWidth: 560,
              mx: 'auto',
              display: { xs: 'none', sm: 'flex' },
              '& .MuiOutlinedInput-root': { borderRadius: 999, bgcolor: '#F5F7FF', fontSize: 14 },
            }
      }
    />
  );

  return (
    <Box
      component="header"
      sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid', borderColor: CARD_BORDER, position: 'sticky', top: 0, zIndex: 10 }}
    >
      <Container maxWidth="lg">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 2 } }}>
          <Box onClick={() => navigate('/')} sx={{ cursor: 'pointer', flexShrink: 0 }} role="link" aria-label="BePart home">
            <BePartMark />
          </Box>

          {showSearch && searchField(false)}

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            <Button
              variant="text"
              onClick={() => navigate('/events')}
              sx={{ color: INK, fontSize: 13.5, display: { xs: 'none', md: 'inline-flex' } }}
            >
              Explore events
            </Button>
            <Button
              variant="text"
              onClick={() => navigate('/support')}
              sx={{ color: INK, fontSize: 13.5, display: { xs: 'none', md: 'inline-flex' } }}
            >
              Support
            </Button>
            {loading ? (
              <CircularProgress size={24} />
            ) : user ? (
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }}
                onClick={() => navigate(user.role === 'ADMIN' ? '/admin' : user.role === 'ORGANIZER' ? '/organizer' : '/dashboard')}
              >
                <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700, color: INK, lineHeight: 1.2 }}>
                    {user.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: MUTED, lineHeight: 1.2 }}>{user.role}</Typography>
                </Box>
                <Avatar sx={{ width: 38, height: 38, bgcolor: BLUE, fontWeight: 800 }}>
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
              </Box>
            ) : (
              <Button variant="contained" onClick={() => navigate('/login')} sx={{ borderRadius: 999, boxShadow: 'none', px: 3 }}>
                Login
              </Button>
            )}
          </Box>
        </Box>

        {showSearch && searchField(true)}
      </Container>
    </Box>
  );
}
