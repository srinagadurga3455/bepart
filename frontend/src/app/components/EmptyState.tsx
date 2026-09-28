import type { ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { InboxOutlined } from '@mui/icons-material';

interface EmptyStateProps {
  icon?: SvgIconComponent;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}

// Single consistent empty-state used by every list/table/page with zero records.
export default function EmptyState({
  icon: Icon = InboxOutlined,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  const action: ReactNode = actionLabel ? (
    actionHref ? (
      <Button variant="contained" href={actionHref} sx={{ borderRadius: 999, px: 3, boxShadow: 'none' }}>
        {actionLabel}
      </Button>
    ) : (
      <Button variant="contained" onClick={onAction} sx={{ borderRadius: 999, px: 3, boxShadow: 'none' }}>
        {actionLabel}
      </Button>
    )
  ) : null;

  return (
    <Box
      sx={{
        border: '1px dashed #D9E2FF',
        borderRadius: 3,
        bgcolor: '#F8FAFF',
        py: { xs: 5, md: 7 },
        px: 3,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 1.25,
      }}
    >
      <Box
        sx={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          bgcolor: '#EAF1FF',
          color: '#2557F5',
          display: 'grid',
          placeItems: 'center',
          mb: 0.5,
          boxShadow: '0 10px 24px -12px rgba(37, 87, 245, 0.5)',
        }}
      >
        <Icon sx={{ fontSize: 30 }} />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 16.5, color: '#101828' }}>{title}</Typography>
      {description && (
        <Typography sx={{ fontSize: 13.5, color: '#667085', maxWidth: 420 }}>{description}</Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}
