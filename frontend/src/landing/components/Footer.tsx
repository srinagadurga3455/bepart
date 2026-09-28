import { Box, Container, Divider, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { BePartMark } from '../../app/components/BePartBrand';
import { BEPART_SUPPORT } from '../../app/config/support';

const links = [
  { label: 'Events', to: '/events' },
  { label: 'How ticketing works', to: '/ticketing' },
  { label: 'Support & FAQ', to: '/support' },
  { label: 'Contact Us', to: '/contact' },
];

const legalLinks = [
  { label: 'Privacy Policy', to: '/privacy-policy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Refund Policy', to: '/refund-policy' },
];

function Footer() {
  return (
    <Box component="footer" sx={{ bgcolor: '#FFFFFF', borderTop: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 5 } }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={{ xs: 3, md: 0 }}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <BePartMark size={26} fontSize={18} />

          <Stack direction="row" spacing={{ xs: 2, md: 2.5 }} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {links.map((link) => (
              <Typography
                key={link.label}
                component={RouterLink}
                to={link.to}
                sx={{
                  color: 'text.secondary',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {link.label}
              </Typography>
            ))}
          </Stack>

          <Stack direction="row" spacing={{ xs: 2, md: 2.5 }} sx={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            {legalLinks.map((link) => (
              <Typography
                key={link.label}
                component={RouterLink}
                to={link.to}
                sx={{
                  color: 'text.secondary',
                  fontSize: 14,
                  fontWeight: 500,
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                {link.label}
              </Typography>
            ))}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} sx={{ alignItems: 'center' }}>
            <MuiLink href={`mailto:${BEPART_SUPPORT.email}`} sx={{ fontSize: 13.5, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
              {BEPART_SUPPORT.email}
            </MuiLink>
            <MuiLink href={BEPART_SUPPORT.phoneHref} sx={{ fontSize: 13.5, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
              {BEPART_SUPPORT.phone}
            </MuiLink>
          </Stack>
        </Stack>

        <Divider sx={{ my: { xs: 3, md: 4 } }} />

        <Typography align="center" sx={{ color: 'text.secondary', fontSize: 13 }}>
          © 2026 BePart. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
}

export default Footer;
