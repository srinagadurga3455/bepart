import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress, TextField, Typography } from '@mui/material';
import { LogoutOutlined, PersonOutlined } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import OrganizerShell from '../../components/OrganizerShell';
import { useOrganizerIdentity } from '../../components/useOrganizerIdentity';
import { organizersApi } from '../api/organizers';
import { logout } from '../../../auth/components/RequireRole';
import { apiErrorMessage } from '../../../app/api/client';
import { validateEmail, validatePhone, validateRequired, validateUpiId } from '../../../app/utils/validators';

const BLUE = '#2557F5';
const INK = '#101828';
const MUTED = '#667085';
const CARD_BORDER = '#ECEEF4';

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ py: 1.5, borderBottom: '1px solid', borderColor: CARD_BORDER, '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ fontSize: 12, color: MUTED, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: 14.5, fontWeight: 600, color: INK }}>{value}</Typography>
    </Box>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', color: MUTED, mt: 3, mb: 0.5 }}>
      {children.toUpperCase()}
    </Typography>
  );
}

export default function OrganizerAccountPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { organizer, user, isLoading } = useOrganizerIdentity();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', upiId: '', description: '' });

  useEffect(() => {
    if (organizer && !editing) {
      setForm({
        name: organizer.name || '',
        email: organizer.email || organizer.user?.email || '',
        phone: organizer.phone || '',
        upiId: organizer.upiId || '',
        description: organizer.description || '',
      });
    }
  }, [organizer, editing]);

  const profileName = organizer?.name || user?.name || '—';
  const profileEmail = organizer?.email || organizer?.user?.email || user?.email || '—';
  const profilePhone = organizer?.phone || user?.phone || '—';
  const profileInitial = profileName.charAt(0)?.toUpperCase() || 'O';

  const startEdit = () => {
    if (!organizer) return;
    setForm({
      name: organizer.name || '',
      email: organizer.email || organizer.user?.email || '',
      phone: organizer.phone || '',
      upiId: organizer.upiId || '',
      description: organizer.description || '',
    });
    setFormError('');
    setEditing(true);
  };

  const save = async () => {
    setFormError('');
    const nameErr = validateRequired(form.name, 'Name');
    if (nameErr) { setFormError(nameErr); return; }
    const emailErr = validateEmail(form.email);
    if (emailErr) { setFormError(emailErr); return; }
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) { setFormError(phoneErr); return; }
    const upiErr = validateUpiId(form.upiId, false);
    if (upiErr) { setFormError(upiErr); return; }
    setSaving(true);
    try {
      await organizersApi.updateMe({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        upiId: form.upiId.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['organizer', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      setEditing(false);
      enqueueSnackbar('Account updated successfully.', { variant: 'success' });
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not update account.');
      setFormError(msg);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <OrganizerShell hideSearch hideCreate>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '240px 1fr' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        {/* Left: account navigation */}
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: CARD_BORDER, bgcolor: '#FFFFFF' }}>
          <CardContent sx={{ p: 2 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: INK, px: 1.5, pt: 0.5, pb: 1.5 }}>
              My Account
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 1.5,
                py: 1.25,
                borderRadius: 2,
                bgcolor: '#EAF1FF',
                color: BLUE,
              }}
            >
              <PersonOutlined sx={{ fontSize: 20 }} />
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Profile</Typography>
            </Box>
            <Box sx={{ mt: 6 }}>
              <Box
                component="button"
                onClick={() => logout(navigate)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 2,
                  border: 'none',
                  bgcolor: 'transparent',
                  color: '#DC2626',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  '&:hover': { bgcolor: '#FEF2F2' },
                }}
              >
                <LogoutOutlined sx={{ fontSize: 20 }} />
                Logout
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Right: profile content */}
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: CARD_BORDER, bgcolor: '#FFFFFF' }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: INK, mb: 2.5 }}>
              Profile
            </Typography>
            {isLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
            ) : organizer ? (
              editing ? (
                <>
                  {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
                  <TextField label="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    fullWidth size="small" sx={{ mb: 2 }} />
                  <TextField label="Email Address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    fullWidth size="small" sx={{ mb: 2 }} helperText="Used for OTP sign-in" />
                  <TextField label="Phone Number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    fullWidth size="small" sx={{ mb: 2 }} placeholder="+91 9876543210" />
                  <TextField label="UPI ID" value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })}
                    fullWidth size="small" sx={{ mb: 2 }} placeholder="club@okhdfc" helperText="Used for payout settlements" />
                  <TextField label="About" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    fullWidth size="small" multiline rows={3} sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                    <Button onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    <Button variant="contained" onClick={save} disabled={saving} sx={{ boxShadow: 'none' }}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  </Box>
                </>
              ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2.5, borderBottom: '1px solid', borderColor: CARD_BORDER, flexWrap: 'wrap' }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: BLUE, fontWeight: 800, fontSize: 26 }}>
                    {profileInitial}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: INK }}>
                      {organizer.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">Organizer</Typography>
                  </Box>
                  <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={organizer.status} size="small" variant="outlined" color="success" />
                    <Button size="small" variant="outlined" onClick={startEdit} sx={{ borderRadius: 999 }}>
                      Edit Profile
                    </Button>
                  </Box>
                </Box>

                <SectionTitle>Account Details</SectionTitle>
                <FieldRow label="Email Address" value={profileEmail} />
                <FieldRow label="Phone Number" value={organizer.phone || '—'} />
                <FieldRow label="UPI ID" value={organizer.upiId || '—'} />
                <FieldRow label="Status" value={organizer.status} />

                <SectionTitle>Personal Details</SectionTitle>
                <FieldRow label="Full Name" value={organizer.name} />
                <FieldRow label="Role" value="Organizer" />
                {organizer.description && <FieldRow label="About" value={organizer.description} />}
              </>
              )
            ) : user ? (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  No organizer profile is linked to this login yet. Showing your account details below.
                </Alert>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2.5, borderBottom: '1px solid', borderColor: CARD_BORDER }}>
                  <Avatar sx={{ width: 64, height: 64, bgcolor: BLUE, fontWeight: 800, fontSize: 26 }}>
                    {profileInitial}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.03em', color: INK }}>
                      {user.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">{user.role}</Typography>
                  </Box>
                  <Chip label={user.role} size="small" variant="outlined" color="primary" sx={{ ml: 'auto' }} />
                </Box>

                <SectionTitle>Account Details</SectionTitle>
                <FieldRow label="Email Address" value={user.email} />
                <FieldRow label="Phone Number" value={profilePhone} />
                <FieldRow label="Status" value={user.isActive ? 'Active' : 'Inactive'} />

                <SectionTitle>Personal Details</SectionTitle>
                <FieldRow label="Full Name" value={user.name} />
                <FieldRow label="Role" value={user.role} />
              </>
            ) : (
              <Alert severity="error">Could not load account.</Alert>
            )}
          </CardContent>
        </Card>
      </Box>
    </OrganizerShell>
  );
}
