import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider,
  FormControlLabel, InputAdornment, Radio, RadioGroup,
  Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { eventsApi } from '../api/events';
import DashboardShell from '../../../app/components/DashboardShell';
import RequireRole from '../../../auth/components/RequireRole';
import FormBuilder from '../components/FormBuilder';
import { toBuilderForm } from '../utils/formBuilderUtils';
import type { BuilderForm } from '../utils/formBuilderUtils';
import RegistrationFlow from '../../../participant/registrations/components/RegistrationFlow';
import type { EventItem, EventPayload, FormStructure } from '../../../app/types';

const STEPS = ['Event Details', 'Registration Form', 'Preview & Publish'];

function toDateInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toTimeInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function toDeadlineInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface WizardDetails {
  eventName: string;
  description: string;
  date: string;
  time: string;
  deadline: string;
  slots: number | string;
  paymentType: string;
  feeAmount: string;
}

export function EventWizardInner({ editId }: { editId?: string }) {
  const isEdit = !!editId;
  const [step, setStep] = useState(0);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [structure, setStructure] = useState<FormStructure | null>(null);
  const [builderInitial, setBuilderInitial] = useState<BuilderForm | null>(null);
  const [previewSubmitted, setPreviewSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [details, setDetails] = useState<WizardDetails>({ eventName: '', description: '', date: '', time: '', deadline: '', slots: 100, paymentType: 'free', feeAmount: '' });
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);

  const { data: loaded, isLoading: loadingEvent } = useQuery({
    queryKey: ['organizer-event', editId],
    queryFn: () => eventsApi.get(editId!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!loaded?.data) return;
    const ev = loaded.data;
    setEvent(ev);
    setDetails({
      eventName: ev.eventName || '',
      description: ev.description || '',
      date: toDateInput(ev.date),
      time: toTimeInput(ev.date),
      deadline: toDeadlineInput(ev.closingTime),
      slots: ev.slots || 100,
      paymentType: ev.paymentRequired ? 'paid' : 'free',
      feeAmount: ev.paymentRequired && ev.formStructure?.payment?.amount != null
        ? String(ev.formStructure.payment.amount)
        : '',
    });
    setStructure(ev.formStructure || null);
    setBuilderInitial(toBuilderForm(ev.formStructure));
  }, [loaded]);

  // Development diagnosis: never swallow the real failure. The complete error
  // (status, URL, backend body) goes to the console; the user sees the most
  // specific safe message available instead of the generic fallback.
  const fail = (err: unknown, fallback: string, context?: string) => {
    const axiosErr = axios.isAxiosError(err) ? err : null;
    console.error('BEPART REQUEST FAILED', {
      context,
      message: err instanceof Error ? err.message : undefined,
      code: axiosErr?.code,
      status: axiosErr?.response?.status,
      data: axiosErr?.response?.data,
      url: axiosErr?.config?.url,
      method: axiosErr?.config?.method,
      requestData: axiosErr?.config?.data,
      error: err,
    });
    const backendMessage: unknown = axiosErr?.response?.data && typeof axiosErr.response.data === 'object'
      ? (axiosErr.response.data as { message?: unknown }).message
      : undefined;
    setError(
      (typeof backendMessage === 'string' && backendMessage) ||
      (err instanceof Error ? err.message : '') ||
      fallback
    );
  };

  const parseFeeAmount = (): number | null => {
    if (details.paymentType !== 'paid') return null;
    if (details.feeAmount === '' || details.feeAmount == null) throw new Error('Registration fee is required for paid events.');
    const amount = Number(details.feeAmount);
    if (!Number.isFinite(amount)) throw new Error('Registration fee must be a valid number.');
    if (amount <= 0) throw new Error('Registration fee must be greater than 0.');
    return amount;
  };

  // Payment config lives on the event (paymentRequired) + inside the single
  // formStructure (payment.amount) — the same representation the participant
  // RegistrationFlow already reads. No second model involved.
  function withPaymentConfig(baseStructure: FormStructure): FormStructure;
  function withPaymentConfig(baseStructure: null): null;
  function withPaymentConfig(baseStructure: FormStructure | null): FormStructure | null {
    if (!baseStructure) return baseStructure;
    const merged: FormStructure = { ...baseStructure };
    if (details.paymentType === 'paid') {
      merged.payment = { amount: parseFeeAmount() ?? 0 };
    } else {
      delete merged.payment;
    }
    return merged;
  }

  const buildDetailsPayload = (): EventPayload => {
    if (!details.eventName.trim()) throw new Error('Event name is required.');
    if (!details.date || !details.time) throw new Error('Event date and time are required.');
    if (!details.deadline) throw new Error('Registration deadline is required.');
    const date = new Date(`${details.date}T${details.time}:00`);
    const closingTime = new Date(details.deadline);
    if (isNaN(date.getTime()) || isNaN(closingTime.getTime())) throw new Error('Invalid date or time.');
    if (closingTime >= date) throw new Error('Registration deadline must be before the event date.');
    const slots = parseInt(String(details.slots), 10);
    if (!Number.isFinite(slots) || slots < 1) throw new Error('Capacity must be at least 1.');
    if (details.paymentType === 'paid') parseFeeAmount();
    return {
      eventName: details.eventName.trim(),
      description: details.description.trim() || undefined,
      date: date.toISOString(),
      slots,
      closingTime: closingTime.toISOString(),
      paymentRequired: details.paymentType === 'paid',
    };
  };

  const saveDraft = async () => {
    setError('');
    setBusy(true);
    try {
      const payload = buildDetailsPayload();
      // In edit mode the form may already exist: persist the payment config
      // together with the details in the same update call.
      if (isEdit && structure) {
        payload.formStructure = withPaymentConfig(structure);
      }
      console.log('SAVE EVENT DETAILS REQUEST', payload);
      const res = isEdit ? await eventsApi.update(editId!, payload) : await eventsApi.create(payload);
      console.log('SAVE EVENT DETAILS RESPONSE', res.data);
      const saved = res.data;
      setEvent(saved);
      if (payload.formStructure) {
        setStructure(payload.formStructure);
      }
      if (!builderInitial) {
        setBuilderInitial(toBuilderForm(saved.formStructure));
        if (!payload.formStructure) {
          setStructure(saved.formStructure || null);
        }
      }
      setStep(1);
    } catch (err) {
      fail(err, 'Could not save event details.', 'saveDraft');
    } finally {
      setBusy(false);
    }
  };

  const uploadPoster = async () => {
    if (!posterFile || !event) return;
    setError('');
    setPosterBusy(true);
    try {
      const res = await eventsApi.uploadPoster(event.id, posterFile);
      setEvent({ ...event, posterUrl: res.data.posterUrl });
      setPosterFile(null);
    } catch (err) {
      fail(err, 'Poster upload failed.');
    } finally {
      setPosterBusy(false);
    }
  };

  const saveForm = async (formStructure: FormStructure) => {
    if (!event) return;
    setError('');
    setBusy(true);
    try {
      // Payment config comes from the Event Details step (single source of truth
      // for paid/free + amount); merge it into the one stored formStructure.
      const merged = withPaymentConfig({ ...formStructure });
      const res = await eventsApi.update(event.id, { formStructure: merged });
      setEvent(res.data);
      setStructure(merged);
      setPreviewSubmitted(false);
      setStep(2);
    } catch (err) {
      fail(err, 'Could not save the registration form.');
    } finally {
      setBusy(false);
    }
  };

  const doTransition = async (fn: (id: number) => Promise<{ data: EventItem }>, okMsg?: string) => {
    if (!event) return;
    setError('');
    setBusy(true);
    try {
      const res = await fn(event.id);
      setEvent(res.data);
      if (okMsg) setError('');
    } catch (err) {
      fail(err, 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const doCancel = async () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setConfirmCancel(false);
    await doTransition((id) => eventsApi.cancel(id));
  };

  if (isEdit && loadingEvent) {
    return (
      <DashboardShell title="Edit Event" navItems={organizerNav}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </DashboardShell>
    );
  }

  if (isEdit && event?.status === 'PUBLISHED') {
    return (
      <DashboardShell title="Edit Event" navItems={organizerNav}>
        <Alert severity="info" sx={{ mb: 3 }}>
          This event is published and cannot be edited. Cancel it first if changes are needed.
        </Alert>
        <Button variant="contained" component={RouterLink} to={`/organizer/events/${event.id}`}>
          View Event
        </Button>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title={isEdit ? 'Edit Event' : 'Create Event'} navItems={organizerNav}>
      <Stepper activeStep={step} sx={{ mb: 4, overflowX: 'auto' }}>
        {STEPS.map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {step === 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3, maxWidth: 720 }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Event Details</Typography>
            <TextField label="Event Name" placeholder="e.g. Udbhav Hackathon 2026" value={details.eventName}
              onChange={(e) => setDetails({ ...details, eventName: e.target.value })} fullWidth size="small" sx={{ mb: 2 }} />
            <TextField label="Description" placeholder="What is this event about?" value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })} fullWidth size="small" multiline rows={3} sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <TextField label="Date" type="date" value={details.date} onChange={(e) => setDetails({ ...details, date: e.target.value })}
                size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
              <TextField label="Time" type="time" value={details.time} onChange={(e) => setDetails({ ...details, time: e.target.value })}
                size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
            </Box>
            <TextField label="Registration Deadline" type="datetime-local" value={details.deadline}
              onChange={(e) => setDetails({ ...details, deadline: e.target.value })}
              fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} sx={{ mb: 2 }} />
            <TextField label="Capacity (slots)" type="number" value={details.slots}
              onChange={(e) => setDetails({ ...details, slots: e.target.value })}
              size="small" slotProps={{ htmlInput: { min: 1 } }} sx={{ mb: 2, width: 220 }} />

            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>Registration Type</Typography>
            <RadioGroup
              row
              value={details.paymentType}
              onChange={(e) => setDetails({ ...details, paymentType: e.target.value })}
              sx={{ mb: details.paymentType === 'paid' ? 2 : 0 }}
            >
              <FormControlLabel value="free" control={<Radio size="small" />} label="Free Event" />
              <FormControlLabel value="paid" control={<Radio size="small" />} label="Paid Event" />
            </RadioGroup>
            {details.paymentType === 'paid' && (
              <TextField label="Registration Fee" type="number" placeholder="300" value={details.feeAmount}
                onChange={(e) => setDetails({ ...details, feeAmount: e.target.value })}
                size="small"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { min: 0.01, step: 'any' } }}
                sx={{ mb: 2, width: 220 }}
              />
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>Event Poster (optional)</Typography>
            {event?.posterUrl && (
              <Box sx={{ mb: 2 }}>
                <Box component="img" src={event.posterUrl} alt="Event poster"
                  sx={{ width: '100%', maxWidth: 420, borderRadius: 2, border: '1px solid', borderColor: 'divider' }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="outlined" component="label" size="small" disabled={!event && !isEdit}>
                Choose Image
                <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => setPosterFile(e.target.files?.[0] || null)} />
              </Button>
              {posterFile && <Typography variant="body2">{posterFile.name}</Typography>}
              {posterFile && event && (
                <Button size="small" variant="contained" onClick={uploadPoster} disabled={posterBusy}>
                  {posterBusy ? 'Uploading…' : 'Upload Poster'}
                </Button>
              )}
              {!event && !isEdit && (
                <Typography variant="body2" color="text.secondary">Save the draft first to upload a poster.</Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" size="large" onClick={saveDraft} disabled={busy} sx={{ px: 4 }}>
                {busy ? 'Saving…' : isEdit ? 'Save & Continue' : 'Save Draft & Continue'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {step === 1 && builderInitial && (
        <FormBuilder
          initial={builderInitial}
          saving={busy}
          onSave={saveForm}
          onPreview={(s) => { setStructure(s); setPreviewSubmitted(false); setStep(2); }}
        />
      )}

      {step === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 3 }}>
            Participant preview — exactly what participants will see. No real registration is created here.
          </Alert>
          {previewSubmitted && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setPreviewSubmitted(false)}>
              Preview submitted. In the real flow this would continue to review and registration.
            </Alert>
          )}
          {structure ? (
            <Card variant="outlined" sx={{ borderRadius: 3, mb: 3 }}>
              <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                <RegistrationFlow
                  formStructure={structure}
                  onSubmit={() => setPreviewSubmitted(true)}
                  isSubmitting={false}
                  event={{ eventName: details.eventName || event?.eventName }}
                  onBackToEvent={() => {}}
                />
              </CardContent>
            </Card>
          ) : (
            <Alert severity="warning" sx={{ mb: 3 }}>Save the registration form first to preview it.</Alert>
          )}

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: { xs: 2.5, md: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Publish</Typography>
                <Chip label={event?.status || 'DRAFT'} color={event?.status === 'PUBLISHED' ? 'success' : 'default'} variant="outlined" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={() => setStep(1)} disabled={busy}>Back</Button>
                {event?.status === 'DRAFT' && (
                  <Button variant="contained" onClick={() => doTransition((id) => eventsApi.preview(id))} disabled={busy}>
                    {busy ? 'Working…' : 'Move to Preview'}
                  </Button>
                )}
                {event?.status === 'PREVIEW' && (
                  <Button variant="contained" color="success" onClick={() => doTransition((id) => eventsApi.publish(id))} disabled={busy}>
                    {busy ? 'Publishing…' : 'Publish Event'}
                  </Button>
                )}
                {event?.status === 'PUBLISHED' && (
                  <Button variant="contained" component={RouterLink} to={`/organizer/events/${event.id}`}>
                    View Event
                  </Button>
                )}
                {event && event.status !== 'CANCELLED' && event.status !== 'PUBLISHED' && (
                  <Button variant="text" color="error" onClick={doCancel} disabled={busy}>
                    {confirmCancel ? 'Click again to confirm cancel' : 'Cancel Event'}
                  </Button>
                )}
              </Box>
              {event?.status === 'PUBLISHED' && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Published! Participants can now find it on the public events page.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </DashboardShell>
  );
}

export const organizerNav: { label: string; to: string; end?: boolean }[] = [
  { label: 'Dashboard', to: '/organizer', end: true },
  { label: 'My Events', to: '/organizer/events' },
  { label: 'Withdrawals', to: '/organizer/withdrawals' },
  { label: 'Account', to: '/organizer/account' },
];

export function EventCreatePage() {
  return (
    <RequireRole roles={['ORGANIZER']}>
      <EventWizardInner />
    </RequireRole>
  );
}

export function EventEditPage() {
  const { id } = useParams();
  return (
    <RequireRole roles={['ORGANIZER']}>
      <EventWizardInner editId={id} />
    </RequireRole>
  );
}
