import { useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, FormControlLabel, InputLabel, MenuItem, Select, Switch, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Add, LocalOfferOutlined } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import OrganizerShell from '../../components/OrganizerShell';
import { eventsApi } from '../../events/api/events';
import { couponsApi } from '../api/coupons';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import { formatEventDate, formatINR } from '../../../app/utils/format';
import type { CouponDiscountType, CouponItem, EventItem } from '../../../app/types';
import { orgCardSx, orgPrimaryButtonSx, orgSectionTitleSx, orgSmallButtonSx } from '../../components/organizerStyles';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import EmptyState from '../../../app/components/EmptyState';
import { ErrorState, LoadingState } from '../../../app/components/Feedback';

function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function discountLabel(c: CouponItem): string {
  // API amounts are RUPEES (percentages are unit-free).
  return c.discountType === 'PERCENTAGE' ? `${c.discountValue}% off` : `${formatINR(c.discountValue)} off`;
}

interface CouponFormState {
  code: string;
  discountType: CouponDiscountType;
  discountValue: string;
  usageLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

function CouponDialog({
  open, initial, eventId, eventName, onClose, onSaved,
}: {
  open: boolean;
  initial?: CouponItem | null;
  eventId: string;
  eventName: string;
  onClose: () => void;
  onSaved: (eventId: string) => void;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<CouponFormState>({
    code: initial?.code || '',
    discountType: initial?.discountType || 'PERCENTAGE',
    discountValue: initial ? String(initial.discountValue) : '',
    usageLimit: initial?.usageLimit != null ? String(initial.usageLimit) : '',
    startsAt: toDateTimeLocal(initial?.startsAt),
    expiresAt: toDateTimeLocal(initial?.expiresAt),
    isActive: initial?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = !!initial;

  const submit = async (evId: string) => {
    setError('');
    // API speaks RUPEES (FIXED) or percent (PERCENTAGE); up to 2 decimals.
    const value = Number(form.discountValue);
    if (!Number.isFinite(value) || value < 0.01) { setError('Enter a valid discount value (min ₹0.01).'); return; }
    if (form.discountType === 'PERCENTAGE' && (!Number.isInteger(value) || value < 1 || value > 100)) { setError('Percentage discount must be a whole number between 1 and 100.'); return; }
    if (form.discountType === 'FIXED' && Math.round(value * 100) !== value * 100) { setError('Fixed discount supports at most 2 decimal places.'); return; }
    const usage = form.usageLimit.trim() ? parseInt(form.usageLimit, 10) : null;
    if (usage !== null && (!Number.isFinite(usage) || usage < 1)) { setError('Usage limit must be at least 1.'); return; }
    setBusy(true);
    try {
      if (isEdit && initial) {
        await couponsApi.update(evId, initial.id, {
          discountType: form.discountType,
          discountValue: value,
          usageLimit: usage,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          isActive: form.isActive,
        });
        enqueueSnackbar('Coupon updated successfully.', { variant: 'success' });
      } else {
        await couponsApi.create(evId, {
          code: form.code.trim() ? form.code.trim().toUpperCase() : undefined,
          discountType: form.discountType,
          discountValue: value,
          usageLimit: usage,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
          isActive: form.isActive,
        });
        enqueueSnackbar('Coupon created successfully.', { variant: 'success' });
      }
      onSaved(evId);
      onClose();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not save coupon.');
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm"
      sx={{ '& .MuiDialog-paper': { m: { xs: 1.5 }, borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Edit Coupon' : `New Coupon · ${eventName}`}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!isEdit && (
          <TextField label="Code (optional — auto-generated)" placeholder="e.g. AICLUB20" value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            fullWidth size="small" sx={{ mb: 2, mt: 0.5 }} helperText="3–32 chars: letters, digits, - or _" />
        )}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ flex: '1 1 160px' }}>
            <InputLabel>Type</InputLabel>
            <Select label="Type" value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as CouponDiscountType })}>
              <MenuItem value="PERCENTAGE">Percentage (%)</MenuItem>
              <MenuItem value="FIXED">Fixed amount (₹)</MenuItem>
            </Select>
          </FormControl>
          <TextField label={form.discountType === 'PERCENTAGE' ? 'Percent (1–100)' : 'Amount in rupees (₹)'}
            type="number" value={form.discountValue}
            onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            size="small" sx={{ flex: '1 1 160px' }} />
        </Box>
        <TextField label="Usage limit (optional)" type="number" value={form.usageLimit}
          onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
          fullWidth size="small" sx={{ mt: 2 }} helperText="Leave empty for single-use" />
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
          <TextField label="Starts at (optional)" type="datetime-local" value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 200px' }} />
          <TextField label="Expires at (optional)" type="datetime-local" value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 200px' }} />
        </Box>
        <FormControlLabel
          control={<Switch checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />}
          label="Active"
          sx={{ mt: 1.5 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={() => submit(eventId)} disabled={busy} sx={{ boxShadow: 'none' }}>
          {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Coupon'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CouponsContent() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [eventId, setEventId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CouponItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CouponItem | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: eventsRes, isLoading: eventsLoading, error: eventsError, refetch: refetchEvents } = useQuery({
    queryKey: ['events', 'my'], queryFn: () => eventsApi.listMy({ page: 1, limit: 50 }),
  });
  const events: EventItem[] = useMemo(() => unwrapList<EventItem>(eventsRes), [eventsRes]);
  const activeEventId = eventId || events[0]?.id || '';
  const activeEvent = events.find((e) => e.id === activeEventId);

  const { data: couponsRes, isLoading: couponsLoading, error: couponsError, refetch } = useQuery({
    queryKey: ['coupons', activeEventId],
    queryFn: () => couponsApi.listForEvent(activeEventId),
    enabled: !!activeEventId,
  });
  const coupons: CouponItem[] = useMemo(() => (couponsRes ? unwrapList<CouponItem>(couponsRes) : []), [couponsRes]);

  const refresh = (evId: string) => {
    queryClient.invalidateQueries({ queryKey: ['coupons', evId] });
    refetch();
  };

  const toggleActive = async (c: CouponItem) => {
    setBusy(true);
    try {
      await couponsApi.update(activeEventId, c.id, { isActive: !c.isActive });
      enqueueSnackbar(c.isActive ? 'Coupon deactivated.' : 'Coupon activated.', { variant: 'success' });
      refresh(activeEventId);
    } catch (err) {
      enqueueSnackbar(apiErrorMessage(err, 'Could not update coupon.'), { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (eventsLoading) return <LoadingState message="Loading events…" />;
  if (eventsError) return <ErrorState message="Could not load your events." onRetry={() => refetchEvents()} />;
  if (events.length === 0) {
    return (
      <EmptyState
        icon={LocalOfferOutlined}
        title="No events yet"
        description="Create an event first, then add discount coupons for it."
        actionLabel="Create Event"
        actionHref="/organizer/events/create"
      />
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 260 }, bgcolor: '#fff', borderRadius: 2 }}>
          <InputLabel>Event</InputLabel>
          <Select label="Event" value={activeEventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <MenuItem key={e.id} value={e.id}>{e.eventName}</MenuItem>)}
          </Select>
        </FormControl>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setEditTarget(null); setDialogOpen(true); }}
          sx={{ ...orgPrimaryButtonSx, ml: { sm: 'auto' } }} disabled={!activeEventId}>
          New Coupon
        </Button>
      </Box>

      <Card variant="outlined" sx={{ ...orgCardSx }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography sx={{ ...orgSectionTitleSx }} gutterBottom>
            Coupons · {activeEvent?.eventName}
          </Typography>
          {couponsLoading ? (
            <LoadingState message="Loading coupons…" />
          ) : couponsError ? (
            <ErrorState message="Could not load coupons." onRetry={() => refetch()} />
          ) : coupons.length === 0 ? (
            <EmptyState
              icon={LocalOfferOutlined}
              title="No coupons for this event"
              description="Create a percentage or fixed-amount coupon. Participants apply it during payment."
              actionLabel="Create Coupon"
              onAction={() => { setEditTarget(null); setDialogOpen(true); }}
            />
          ) : (
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Discount</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Usage</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Expires</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {coupons.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell sx={{ fontWeight: 700 }}>{c.code}</TableCell>
                      <TableCell>{discountLabel(c)}</TableCell>
                      <TableCell>{c.usedCount ?? 0}{c.usageLimit ? ` / ${c.usageLimit}` : ' (single-use)'}</TableCell>
                      <TableCell>{c.expiresAt ? formatEventDate(c.expiresAt) : '—'}</TableCell>
                      <TableCell>
                        <Chip label={c.isActive ? 'Active' : 'Inactive'} size="small" color={c.isActive ? 'success' : 'default'} variant={c.isActive ? 'filled' : 'outlined'} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                          <Button size="small" variant="outlined" onClick={() => { setEditTarget(c); setDialogOpen(true); }} sx={{ ...orgSmallButtonSx }}>
                            Edit
                          </Button>
                          <Button size="small" variant="outlined" disabled={busy} onClick={() => toggleActive(c)} sx={{ ...orgSmallButtonSx }}>
                            {c.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button size="small" color="error" disabled={busy} onClick={() => setDeleteTarget(c)}>
                            Delete
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {dialogOpen && (
        <CouponDialog
          open
          initial={editTarget}
          eventId={activeEventId}
          eventName={activeEvent?.eventName || ''}
          onClose={() => { setDialogOpen(false); setEditTarget(null); }}
          onSaved={refresh}
        />
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Coupon?"
        description={`Delete coupon ${deleteTarget?.code}? Past registrations keep their price snapshot. This cannot be undone.`}
        confirmLabel="Delete"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setBusy(true);
          try {
            await couponsApi.remove(activeEventId, deleteTarget.id);
            enqueueSnackbar('Coupon deleted.', { variant: 'success' });
            refresh(activeEventId);
          } catch (err) {
            enqueueSnackbar(apiErrorMessage(err, 'Could not delete coupon.'), { variant: 'error' });
          } finally {
            setBusy(false);
            setDeleteTarget(null);
          }
        }}
      />
    </Box>
  );
}

export default function OrganizerCouponsPage() {
  return (
    <OrganizerShell title="Coupons" subtitle="Discount codes for your events." hideSearch hideCreate>
      <CouponsContent />
    </OrganizerShell>
  );
}
