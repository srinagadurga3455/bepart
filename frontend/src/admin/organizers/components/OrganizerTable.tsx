import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Chip,
  Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputAdornment, InputLabel, MenuItem,
  Pagination, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Add, GroupsOutlined, Search } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { organizersApi } from '../api/organizers';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import {
  validateEmail, validatePhone, validateRequired, validateUpiId,
} from '../../../app/utils/validators';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
import EmptyState from '../../../app/components/EmptyState';
import type { OrganizerItem, OrganizerPayload } from '../../../app/types';

const PAGE_SIZE = 8; // kept for backward compat; OrganizerTable uses ORG_PAGE_SIZE

// ─── Status helpers ────────────────────────────────────────────────────────────

/**
 * An organizer is "active" when isActive is true AND status is APPROVED.
 * deactivateTransaction sets isActive=false + status=REJECTED.
 * reactivateTransaction (approve) sets isActive=true + status=APPROVED.
 * We read isActive as the primary runtime gate; APPROVED confirms full access.
 */
export function isOrganizerActive(o: OrganizerItem | null | undefined): boolean {
  if (!o) return false;
  if (o.isActive === false) return false;
  return o.status === 'APPROVED';
}

export function OrganizerStatusChip({ organizer }: { organizer: OrganizerItem }) {
  const active = isOrganizerActive(organizer);
  return (
    <Chip
      label={active ? 'Active' : 'Inactive'}
      size="small"
      variant="outlined"
      color={active ? 'success' : 'default'}
    />
  );
}

// ─── Create / Edit dialog ──────────────────────────────────────────────────────

interface OrganizerFormState {
  name: string;
  email: string;
  phone: string;
  upiId: string;
  description: string;
}

interface OrganizerFormErrors {
  name?: string;
  email?: string;
  phone?: string;
  upiId?: string;
}

interface OrganizerFormDialogProps {
  open: boolean;
  initial?: OrganizerItem;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

function OrganizerFormDialog({ open, initial, onClose, onSaved }: OrganizerFormDialogProps) {
  const isEdit = !!initial;
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState<OrganizerFormState>({
    name: initial?.name || '',
    email: initial?.email || initial?.user?.email || '',
    phone: initial?.phone || '',
    upiId: initial?.upiId || '',
    description: initial?.description || '',
  });
  const [fieldErrors, setFieldErrors] = useState<OrganizerFormErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof OrganizerFormState) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [k]: e.target.value }));
    setFieldErrors((prev) => ({ ...prev, [k]: undefined }));
  };

  const validate = (): OrganizerFormErrors => {
    const errors: OrganizerFormErrors = {};
    const nameErr = validateRequired(form.name, 'Name');
    if (nameErr) errors.name = nameErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) errors.email = emailErr;
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) errors.phone = phoneErr;
    const upiErr = validateUpiId(form.upiId);
    if (upiErr) errors.upiId = upiErr;
    return errors;
  };

  const submit = async () => {
    setSubmitError('');
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setBusy(true);
    try {
      const payload: OrganizerPayload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        upiId: form.upiId.trim(),
        description: form.description.trim() || undefined,
      };
      if (isEdit && initial) await organizersApi.update(initial.id, payload);
      else await organizersApi.create(payload);
      const msg = isEdit ? 'Organizer updated successfully.' : 'Organizer created successfully';
      enqueueSnackbar(msg, { variant: 'success' });
      onSaved(msg);
      onClose();
    } catch (err) {
      const msg = apiErrorMessage(err, `Could not ${isEdit ? 'update' : 'create'} organizer.`);
      setSubmitError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      sx={{ '& .MuiDialog-paper': { m: { xs: 1.5 } } }}
    >
      <DialogTitle>{isEdit ? 'Edit Organizer' : 'Create Organizer'}</DialogTitle>
      <DialogContent>
        {!isEdit && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The organizer is created with role <strong>Organizer</strong> and signs in with the
            existing OTP login.
          </Typography>
        )}
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <TextField
          label="Name *" placeholder="e.g. Sample Tech Club" value={form.name}
          onChange={set('name')} fullWidth size="small" sx={{ mb: 2, mt: 0.5 }}
          error={!!fieldErrors.name} helperText={fieldErrors.name}
        />
        <TextField
          label="Email *" placeholder="organizer@example.com" type="email"
          value={form.email} onChange={set('email')} fullWidth size="small" sx={{ mb: 2 }}
          error={!!fieldErrors.email} helperText={fieldErrors.email}
        />
        <TextField
          label="Phone" placeholder="+91 9876543210" value={form.phone}
          onChange={set('phone')} fullWidth size="small" sx={{ mb: 2 }}
          error={!!fieldErrors.phone} helperText={fieldErrors.phone}
        />
        <TextField
          label="UPI ID *" placeholder="clubname@okhdfc" value={form.upiId}
          onChange={set('upiId')} fullWidth size="small" sx={{ mb: 2 }}
          error={!!fieldErrors.upiId}
          helperText={fieldErrors.upiId || 'Format: handle@bank  (e.g. club@okhdfc, 9876543210@upi)'}
        />
        <TextField label="Description" value={form.description} onChange={set('description')}
          fullWidth size="small" multiline rows={2} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Organizer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main OrganizerTable ───────────────────────────────────────────────────────

