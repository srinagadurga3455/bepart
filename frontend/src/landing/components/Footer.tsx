import { Box, Container, Divider, Stack, Typography } from '@mui/material';
import { Facebook, Instagram, X } from '@mui/icons-material';

const links = ['Terms', 'Contact', 'Help'];
const socials = [
  { label: 'Facebook', icon: Facebook },
  { label: 'Instagram', icon: Instagram },
  { label: 'X', icon: X },
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box
              sx={{
                width: 26,
                height: 26,
                borderRadius: '9px',
                bgcolor: 'text.primary',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Typography
                sx={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: 13,
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
                fontSize: 18,
                fontWeight: 800,
                letterSpacing: '-0.06em',
              }}
            >
              BePart
            </Typography>
          </Box>

          <Stack direction="row" spacing={{ xs: 3, md: 4 }} sx={{ alignItems: 'center' }}>
            <Stack direction="row" spacing={{ xs: 2.5, md: 3.5 }}>
              {links.map((link) => (
                <Typography
                  key={link}
                  sx={{
                    color: 'text.secondary',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main' },
                  }}
                >
                  {link}
                </Typography>
              ))}
            </Stack>

            <Divider orientation="vertical" flexItem sx={{ height: 18, alignSelf: 'center' }} />

            <Stack direction="row" spacing={1.5}>
              {socials.map(({ label, icon: Icon }) => (
                <Box
                  key={label}
                  aria-label={label}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'text.secondary',
                    cursor: 'pointer',
                    '&:hover': { color: 'primary.main', borderColor: 'primary.main' },
                  }}
                >
                  <Icon sx={{ fontSize: 16 }} />
                </Box>
              ))}
            </Stack>
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