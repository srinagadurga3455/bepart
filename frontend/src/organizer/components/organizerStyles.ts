import type { SxProps, Theme } from '@mui/material';

// Shared visual language for the Organizer Console (styling only).
// Mirrors the Organizer Dashboard reference: white cards, subtle borders,
// 12px radii, blue accents on a very light gray page. No business logic here.

export const orgCardSx: SxProps<Theme> = {
  bgcolor: '#FFFFFF',
  border: '1px solid #ECEEF4',
  borderRadius: '12px',
};

export const orgPageTitleSx: SxProps<Theme> = {
  fontSize: 22,
  fontWeight: 800,
  letterSpacing: '-0.02em',
  color: '#101828',
};

export const orgPageSubtitleSx: SxProps<Theme> = {
  fontSize: 13,
  color: '#667085',
};

export const orgSectionTitleSx: SxProps<Theme> = {
  fontSize: 14.5,
  fontWeight: 800,
  color: '#101828',
};

export const orgPrimaryButtonSx: SxProps<Theme> = {
  borderRadius: '9px',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  px: 2,
  py: 1,
};

export const orgSmallButtonSx: SxProps<Theme> = {
  fontSize: 12,
  textTransform: 'none',
  borderRadius: '7px',
};

export const orgTableContainerSx: SxProps<Theme> = {
  overflowX: 'auto',
  border: '1px solid #EEF1F7',
  borderRadius: '10px',
};

export const orgTableHeadRowSx: SxProps<Theme> = {
  bgcolor: '#F4F7FF',
  '& .MuiTableCell-head': { borderBottom: '1px solid #EEF1F7' },
};

export const orgTableHeadCellSx: SxProps<Theme> = {
  fontSize: 12,
  fontWeight: 600,
  color: '#667085',
};

export const orgTableBodyCellSx: SxProps<Theme> = {
  fontSize: 13,
  borderBottom: '1px solid #F2F4F8',
};

export const orgSearchFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: 13,
    bgcolor: '#FFFFFF',
    '& fieldset': { borderColor: '#E6EAF2' },
  },
};

export const orgFormFieldSx: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: 13.5,
    bgcolor: '#FFFFFF',
  },
};