const ORG_PAGE_SIZE = 10;

export default function OrganizerTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrganizerItem | null>(null);
  const [confirmDeactId, setConfirmDeactId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-dismiss success banner after 3 s — no X button needed.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [success]);

  // When search or filter is active: fetch all (no page param) so search
  // works across the full dataset. When neither is active: use server-side
  // pagination to avoid loading the entire list.
  const isFiltering = search.trim().length > 0 || statusFilter !== 'all';

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['admin', 'organizers', isFiltering ? 'all' : page, ORG_PAGE_SIZE],
    queryFn: () =>
      isFiltering
        ? organizersApi.list()
        : organizersApi.list({ page, limit: ORG_PAGE_SIZE }),
  });

  // When filtering: unwrap and filter client-side
  // When paginating: the backend already sliced the data
  const rawData = data?.data;
  const pagedMeta = !isFiltering && rawData && !Array.isArray(rawData) && 'meta' in rawData
    ? (rawData as { data: OrganizerItem[]; meta: { total: number; page: number; limit: number; totalPages: number } }).meta
    : null;
  const allItems: OrganizerItem[] = data ? unwrapList<OrganizerItem>(data) : [];

  const q = search.trim().toLowerCase();
  const organizers = isFiltering
    ? allItems.filter((o) => {
        if (statusFilter !== 'all' && (isOrganizerActive(o) ? 'active' : 'inactive') !== statusFilter)
          return false;
        if (!q) return true;
        return (
          (o.name || '').toLowerCase().includes(q) ||
          (o.email || o.user?.email || '').toLowerCase().includes(q) ||
          (o.phone || '').toLowerCase().includes(q)
        );
      })
    : allItems;

  // totalPages: from server meta when not filtering, computed locally when filtering
  const serverTotalPages = pagedMeta?.totalPages ?? 1;
  const clientTotalPages = Math.max(1, Math.ceil(organizers.length / ORG_PAGE_SIZE));
  const totalPages = isFiltering ? clientTotalPages : serverTotalPages;

  const safePage = Math.min(page, totalPages);

  // When filtering client-side, also slice locally
  const paged = isFiltering
    ? organizers.slice((safePage - 1) * ORG_PAGE_SIZE, safePage * ORG_PAGE_SIZE)
    : organizers; // backend already returned correct slice

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizer-overview'] });
    refetch().then((res) => {
      // If deletion emptied the current page, move to last valid page
      const meta = res?.data?.data &&
        !Array.isArray(res.data.data) &&
        'meta' in (res.data.data as object)
          ? (res.data.data as any).meta
          : null;
      if (meta && page > meta.totalPages && meta.totalPages > 0) {
        setPage(meta.totalPages);
      }
    });
  };

  const saved = (msg: string) => {
    refresh();
    setSuccess(msg);
  };

  const runStatusChange = async (
    id: string,
    fn: (oid: string) => Promise<unknown>,
    okMsg: string,
    failMsg: string,
  ) => {
    setError('');
    setBusyId(id);
    try {
      await fn(id);
      refresh();
      setSuccess(okMsg);
      enqueueSnackbar(okMsg, { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, failMsg);
      setError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <Box
        sx={{
          bgcolor: '#FFFFFF',
          border: '1px solid #ECEEF4',
          borderRadius: '12px',
          p: { xs: 2, md: 2.5 },
        }}
      >
        {/* Toolbar */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography
            sx={{
              mr: 'auto',
              fontSize: 17,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#101828',
            }}
          >
            Organizers
          </Typography>
          <TextField
            size="small"
            placeholder="Search organizers"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 17, color: '#98A2B3' }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              width: { xs: '100%', sm: 220 },
              '& .MuiOutlinedInput-root': { borderRadius: '9px', fontSize: 13, bgcolor: '#FFFFFF' },
            }}
          />
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 150 } }}>
            <InputLabel id="org-status-filter">Status</InputLabel>
            <Select
              labelId="org-status-filter"
              label="Status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'all' | 'active' | 'inactive'); setPage(1); }}
              sx={{ borderRadius: '9px', fontSize: 13, bgcolor: '#FFFFFF' }}
            >
              <MenuItem value="all">All statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            startIcon={<Add sx={{ fontSize: 17 }} />}
            onClick={() => setCreateOpen(true)}
            sx={{ borderRadius: '9px', fontSize: 13, fontWeight: 700, textTransform: 'none', boxShadow: 'none', px: 2, py: 1 }}
          >
            Create Organizer
          </Button>
        </Box>

        {/* Banners */}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {/* Table */}
        {isLoading ? (
          <Alert severity="info">Loading organizers…</Alert>
        ) : loadError ? (
          <Alert severity="error">Could not load organizers.</Alert>
        ) : organizers.length === 0 ? (
          <EmptyState
            icon={GroupsOutlined}
            title={q || statusFilter !== 'all' ? 'No organizers match your filters' : 'No organizers yet'}
            description={
              q || statusFilter !== 'all'
                ? 'Try a different search term or status filter.'
                : 'Create your first organizer to start onboarding event hosts.'
            }
            actionLabel={q || statusFilter !== 'all' ? undefined : 'Create Organizer'}
            onAction={q || statusFilter !== 'all' ? undefined : () => setCreateOpen(true)}
          />
        ) : (
          <TableContainer sx={{ overflowX: 'auto', border: '1px solid #EEF1F7', borderRadius: '10px' }}>
            <Table size="small" sx={{ minWidth: 780 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#F4F7FF', '& .MuiTableCell-head': { borderBottom: '1px solid #EEF1F7' } }}>
                  {['Name', 'Email', 'Phone', 'UPI ID', 'Status', 'Events', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontSize: 12, fontWeight: 600, color: '#667085' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.map((o) => (
                  <TableRow
                    key={o.id}
                    sx={{ '& .MuiTableCell-body': { fontSize: 13, borderBottom: '1px solid #F2F4F8' } }}
                  >
                    <TableCell sx={{ fontWeight: 600, color: '#101828' }}>{o.name}</TableCell>
                    <TableCell sx={{ color: '#344054' }}>{o.email || o.user?.email || '—'}</TableCell>
                    <TableCell sx={{ color: '#344054' }}>{o.phone || '—'}</TableCell>
                    <TableCell sx={{ color: '#344054' }}>{o.upiId || '—'}</TableCell>
                    <TableCell><OrganizerStatusChip organizer={o} /></TableCell>
                    <TableCell sx={{ color: '#344054' }}>{o._count?.events ?? '—'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {/* Row 1: View + Edit */}
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap' }}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate(`/admin/organizers/${o.id}`)}
                          sx={{ fontSize: 12, textTransform: 'none', borderRadius: '7px' }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setEditTarget(o)}
                          sx={{ fontSize: 12, textTransform: 'none', borderRadius: '7px' }}
                        >
                          Edit
                        </Button>
                        </Box>
                        {/* Row 2: Activate/Deactivate + Delete — always on same line */}
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'nowrap' }}>
                        {isOrganizerActive(o) ? (
                          <Button size="small" color="error" disabled={busyId === o.id}
                            onClick={() => setConfirmDeactId(o.id)}
                            sx={{ fontSize: 12, textTransform: 'none' }}>
                            {busyId === o.id ? 'Working…' : 'Deactivate'}
                          </Button>
                        ) : (
                          <Button size="small" color="success" disabled={busyId === o.id}
                            onClick={() => runStatusChange(o.id, (oid) => organizersApi.approve(oid), 'Organizer activated.', 'Activation failed.')}
                            sx={{ fontSize: 12, textTransform: 'none' }}>
                            {busyId === o.id ? 'Working…' : 'Activate'}
                          </Button>
                        )}
                        <Button size="small" color="error" disabled={busyId === o.id}
                          onClick={() => setConfirmDeleteId(o.id)}
                          sx={{ fontSize: 12, textTransform: 'none' }}>
                          Delete
                        </Button>
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      {/* Create / Edit dialogs */}
      {createOpen && (
        <OrganizerFormDialog open onClose={() => setCreateOpen(false)} onSaved={saved} />
      )}
      {editTarget && (
        <OrganizerFormDialog
          key={editTarget.id}
          open
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={saved}
        />
      )}

      {/* Confirm: Deactivate */}
      <ConfirmDialog
        open={!!confirmDeactId}
        title="Deactivate organizer?"
        description="The organizer will lose access and their events will be hidden from participants until reactivation. Event history and data are preserved."
        confirmLabel="Deactivate"
        busy={!!busyId}
        onCancel={() => setConfirmDeactId(null)}
        onConfirm={() => {
          const id = confirmDeactId;
          setConfirmDeactId(null);
          if (id)
            runStatusChange(id, (oid) => organizersApi.deactivate(oid),
              'Organizer deactivated. Their events are now hidden.', 'Deactivation failed.');
        }}
      />

      {/* Confirm: Delete */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete Organizer?"
        description="This action cannot be undone. All associated events and registrations will be permanently removed."
        confirmLabel="Delete"
        busy={!!busyId}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          const id = confirmDeleteId;
          setConfirmDeleteId(null);
          if (id)
            runStatusChange(id, (oid) => organizersApi.remove(oid),
              'Organizer deleted.', 'Could not delete organizer.');
        }}
      />

      {/* Pagination — only show when more than one page exists */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination
            count={totalPages}
            page={safePage}
            onChange={(_, value) => setPage(value)}
            size="small"
            shape="rounded"
            sx={{
              '& .MuiPaginationItem-root': { fontSize: 12.5, color: '#667085' },
              '& .Mui-selected': { bgcolor: '#EAF1FF !important', color: '#2557F5', fontWeight: 700 },
            }}
          />
        </Box>
      )}
    </Box>
  );
}
