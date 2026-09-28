import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Breadcrumbs, Container, Link as MuiLink, Typography } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';
import { BEPART_SUPPORT } from '../../app/config/support';
import { usePageMeta } from '../../app/utils/pageMeta';

export const LEGAL_UPDATED = 'September 2026';

// One shared layout for every public legal/information page (privacy, terms,
// refunds, contact, ticketing). Keeps typography, spacing and navigation
// identical — do not build one-off page shells.
export function LegalHero({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <Box sx={{ bgcolor: '#0F1F5B', color: '#fff' }}>
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 7 } }}>
        <Typography sx={{ color: '#9DB4FF', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.16em' }}>
          {eyebrow}
        </Typography>
        <Typography component="h1" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 28, md: 40 }, letterSpacing: '-0.04em', lineHeight: 1.12, mt: 1.5 }}>
          {title}
        </Typography>
        <Typography sx={{ opacity: 0.85, fontSize: 15, lineHeight: 1.7, mt: 1.5, maxWidth: 640 }}>
          {intro}
        </Typography>
        <Typography sx={{ opacity: 0.65, fontSize: 12.5, mt: 2 }}>
          Last updated: {LEGAL_UPDATED}
        </Typography>
      </Container>
    </Box>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mb: 3.5 }}>
      <Typography component="h2" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: 18, md: 20 }, letterSpacing: '-0.02em', mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ color: 'text.secondary', fontSize: 14.5, lineHeight: 1.75, '& ul': { pl: 2.5, m: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }, '& p': { m: 0, mb: 1 } }}>
        {children}
      </Box>
    </Box>
  );
}

// Clearly-marked placeholder for a legal/business detail the owner must fill
// in. Never invent company registration data, addresses or guarantees.
export function TodoPlaceholder({ label }: { label: string }) {
  return (
    <Alert severity="warning" sx={{ my: 1.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>[PLACEHOLDER — owner to replace]</Typography>
      <Typography variant="body2">{label}</Typography>
    </Alert>
  );
}

export function SupportCallout() {
  return (
    <Alert severity="info" sx={{ mt: 3 }}>
      Questions about this page? Contact the BePart team at{' '}
      <MuiLink href={`mailto:${BEPART_SUPPORT.email}`} sx={{ fontWeight: 700 }}>{BEPART_SUPPORT.email}</MuiLink>
      {' '}or {BEPART_SUPPORT.phone} ({BEPART_SUPPORT.hours}).
    </Alert>
  );
}

export default function LegalLayout({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  usePageMeta(title, intro);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#F7F7F4' }}>
      <Navbar />
      <LegalHero eyebrow={eyebrow} title={title} intro={intro} />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
          <Breadcrumbs sx={{ mb: 2.5, fontSize: 13 }}>
            <MuiLink component={RouterLink} to="/" underline="hover" color="inherit">Home</MuiLink>
            <Typography color="text.primary" sx={{ fontSize: 13 }}>{title}</Typography>
          </Breadcrumbs>
          <Box sx={{ bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 2.5, md: 4 } }}>
            {children}
            <SupportCallout />
          </Box>
        </Container>
      </Box>
      <Footer />
    </Box>
  );
}
