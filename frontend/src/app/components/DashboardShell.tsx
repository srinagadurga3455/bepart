import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { NavLink, useNavigate } from 'react-router-dom';
import { logout } from './RequireRole';

function Logo({ onClick }) {
  return (
    <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }}>
      <Box
        sx={{
          width: 30, height: 30, borderRadius: '10px', bgcolor: 'text.primary', color: '#fff',
          display: 'grid', placeItems: 'center',
        }}
      >
        <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.08em' }}>
          b.
        </Typography>
      </Box>
      <Typography sx={{ fontFamily: 'Manrope, sans-serif', fontSize: 19, fontWeight: 800, letterSpacing: '-0.06em' }}>
        BePart
      </Typography>
    </Box>
  );
}

export function BrandLogo() {
  return <Logo />;
}

export default function DashboardShell({ title, navItems, children }) {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 64, justifyContent: 'space-between', gap: 2 }}>
            <Logo onClick={() => navigate('/')} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
              {navItems.map((item) => (
                <Button
                  key={item.to}
                  component={NavLink}
                  to={item.to}
                  end={item.end}
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 600,
                    fontSize: 14,
                    px: { xs: 1, sm: 2 },
                    '&.active': { color: 'primary.main', bgcolor: '#EDF2FF' },
                  }}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                variant="outlined"
                size="small"
                onClick={() => logout(navigate)}
                sx={{ ml: 1 }}
              >
                Logout
              </Button>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        {title && (
          <Typography
            variant="h4"
            gutterBottom
            sx={{ fontWeight: 800, letterSpacing: '-0.04em', mb: 3 }}
          >
            {title}
          </Typography>
        )}
        {children}
      </Container>
    </Box>
  );
}
