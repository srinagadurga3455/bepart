import { useState } from 'react';
import { AppBar, Box, Button, Container, IconButton, Menu, MenuItem, Toolbar } from '@mui/material';
import { Menu as MenuIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { BePartMark } from '../../app/components/BePartBrand';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Explore Events', to: '/events' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'For Organizers', href: '/#organizers' },
  { label: 'FAQ', href: '/#faq' },
];

// Single public navbar for the whole landing site. Anchor links use plain
// hrefs so they work from any route; page links use router navigation.
function Navbar() {
  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const go = (link: { label: string; to?: string; href?: string }) => {
    setMenuAnchor(null);
    if (link.to) {
      navigate(link.to);
      return;
    }
    if (link.href?.startsWith('/#')) {
      const id = link.href.slice(2);
      if (window.location.pathname === '/') {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.location.href = link.href ?? '/';
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: '#FFFFFF', borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ minHeight: { xs: 64, md: 76 }, justifyContent: 'space-between' }}>
          <Box onClick={() => navigate('/')} sx={{ cursor: 'pointer' }} role="link" aria-label="BePart home">
            <BePartMark size={30} fontSize={19} />
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
            {NAV_LINKS.map((link) => (
              <Button
                key={link.label}
                variant="text"
                onClick={() => go(link)}
                sx={{ color: 'text.primary', fontSize: 13.5, px: 1.75 }}
              >
                {link.label}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="text"
              onClick={() => navigate('/login')}
              sx={{ color: 'text.primary', fontSize: 13.5, px: 2, display: { xs: 'none', sm: 'inline-flex' } }}
            >
              Login
            </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/login')}
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
            <IconButton
              aria-label="Open navigation menu"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ display: { xs: 'inline-flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </Container>
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {NAV_LINKS.map((link) => (
          <MenuItem key={link.label} onClick={() => go(link)} sx={{ fontSize: 14 }}>
            {link.label}
          </MenuItem>
        ))}
        <MenuItem onClick={() => { setMenuAnchor(null); navigate('/login'); }} sx={{ fontSize: 14 }}>
          Login
        </MenuItem>
      </Menu>
    </AppBar>
  );
}

export default Navbar;
