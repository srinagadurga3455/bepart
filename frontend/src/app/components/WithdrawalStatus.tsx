import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import type { WithdrawalStatus } from '../types';

// Withdrawal status chip shared by the admin and organizer withdrawal
// features. Pure status → color mapping; owned by the app layer.

type ChipColor = NonNullable<ChipProps['color']>;

const STATUS_META: Record<string, { label: string; color: ChipColor }> = {
  REQUESTED: { label: 'Withdrawal Requested', color: 'warning' },
  PROCESSING: { label: 'Processing', color: 'info' },
  PAID: { label: 'Paid', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
};

export function withdrawalStatusMeta(status: string): { label: string; color: ChipColor } {
  return STATUS_META[status] || { label: status || '—', color: 'default' };
}

export default function WithdrawalStatusChip({ status }: { status: WithdrawalStatus | string }) {
  const meta = withdrawalStatusMeta(status);
  return <Chip label={meta.label} size="small" variant="outlined" color={meta.color} />;
}
