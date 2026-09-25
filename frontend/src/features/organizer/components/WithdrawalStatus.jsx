import { Chip } from '@mui/material';

const STATUS_META = {
  REQUESTED: { label: 'Withdrawal Requested', color: 'warning' },
  PROCESSING: { label: 'Processing', color: 'info' },
  PAID: { label: 'Paid', color: 'success' },
  REJECTED: { label: 'Rejected', color: 'error' },
};

export function withdrawalStatusMeta(status) {
  return STATUS_META[status] || { label: status || '—', color: 'default' };
}

export default function WithdrawalStatusChip({ status }) {
  const meta = withdrawalStatusMeta(status);
  return <Chip label={meta.label} size="small" variant="outlined" color={meta.color} />;
}
