import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Navbar() {
  const navigate = useNavigate();

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 76 }, justifyContent: 'space-between' }}>
          <Box
            onClick={() => navigate('/')}
            sx={{ display: 'flex', alignItems: 'center', gap: 1.25, cursor: 'pointer' }}
          >
            <Box
              sx={{
                width: 30,
                height: 30,
                borderRadius: '10px',
                bgcolor: 'text.primary',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: 15,
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.08em',
                }}
              >
                b.
              </Typography>
            </Box>
            <Typography
              sx={{
                fontFamily: 'Manrope, sans-serif',
                fontSize: { xs: 19, md: 21 },
                fontWeight: 800,
                letterSpacing: '-0.06em',
              }}
            >
              BePart
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="text"
              onClick={() => navigate('/login')}
              sx={{ color: 'text.primary', fontSize: 13.5, px: 2 }}
            >
              Login
            </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/events')}
            sx={{
              bgcolor: 'text.primary',
              color: '#fff',
              px: 2.5,
              py: 0.85,
              fontSize: 13.5,
              borderColor: 'text.primary',
              boxShadow: 'none',
              '&:hover': {
                bgcolor: 'primary.main',
                borderColor: 'primary.main',
                boxShadow: 'none',
              },
            }}
          >
            Get Started
          </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}

export default Navbar;