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
import OrganizerShell from '../../components/OrganizerShell';
import {
  orgCardSx,
  orgFormFieldSx,
  orgPrimaryButtonSx,
  orgSmallButtonSx,
} from '../../components/organizerStyles';
import RequireRole from '../../../auth/components/RequireRole';
import ConfirmDialog from '../../../app/components/ConfirmDialog';
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
  const [squareFile, setSquareFile] = useState<File | null>(null);
  const [rectFile, setRectFile] = useState<File | null>(null);
  const [posterBusy, setPosterBusy] = useState<null | 'square' | 'rectangle'>(null);

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

  const uploadPoster = async (kind: 'square' | 'rectangle') => {
    const file = kind === 'square' ? squareFile : rectFile;
    if (!file || !event) return;
    setError('');
    setPosterBusy(kind);
    try {
      if (kind === 'square') {
        const res = await eventsApi.uploadPosterSquare(event.id, file);
        setEvent({ ...event, posterSquareUrl: res.data.posterSquareUrl });
        setSquareFile(null);
      } else {
        const res = await eventsApi.uploadPosterRectangle(event.id, file);
        setEvent({ ...event, posterRectangleUrl: res.data.posterRectangleUrl });
        setRectFile(null);
      }
    } catch (err) {
      fail(err, kind === 'square' ? 'Square poster upload failed (needs a 1:1 image).' : 'Banner upload failed (needs a 16:9 landscape image).');
    } finally {
      setPosterBusy(null);
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

  const doTransition = async (fn: (id: string) => Promise<{ data: EventItem }>, okMsg?: string) => {
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
    setConfirmCancel(false);
    await doTransition((id) => eventsApi.cancel(id));
  };

  if (isEdit && loadingEvent) {
    return (
      <OrganizerShell title="Edit Event" hideSearch hideCreate>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </OrganizerShell>
    );
  }

  if (isEdit && event?.status === 'PUBLISHED') {
    return (
      <OrganizerShell title="Edit Event" hideSearch hideCreate>
        <Alert severity="info" sx={{ mb: 3 }}>
          This event is published and cannot be edited. Cancel it first if changes are needed.
        </Alert>
        <Button variant="contained" component={RouterLink} to={`/organizer/events/${event.id}`} sx={{ ...orgPrimaryButtonSx }}>
          View Event
        </Button>
      </OrganizerShell>
    );
  }

  return (
    <OrganizerShell title={step === 1 ? '' : (isEdit ? 'Edit Event' : 'Create Event')} subtitle={step === 1 ? '' : (isEdit ? 'Update your event details.' : 'Set up a new event for registrations.')} hideSearch hideCreate>
      {step === 1 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Event Details
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>→</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main' }}>
            Registration Form
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>→</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            Preview & Publish
          </Typography>
        </Box>
      ) : (
        <Stepper activeStep={step} sx={{ mb: 4, overflowX: 'auto' }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {step === 0 && (
        <Card variant="outlined" sx={{ ...orgCardSx, maxWidth: 720 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 }, ...orgFormFieldSx }}>
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
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>Event Images (optional)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add a wide banner (16:9) for the event page and a square (1:1) image for event cards.
            </Typography>
            {event?.posterRectangleUrl && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Banner (16:9)</Typography>
                <Box component="img" src={event.posterRectangleUrl} alt="Event banner"
                  sx={{ width: '100%', maxWidth: 480, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'block', mt: 0.5 }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Button variant="outlined" component="label" size="small" disabled={!event && !isEdit}>
                Choose Banner (16:9)
                <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => setRectFile(e.target.files?.[0] || null)} />
              </Button>
              {rectFile && <Typography variant="body2">{rectFile.name}</Typography>}
              {rectFile && event && (
                <Button size="small" variant="contained" onClick={() => uploadPoster('rectangle')} disabled={posterBusy !== null} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                  {posterBusy === 'rectangle' ? 'Uploading…' : 'Upload Banner'}
                </Button>
              )}
            </Box>
            {event?.posterSquareUrl && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">Square (1:1)</Typography>
                <Box component="img" src={event.posterSquareUrl} alt="Event square poster"
                  sx={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'block', mt: 0.5 }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="outlined" component="label" size="small" disabled={!event && !isEdit}>
                Choose Square (1:1)
                <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => setSquareFile(e.target.files?.[0] || null)} />
              </Button>
              {squareFile && <Typography variant="body2">{squareFile.name}</Typography>}
              {squareFile && event && (
                <Button size="small" variant="contained" onClick={() => uploadPoster('square')} disabled={posterBusy !== null} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                  {posterBusy === 'square' ? 'Uploading…' : 'Upload Square'}
                </Button>
              )}
              {!event && !isEdit && (
                <Typography variant="body2" color="text.secondary">Save the draft first to upload images.</Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" size="large" onClick={saveDraft} disabled={busy} sx={{ ...orgPrimaryButtonSx, px: 4 }}>
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
          onBack={() => setStep(0)}
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
            <Card variant="outlined" sx={{ ...orgCardSx, mb: 3 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <RegistrationFlow
                  formStructure={structure}
                  onSubmit={() => setPreviewSubmitted(true)}
                  isSubmitting={false}
                  eventId={event?.id || editId || 'preview'}
                  event={{ eventName: details.eventName || event?.eventName }}
                  previewMode
                />
              </CardContent>
            </Card>
          ) : (
            <Alert severity="warning" sx={{ mb: 3 }}>Save the registration form first to preview it.</Alert>
          )}

          <Card variant="outlined" sx={{ ...orgCardSx }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Publish</Typography>
                <Chip label={event?.status || 'DRAFT'} color={event?.status === 'PUBLISHED' ? 'success' : 'default'} variant="outlined" />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={() => setStep(1)} disabled={busy} sx={{ ...orgSmallButtonSx, fontSize: 13, padding: '6px 16px' }}>Back</Button>
                {event?.status === 'DRAFT' && (
                  <Button variant="contained" onClick={() => doTransition((id) => eventsApi.preview(id))} disabled={busy} sx={{ ...orgPrimaryButtonSx }}>
                    {busy ? 'Working…' : 'Move to Preview'}
                  </Button>
                )}
                {event?.status === 'PREVIEW' && (
                  <Button variant="contained" color="success" onClick={() => doTransition((id) => eventsApi.publish(id))} disabled={busy} sx={{ ...orgPrimaryButtonSx }}>
                    {busy ? 'Publishing…' : 'Publish Event'}
                  </Button>
                )}
                {event?.status === 'PUBLISHED' && (
                  <Button variant="contained" component={RouterLink} to={`/organizer/events/${event.id}`} sx={{ ...orgPrimaryButtonSx }}>
                    View Event
                  </Button>
                )}
                {event && event.status !== 'CANCELLED' && event.status !== 'PUBLISHED' && (
                  <Button variant="text" color="error" onClick={() => setConfirmCancel(true)} disabled={busy} sx={{ ...orgSmallButtonSx, fontSize: 13 }}>
                    Cancel Event
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
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this event?"
        description="The event will be marked CANCELLED and participants will no longer see it. This cannot be undone."
        confirmLabel="Cancel Event"
        busy={busy}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={doCancel}
      />
    </OrganizerShell>
  );
}

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
