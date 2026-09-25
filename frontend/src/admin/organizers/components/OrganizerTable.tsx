import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { organizersApi } from '../api/organizers';
import { apiErrorMessage, unwrapList } from '../../../app/api/client';
import type { OrganizerItem, OrganizerPayload } from '../../../app/types';

export function isOrganizerActive(o: OrganizerItem | null | undefined): boolean {
  return o?.status === 'APPROVED';
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

interface OrganizerFormState {
  name: string;
  email: string;
  phone: string;
  upiId: string;
  description: string;
}

interface OrganizerFormDialogProps {
  open: boolean;
  initial?: OrganizerItem;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

function OrganizerFormDialog({ open, initial, onClose, onSaved }: OrganizerFormDialogProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState<OrganizerFormState>({
    name: initial?.name || '',
    email: initial?.email || initial?.user?.email || '',
    phone: initial?.phone || '',
    upiId: initial?.upiId || '',
    description: initial?.description || '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof OrganizerFormState) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async () => {
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) { setError('Enter a valid email.'); return; }
    if (!form.upiId.trim()) { setError('UPI ID is required.'); return; }
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
      onSaved(isEdit ? 'Organizer updated successfully.' : 'Organizer created successfully.');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, `Could not ${isEdit ? 'update' : 'create'} organizer.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" fullScreen={false} sx={{ '& .MuiDialog-paper': { m: { xs: 1.5 } } }}>
      <DialogTitle>{isEdit ? 'Edit Organizer' : 'Create Organizer'}</DialogTitle>
      <DialogContent>
        {!isEdit && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The organizer is created with role <strong>Organizer</strong> and signs in with the existing OTP login.
          </Typography>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Name *" placeholder="e.g. Sample Tech Club" value={form.name} onChange={set('name')}
          fullWidth size="small" sx={{ mb: 2, mt: 0.5 }} />
        <TextField label="Email *" placeholder="organizer@example.com" type="email" value={form.email} onChange={set('email')}
          fullWidth size="small" sx={{ mb: 2 }} />
        <TextField label="Phone" placeholder="+91 9876543210" value={form.phone} onChange={set('phone')}
          fullWidth size="small" sx={{ mb: 2 }} />
        <TextField label="UPI ID *" placeholder="club@upi" value={form.upiId} onChange={set('upiId')}
          fullWidth size="small" sx={{ mb: 2 }} />
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

export default function OrganizerTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<OrganizerItem | null>(null);
  const [confirmDeactId, setConfirmDeactId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ['admin', 'organizers'], queryFn: () => organizersApi.list(),
  });
  const all: OrganizerItem[] = data ? unwrapList<OrganizerItem>(data) : [];
  const q = search.trim().toLowerCase();
  const organizers = q
    ? all.filter((o) => (o.name || '').toLowerCase().includes(q) || (o.email || o.user?.email || '').toLowerCase().includes(q))
    : all;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'organizers'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    refetch();
  };

  const saved = (msg: string) => {
    refresh();
    setSuccess(msg);
  };

  const runStatusChange = async (
    id: string,
    fn: (oid: string) => Promise<unknown>,
    okMsg: string,
    failMsg: string
  ) => {
    setError('');
    setBusyId(id);
    try {
      await fn(id);
      refresh();
      setSuccess(okMsg);
    } catch (err) {
      setError(apiErrorMessage(err, failMsg));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ mr: 'auto', fontWeight: 700 }}>Organizers</Typography>
        <TextField
          size="small"
          placeholder="Search organizers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 240 } }}
        />
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Create Organizer
        </Button>
      </Box>

      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

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

      <Dialog open={!!confirmDeactId} onClose={() => setConfirmDeactId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Deactivate organizer?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            The organizer will lose access, but their data and event history are preserved. You can activate them again later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setConfirmDeactId(null)} disabled={!!busyId}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!!busyId}
            onClick={() => {
              const id = confirmDeactId;
              setConfirmDeactId(null);
              if (id) runStatusChange(id, (oid) => organizersApi.deactivate(oid), 'Organizer deactivated.', 'Deactivation failed.');
            }}
          >
            {busyId ? 'Working…' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {isLoading ? (
        <Alert severity="info">Loading organizers…</Alert>
      ) : loadError ? (
        <Alert severity="error">Could not load organizers.</Alert>
      ) : organizers.length === 0 ? (
        <Alert severity="info">{q ? 'No organizers match your search.' : 'No organizers found.'}</Alert>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Organizer</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Events</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {organizers.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{o.name}</TableCell>
                  <TableCell>{o.email || o.user?.email || '—'}</TableCell>
                  <TableCell>{o._count?.events ?? '—'}</TableCell>
                  <TableCell><OrganizerStatusChip organizer={o} /></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button size="small" variant="outlined" component={RouterLink} to={`/admin/organizers/${o.id}`}>
                        View
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => setEditTarget(o)}>
                        Edit
                      </Button>
                      {isOrganizerActive(o) ? (
                        <Button size="small" color="error" disabled={busyId === o.id} onClick={() => setConfirmDeactId(o.id)}>
                          {busyId === o.id ? 'Working…' : 'Deactivate'}
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          color="success"
                          disabled={busyId === o.id}
                          onClick={() => runStatusChange(o.id, (oid) => organizersApi.approve(oid), 'Organizer activated.', 'Activation failed.')}
                        >
                          {busyId === o.id ? 'Working…' : 'Activate'}
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
