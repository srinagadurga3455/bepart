import { Box, Typography } from '@mui/material';
import { BEPART_BRAND } from '../config/support';

const BLUE = '#2557F5';
const INK = '#101828';

// The one BePart logo mark used across the whole app (navbars, shells, auth,
// landing, tickets). Do not create local copies.
export function BePartMark({ size = 34, fontSize = 21 }: { size?: number; fontSize?: number }) {
  const accent = BLUE;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '50%',
          bgcolor: accent,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Typography
          sx={{ fontFamily: 'Manrope, sans-serif', fontSize: size * 0.56, fontWeight: 800, lineHeight: 1 }}
        >
          B
        </Typography>
      </Box>
      <Typography
        sx={{
          fontFamily: 'Manrope, sans-serif',
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.05em',
          color: INK,
        }}
      >
        {BEPART_BRAND.name}
      </Typography>
    </Box>
  );
}
