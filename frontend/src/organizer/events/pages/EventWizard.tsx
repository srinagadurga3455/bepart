import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, CircularProgress, Collapse, Divider,
  FormControlLabel, InputAdornment, Radio, RadioGroup,
  Step, StepLabel, Stepper, Switch, Tab, Tabs, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { ArrowBack, CheckCircleOutlined, UploadFileOutlined, WhatsApp as WhatsAppIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { eventsApi, couponsApi } from '../api/events';
import OrganizerShell from '../../components/OrganizerShell';
import {
  orgCardSx,
  orgFormFieldSx,
  orgPrimaryButtonSx,
  orgSmallButtonSx,
} from '../../components/organizerStyles';
import RequireRole from '../../../auth/components/RequireRole';
import FormBuilder from '../components/FormBuilder';
import ChooseTemplate from '../components/ChooseTemplate';
import { toBuilderForm, toFormStructure } from '../utils/formBuilderUtils';
import type { BuilderForm } from '../utils/formBuilderUtils';
import RegistrationFlow from '../../../participant/registrations/components/RegistrationFlow';
import type { CouponItem, EventItem, EventPayload, FormDataRecord, FormSettings, FormStructure, FormTheme } from '../../../app/types';
import FormSettingsPanel from '../components/FormSettingsPanel';
import { StyleControls } from '../components/BuilderStylePanel';
import { nextMinuteLocalInputValue, parseLocalDateTime, toLocalDateInputValue } from '../../../app/utils/validators';

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
  whatsappGroupLink: string;
}

interface CouponConfig {
  enabled: boolean;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: string;
  usageLimit: string;
  expiresAt: string;
  isActive: boolean;
}

const DEFAULT_COUPON: CouponConfig = {
  enabled: false,
  code: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  usageLimit: '',
  expiresAt: '',
  isActive: true,
};

export function EventWizardInner({ editId }: { editId?: string }) {
  const isEdit = !!editId;
  const [step, setStep] = useState(0);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [structure, setStructure] = useState<FormStructure | null>(null);
  // Live registration-form draft: updated by FormBuilder on every change so
  // Back/forward navigation (which remounts the builder) never loses edits.
  const [builderDraft, setBuilderDraft] = useState<BuilderForm | null>(null);
  // Organizer preview NEVER creates a registration: the participant flow's
  // submit handler below is an explicit no-op (a Registration record is only
  // created when a real participant submits the published event's form).
  const noopPreviewSubmit = (_formData: FormDataRecord) => {
    void _formData;
  };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);


  const [details, setDetails] = useState<WizardDetails>({
    eventName: '', description: '', date: '', time: '', deadline: '', slots: 100, paymentType: 'free', feeAmount: '',
    whatsappGroupLink: '',
  });

  // Image upload state
  const [squareFile, setSquareFile] = useState<File | null>(null);
  const [rectFile, setRectFile] = useState<File | null>(null);
  const [posterBusy, setPosterBusy] = useState<null | 'square' | 'rectangle' | 'remove-square' | 'remove-rectangle'>(null);
  const [posterError, setPosterError] = useState('');

  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const pickImageFile = (file: File | undefined, setFile: (f: File | null) => void) => {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/.test(file.type)) {
      setPosterError(`Invalid file type. Allowed: JPG, PNG, WebP (got ${file.type || 'unknown'}).`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setPosterError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum 5 MB.`);
      return;
    }
    setPosterError('');
    setFile(file);
  };

  // Coupon state
  const [coupon, setCoupon] = useState<CouponConfig>({ ...DEFAULT_COUPON });
  const [savedCoupon, setSavedCoupon] = useState<CouponItem | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Field-level date errors shown inline under the offending input.
  const [fieldErrors, setFieldErrors] = useState<{ eventStart?: string; deadline?: string; couponExpiry?: string; groupLink?: string }>({});

  // Template selection state
  const [templateChosen, setTemplateChosen] = useState(false);

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
      whatsappGroupLink: ev.whatsappGroupLink || '',
      paymentType: ev.paymentRequired ? 'paid' : 'free',
      feeAmount: ev.paymentRequired && ev.formStructure?.payment?.amount != null
        ? String(ev.formStructure.payment.amount)
        : '',
    });
    setStructure(ev.formStructure || null);
    setBuilderDraft(toBuilderForm(ev.formStructure));
    setTemplateChosen(true);
    if (ev.hasCoupon) {
      setCoupon((prev) => ({ ...prev, enabled: true }));
      // Load the existing coupon(s) so the code stays visible after refresh
      // and the organizer is never offered a duplicate create.
      couponsApi.list(ev.id).then(
        (res) => {
          const first = Array.isArray(res.data) && res.data.length > 0 ? res.data[0] : null;
          if (first) setSavedCoupon(first);
        },
        () => { /* keep the toggle on; create stays hidden until the list loads */ },
      );
    }
  }, [loaded]);

  const fail = (err: unknown, fallback: string, context?: string) => {
    const axiosErr = axios.isAxiosError(err) ? err : null;
    console.error('BEPART REQUEST FAILED', {
      context,
      status: axiosErr?.response?.status,
      data: axiosErr?.response?.data,
      error: err,
    });
    const backendMessage: unknown = axiosErr?.response?.data && typeof axiosErr.response.data === 'object'
      ? (axiosErr.response.data as { message?: unknown }).message
      : undefined;
    return (
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

  /** Validation failure tied to a specific form field (rendered inline). */
  class FieldValidationError extends Error {
    field: 'eventStart' | 'deadline' | 'couponExpiry' | 'groupLink';
    constructor(field: FieldValidationError['field'], message: string) {
      super(message);
      this.field = field;
    }
  }

  const buildDetailsPayload = (): EventPayload => {
    if (!details.eventName.trim()) throw new Error('Event name is required.');
    if (!details.date || !details.time) {
      throw new FieldValidationError('eventStart', 'Event date and time are required.');
    }
    if (!details.deadline) {
      throw new FieldValidationError('deadline', 'Registration deadline is required.');
    }
    // Explicit local-component parsing: datetime-local values carry no
    // timezone, and `new Date(string)` interprets them inconsistently across
    // browsers. Epoch-ms comparisons below are timezone-safe; toISOString()
    // then stores the correct UTC instant.
    const startMs = parseLocalDateTime(`${details.date}T${details.time}:00`);
    const closingMs = parseLocalDateTime(details.deadline);
    if (startMs === null || closingMs === null) {
      throw new FieldValidationError('eventStart', 'Invalid date or time.');
    }
    const now = Date.now();
    if (startMs <= now) {
      throw new FieldValidationError('eventStart', 'Event date and time must be in the future.');
    }
    if (closingMs <= now) {
      throw new FieldValidationError('deadline', 'Registration deadline must be in the future.');
    }
    if (closingMs >= startMs) {
      throw new FieldValidationError('deadline', 'Registration deadline must be before the event starts.');
    }
    const slots = parseInt(String(details.slots), 10);
    if (!Number.isFinite(slots) || slots < 1) throw new Error('Capacity must be at least 1.');
    if (details.paymentType === 'paid') parseFeeAmount();
    // Optional group link: empty clears it (backend stores null), a value
    // must be an http(s) URL (backend re-validates with @IsUrl).
    const groupLink = details.whatsappGroupLink.trim();
    if (groupLink && !/^https?:\/\/.+\..+/.test(groupLink)) {
      throw new FieldValidationError('groupLink', 'Enter a valid URL starting with http:// or https:// (e.g. https://chat.whatsapp.com/...).');
    }
    return {
      eventName: details.eventName.trim(),
      description: details.description.trim() || undefined,
      date: new Date(startMs).toISOString(),
      slots,
      closingTime: new Date(closingMs).toISOString(),
      paymentRequired: details.paymentType === 'paid',
      whatsappGroupLink: groupLink ? groupLink : null,
    };
  };

  // Auto-save draft (transparent) — used before image upload when event doesn't exist yet.
  const ensureEventSaved = async (): Promise<EventItem> => {
    if (event) return event;
    const payload = buildDetailsPayload();
    if (isEdit && structure) payload.formStructure = withPaymentConfig(structure);
    const res = isEdit ? await eventsApi.update(editId!, payload) : await eventsApi.create(payload);
    const saved = res.data;
    setEvent(saved);
    if (!builderDraft) setBuilderDraft(toBuilderForm(saved.formStructure));
    return saved;
  };

  /** Validated + normalized coupon fields. Expiry is converted to a UTC ISO
   *  string here: datetime-local carries no timezone, and a raw wall-time
   *  string would be interpreted in the SERVER's timezone (wrong instant on a
   *  UTC host). The API/DB contract is UTC ISO throughout. */
  interface ValidCouponConfig {
    discountValue: number;
    code?: string;
    expiresAtIso?: string;
    usageLimit?: number;
  }

  const validateCouponConfig = (): ValidCouponConfig => {
    const dv = Number(coupon.discountValue);
    if (!coupon.discountValue || !Number.isFinite(dv) || dv <= 0) {
      throw new Error('Coupon: discount value is required and must be greater than 0.');
    }
    if (coupon.discountType === 'PERCENTAGE' && dv > 100) {
      throw new Error('Coupon: percentage discount cannot exceed 100.');
    }
    if (coupon.code.trim() && !/^[A-Z0-9_-]{3,32}$/.test(coupon.code.trim().toUpperCase())) {
      throw new Error('Coupon: code must be 3-32 chars — letters, digits, - or _.');
    }
    let expiresAtIso: string | undefined;
    if (coupon.expiresAt) {
      // Same explicit local parsing as event dates: the datetime-local value
      // is the organizer's local time, compared as epoch-ms timestamps.
      const expMs = parseLocalDateTime(coupon.expiresAt);
      if (expMs === null) throw new FieldValidationError('couponExpiry', 'Coupon: expiry date is invalid.');
      if (expMs <= Date.now()) throw new FieldValidationError('couponExpiry', 'Coupon expiry must be in the future.');
      expiresAtIso = new Date(expMs).toISOString();
    }
    let usageLimit: number | undefined;
    if (coupon.usageLimit) {
      const n = parseInt(coupon.usageLimit, 10);
      if (!Number.isInteger(n) || n < 1) throw new Error('Coupon: usage limit must be at least 1.');
      usageLimit = n;
    }
    return {
      discountValue: dv,
      ...(coupon.code.trim() ? { code: coupon.code.trim().toUpperCase() } : {}),
      ...(expiresAtIso ? { expiresAtIso } : {}),
      ...(usageLimit !== undefined ? { usageLimit } : {}),
    };
  };

  const saveDraft = async () => {
    setError('');
    setFieldErrors({});
    setBusy(true);
    try {
      // Validate coupon config BEFORE creating the event so an invalid
      // discount can never leave behind a coupon-less orphan event.
      if (coupon.enabled && !savedCoupon) validateCouponConfig();

      const payload = buildDetailsPayload();
      if (isEdit && structure) payload.formStructure = withPaymentConfig(structure);

      const res = isEdit ? await eventsApi.update(editId!, payload) : await eventsApi.create(payload);
      const saved = res.data;
      setEvent(saved);
      if (payload.formStructure) setStructure(payload.formStructure);
      if (!builderDraft) {
        setBuilderDraft(toBuilderForm(saved.formStructure));
        if (!payload.formStructure) setStructure(saved.formStructure || null);
      }

      // Draft-first coupon flow: the event now exists, so create the coupon
      // with its ID. No orphan coupons are possible, and a failure keeps the
      // organizer on this step with a retry action.
      if (coupon.enabled && !savedCoupon && saved.id) {
        const ok = await createCouponForEvent(saved.id);
        if (!ok) return;
      }

      setStep(1);
    } catch (err) {
      if (err instanceof FieldValidationError) {
        setFieldErrors((prev) => ({ ...prev, [err.field]: err.message }));
      }
      setError(fail(err, 'Could not save event details.', 'saveDraft'));
    } finally {
      setBusy(false);
    }
  };

  const createCouponForEvent = async (eventId: string): Promise<boolean> => {
    setCouponBusy(true);
    setCouponError('');
    try {
      const valid = validateCouponConfig();
      const res = await couponsApi.create({
        eventId,
        discountType: coupon.discountType,
        discountValue: valid.discountValue,
        isActive: coupon.isActive,
        usageLimit: valid.usageLimit,
        expiresAt: valid.expiresAtIso,
        ...(valid.code ? { code: valid.code } : {}),
      });
      setSavedCoupon(res.data);
      return true;
    } catch (err) {
      if (err instanceof FieldValidationError) {
        setFieldErrors((prev) => ({ ...prev, [err.field]: err.message }));
      }
      setCouponError(fail(err, 'Could not create coupon.', 'createCoupon'));
      return false;
    } finally {
      setCouponBusy(false);
    }
  };

  const randomCouponCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let suffix = '';
    for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
    setCoupon({ ...coupon, code: `EVENT-${suffix}` });
  };

  // Upload poster — auto-saves event first if needed so we always have an ID.
  const uploadPoster = async (kind: 'square' | 'rectangle') => {
    const file = kind === 'square' ? squareFile : rectFile;
    if (!file) return;
    setPosterError('');
    setPosterBusy(kind);
    try {
      const ev = await ensureEventSaved();
      if (kind === 'square') {
        const res = await eventsApi.uploadPosterSquare(ev.id, file);
        setEvent((prev) => prev ? { ...prev, posterSquareUrl: res.data.posterSquareUrl } : { ...ev, posterSquareUrl: res.data.posterSquareUrl });
        setSquareFile(null);
      } else {
        const res = await eventsApi.uploadPosterRectangle(ev.id, file);
        setEvent((prev) => prev ? { ...prev, posterRectangleUrl: res.data.posterRectangleUrl } : { ...ev, posterRectangleUrl: res.data.posterRectangleUrl });
        setRectFile(null);
      }
    } catch (err) {
      if (err instanceof FieldValidationError) {
        setFieldErrors((prev) => ({ ...prev, [err.field]: err.message }));
      }
      setPosterError(fail(err, kind === 'square' ? 'Square poster upload failed (needs a 1:1 image).' : 'Banner upload failed (needs a 16:9 landscape image).', 'uploadPoster'));
    } finally {
      setPosterBusy(null);
    }
  };

  // Remove poster — clears the stored URL and deletes the stored object.
  const removePoster = async (kind: 'square' | 'rectangle') => {
    const current = event;
    if (!current) return;
    const busyKey = kind === 'square' ? 'remove-square' : 'remove-rectangle';
    setPosterError('');
    setPosterBusy(busyKey);
    try {
      if (kind === 'square') {
        await eventsApi.removePosterSquare(current.id);
        setEvent((prev) => (prev ? { ...prev, posterSquareUrl: null } : prev));
      } else {
        await eventsApi.removePosterRectangle(current.id);
        setEvent((prev) => (prev ? { ...prev, posterRectangleUrl: null } : prev));
      }
    } catch (err) {
      setPosterError(fail(err, 'Could not remove the image. Please try again.', 'removePoster'));
    } finally {
      setPosterBusy(null);
    }
  };

  const saveForm = async (formStructure: FormStructure) => {
    if (!event) return;
    setError('');
    setBusy(true);
    try {
      const merged = withPaymentConfig({ ...formStructure });
      const res = await eventsApi.update(event.id, { formStructure: merged });
      setEvent(res.data);
      setStructure(merged);
      setStep(2);
    } catch (err) {
      setError(fail(err, 'Could not save the registration form.'));
    } finally {
      setBusy(false);
    }
  };

  // ── Preview & Publish Style/Settings panel: the SAME shared component as
  // the FormBuilder sidebar, bound to the same live draft. Preview
  // saves first, so the panel opens with the exact saved configuration; any
  // tweak here updates the draft and the participant preview instantly, and
  // is persisted again before Publish (what you see is what publishes). ──
  const [previewTab, setPreviewTab] = useState<'style' | 'settings'>('style');

  const updatePreviewTheme = (patch: Partial<FormTheme>) => {
    setBuilderDraft((prev) => (prev ? { ...prev, theme: { ...(prev.theme || {}), ...patch } } : prev));
  };
  const updatePreviewSettings = (settings: FormSettings) => {
    setBuilderDraft((prev) => (prev ? { ...prev, settings } : prev));
  };

  // Participant preview renders the live draft (identical to the saved
  // structure right after Move to Preview). Payment config has no builder
  // model, so it is carried over from the saved structure.
  const liveStructure: FormStructure | null = useMemo(() => {
    if (!builderDraft) return structure;
    try {
      const built = toFormStructure(builderDraft);
      if (structure?.payment) built.payment = structure.payment;
      return built;
    } catch {
      return structure;
    }
  }, [builderDraft, structure]);
  const previewFlowStructure = liveStructure ?? structure;

  const persistPreviewDraft = async (): Promise<boolean> => {
    if (!event) return false;
    if (!liveStructure) return true;
    setError('');
    setBusy(true);
    try {
      const res = await eventsApi.update(event.id, { formStructure: liveStructure });
      setEvent(res.data);
      setStructure(liveStructure);
      return true;
    } catch (err) {
      setError(fail(err, 'Could not save the registration form.'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Publish only runs after the organizer confirms the participant preview.
  // Backend status rules are preserved: DRAFT → PREVIEW → PUBLISHED are
  // executed in order (the old footer status button is gone, so the DRAFT
  // hop happens here transparently before publishing).
  const publishWithDraft = async () => {
    if (!event) return;
    const ok = await persistPreviewDraft();
    if (!ok) return;
    setError('');
    setBusy(true);
    try {
      let status = event.status;
      if (status === 'DRAFT') {
        status = (await eventsApi.preview(event.id)).data.status;
      }
      if (status !== 'PREVIEW') throw new Error('Move the event to preview before publishing.');
      const res = await eventsApi.publish(event.id);
      setEvent(res.data);
    } catch (err) {
      setError(fail(err, 'Action failed.', 'publish'));
    } finally {
      setBusy(false);
    }
  };

  if (isEdit && loadingEvent) {
    return (
      <OrganizerShell title="Edit Event" hideSearch hideCreate>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      </OrganizerShell>
    );
  }

  return (
    <OrganizerShell
      title={step === 1 ? '' : (isEdit ? 'Edit Event' : 'Create Event')}
      subtitle={step === 1 ? '' : (isEdit ? 'Update your event details.' : 'Set up a new event for registrations.')}
      hideSearch hideCreate
    >
      {step === 1 ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Event Details</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>→</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main' }}>Registration Form</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.disabled' }}>→</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>Preview & Publish</Typography>
        </Box>
      ) : (
        <Stepper activeStep={step} sx={{ mb: 4, overflowX: 'auto' }}>
          {STEPS.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

      {/* ─── STEP 0: Event Details ─────────────────────────────── */}
      {step === 0 && (
        <Card variant="outlined" sx={{ ...orgCardSx, maxWidth: 720 }}>
          <CardContent sx={{ p: { xs: 2, md: 3 }, ...orgFormFieldSx }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Event Details</Typography>

            <TextField label="Event Name" placeholder="e.g. Udbhav Hackathon 2026" value={details.eventName}
              onChange={(e) => setDetails({ ...details, eventName: e.target.value })} fullWidth size="small" sx={{ mb: 2 }} />
            <TextField label="Description" placeholder="What is this event about?" value={details.description}
              onChange={(e) => setDetails({ ...details, description: e.target.value })} fullWidth size="small" multiline rows={3} sx={{ mb: 2 }} />
            <TextField label="WhatsApp Group Link" placeholder="https://chat.whatsapp.com/..."
              value={details.whatsappGroupLink}
              onChange={(e) => { setDetails({ ...details, whatsappGroupLink: e.target.value }); setFieldErrors((p) => ({ ...p, groupLink: undefined })); }}
              fullWidth size="small" error={!!fieldErrors.groupLink}
              helperText={fieldErrors.groupLink || 'Optional — add the official WhatsApp group where participants can receive event announcements and updates.'}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} /></InputAdornment> } }}
              sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: fieldErrors.eventStart ? 1 : 2 }}>
              <TextField label="Date" type="date" value={details.date}
                onChange={(e) => { setDetails({ ...details, date: e.target.value }); setFieldErrors((p) => ({ ...p, eventStart: undefined })); }}
                size="small" error={!!fieldErrors.eventStart}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: toLocalDateInputValue(new Date()) } }}
                sx={{ flex: '1 1 160px' }} />
              <TextField label="Time" type="time" value={details.time}
                onChange={(e) => { setDetails({ ...details, time: e.target.value }); setFieldErrors((p) => ({ ...p, eventStart: undefined })); }}
                size="small" error={!!fieldErrors.eventStart}
                slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: '1 1 160px' }} />
            </Box>
            {fieldErrors.eventStart && (
              <Typography sx={{ fontSize: 12, color: 'error.main', mb: 2 }}>{fieldErrors.eventStart}</Typography>
            )}
            <TextField label="Registration Deadline" type="datetime-local" value={details.deadline}
              onChange={(e) => { setDetails({ ...details, deadline: e.target.value }); setFieldErrors((p) => ({ ...p, deadline: undefined })); }}
              fullWidth size="small" error={!!fieldErrors.deadline} helperText={fieldErrors.deadline || 'Must be in the future and before the event starts.'}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: nextMinuteLocalInputValue() } }} sx={{ mb: 2 }} />
            <TextField label="Capacity (slots)" type="number" value={details.slots}
              onChange={(e) => setDetails({ ...details, slots: e.target.value })}
              size="small" slotProps={{ htmlInput: { min: 1 } }} sx={{ mb: 2, width: 220 }} />

            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>Registration Type</Typography>
            <RadioGroup row value={details.paymentType} onChange={(e) => setDetails({ ...details, paymentType: e.target.value })}
              sx={{ mb: details.paymentType === 'paid' ? 2 : 0 }}>
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

            {/* ── Coupon Section ── */}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Do you want to enable coupons?</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                  Offer a discount code for this event
                </Typography>
              </Box>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={coupon.enabled ? 'yes' : 'no'}
                disabled={!!savedCoupon}
                onChange={(_e, v) => {
                  if (v === null) return;
                  setCoupon({ ...coupon, enabled: v === 'yes' });
                  setCouponError('');
                }}
                aria-label="Enable coupons"
                sx={{
                  '& .MuiToggleButton-root': { px: 2.5, fontWeight: 700, textTransform: 'none' },
                  '& .Mui-selected': { bgcolor: 'primary.main', color: '#fff', '&:hover': { bgcolor: 'primary.dark' } },
                }}
              >
                <ToggleButton value="no">No</ToggleButton>
                <ToggleButton value="yes">Yes</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Collapse in={coupon.enabled}>
              {savedCoupon ? (
                <Box sx={{ bgcolor: 'success.50', border: '1px solid', borderColor: 'success.light', borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CheckCircleOutlined color="success" />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>Coupon created successfully</Typography>
                    <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>
                      Code: <Box component="span" sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'text.primary', letterSpacing: '0.08em' }}>{savedCoupon.code}</Box>
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ bgcolor: 'grey.50', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, mt: 1 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <TextField
                        label="Coupon code (optional)"
                        placeholder="e.g. FEST20 (auto-generated if blank)"
                        value={coupon.code}
                        onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                        size="small"
                        fullWidth
                        slotProps={{ htmlInput: { maxLength: 32 } }}
                        helperText="Leave blank to auto-generate"
                      />
                      <Button variant="outlined" size="small" onClick={randomCouponCode} sx={{ mt: 0.25, flexShrink: 0, ...orgSmallButtonSx }}>
                        Generate
                      </Button>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: 'text.secondary', mb: 0.75 }}>DISCOUNT TYPE</Typography>
                      <RadioGroup row value={coupon.discountType} onChange={(e) => setCoupon({ ...coupon, discountType: e.target.value as 'PERCENTAGE' | 'FIXED' })}>
                        <FormControlLabel value="PERCENTAGE" control={<Radio size="small" />} label="Percentage (%)" />
                        <FormControlLabel value="FIXED" control={<Radio size="small" />} label="Fixed (₹)" />
                      </RadioGroup>
                    </Box>
                    <TextField
                      label={coupon.discountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (₹)'}
                      type="number"
                      value={coupon.discountValue}
                      onChange={(e) => setCoupon({ ...coupon, discountValue: e.target.value })}
                      size="small"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              {coupon.discountType === 'PERCENTAGE' ? '%' : '₹'}
                            </InputAdornment>
                          ),
                        },
                        htmlInput: { min: 0.01, max: coupon.discountType === 'PERCENTAGE' ? 100 : undefined, step: 'any' },
                      }}
                    />
                    <TextField
                      label="Usage limit (optional)"
                      type="number"
                      placeholder="e.g. 100"
                      value={coupon.usageLimit}
                      onChange={(e) => setCoupon({ ...coupon, usageLimit: e.target.value })}
                      size="small"
                      slotProps={{ htmlInput: { min: 1 } }}
                      helperText="Max number of redemptions"
                    />
                    <TextField
                      label="Expiry date/time (optional)"
                      type="datetime-local"
                      value={coupon.expiresAt}
                      onChange={(e) => { setCoupon({ ...coupon, expiresAt: e.target.value }); setFieldErrors((p) => ({ ...p, couponExpiry: undefined })); }}
                      size="small"
                      error={!!fieldErrors.couponExpiry}
                      helperText={fieldErrors.couponExpiry || 'Must be in the future.'}
                      slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: nextMinuteLocalInputValue() } }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <FormControlLabel
                        control={
                          <Switch size="small" checked={coupon.isActive} onChange={(e) => setCoupon({ ...coupon, isActive: e.target.checked })} />
                        }
                        label="Active"
                      />
                    </Box>
                  </Box>
                  {couponError && (
                    <Alert
                      severity="error"
                      sx={{ mt: 1.5 }}
                      onClose={() => setCouponError('')}
                      action={event ? (
                        <Button color="inherit" size="small" onClick={() => createCouponForEvent(event.id)} disabled={couponBusy}>
                          Retry
                        </Button>
                      ) : undefined}
                    >
                      {couponError}
                    </Alert>
                  )}
                  {event && (
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => createCouponForEvent(event.id)}
                      disabled={couponBusy}
                      sx={{ mt: 1.5, ...orgSmallButtonSx }}
                    >
                      {couponBusy ? 'Creating…' : couponError ? 'Retry Create Coupon' : 'Create Coupon'}
                    </Button>
                  )}
                  {!event && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, fontSize: 12.5 }}>
                      The coupon will be created right after you save the event details.
                    </Typography>
                  )}
                </Box>
              )}
            </Collapse>

            {/* ── Event Images ── */}
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>Event Images (optional)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add a wide banner (16:9) for the event page and a square (1:1) image for event cards.
            </Typography>

            {posterError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPosterError('')}>{posterError}</Alert>
            )}

            {/* Banner (16:9) */}
            {event?.posterRectangleUrl && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Banner (16:9)</Typography>
                <Box component="img" src={event.posterRectangleUrl} alt="Event banner"
                  sx={{ width: '100%', maxWidth: 480, borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'block', mt: 0.5 }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
              <Button variant="outlined" component="label" size="small" startIcon={<UploadFileOutlined fontSize="small" />} disabled={posterBusy !== null}>
                {event?.posterRectangleUrl ? 'Replace Banner (16:9)' : 'Choose Banner (16:9)'}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => pickImageFile(e.target.files?.[0], setRectFile)} />
              </Button>
              {rectFile && (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>{rectFile.name}</Typography>
              )}
              {rectFile && (
                <Button size="small" variant="contained" onClick={() => uploadPoster('rectangle')}
                  disabled={posterBusy !== null} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                  {posterBusy === 'rectangle' ? 'Uploading…' : 'Upload Banner'}
                </Button>
              )}
              {event?.posterRectangleUrl && (
                <Button size="small" color="error" onClick={() => removePoster('rectangle')}
                  disabled={posterBusy !== null} sx={{ ...orgSmallButtonSx }}>
                  {posterBusy === 'remove-rectangle' ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </Box>

            {/* Square (1:1) */}
            {event?.posterSquareUrl && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">Square (1:1)</Typography>
                <Box component="img" src={event.posterSquareUrl} alt="Event square poster"
                  sx={{ width: 180, height: 180, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'block', mt: 0.5 }} />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button variant="outlined" component="label" size="small" startIcon={<UploadFileOutlined fontSize="small" />} disabled={posterBusy !== null}>
                {event?.posterSquareUrl ? 'Replace Square (1:1)' : 'Choose Square (1:1)'}
                <input type="file" hidden accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => pickImageFile(e.target.files?.[0], setSquareFile)} />
              </Button>
              {squareFile && (
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 12 }}>{squareFile.name}</Typography>
              )}
              {squareFile && (
                <Button size="small" variant="contained" onClick={() => uploadPoster('square')}
                  disabled={posterBusy !== null} sx={{ ...orgSmallButtonSx, boxShadow: 'none' }}>
                  {posterBusy === 'square' ? 'Uploading…' : 'Upload Square'}
                </Button>
              )}
              {event?.posterSquareUrl && (
                <Button size="small" color="error" onClick={() => removePoster('square')}
                  disabled={posterBusy !== null} sx={{ ...orgSmallButtonSx }}>
                  {posterBusy === 'remove-square' ? 'Removing…' : 'Remove'}
                </Button>
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontSize: 12 }}>
              Images upload immediately and stay saved on the event. The event draft is created automatically if needed — no manual save required.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="contained" size="large" onClick={saveDraft} disabled={busy} sx={{ ...orgPrimaryButtonSx, px: 4 }}>
                {busy ? 'Saving…' : isEdit ? 'Save & Continue' : 'Save Draft & Continue'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ─── STEP 1: Registration Form ─────────────────────────── */}
      {step === 1 && !templateChosen && (
        <Card variant="outlined" sx={{ ...orgCardSx }}>
          <CardContent sx={{ p: { xs: 2, md: 3 } }}>
            <ChooseTemplate
              eventName={details.eventName || event?.eventName}
              onBack={() => {
                if (isEdit || builderDraft) setTemplateChosen(true);
                else setStep(0);
              }}
              backLabel={isEdit || builderDraft ? 'Back to form' : 'Back'}
              onSelect={(form, settings) => {
                setBuilderDraft({ ...form, settings });
                setTemplateChosen(true);
              }}
            />
          </CardContent>
        </Card>
      )}

      {step === 1 && templateChosen && builderDraft && (
        <FormBuilder
          initial={builderDraft}
          saving={busy}
          onSave={saveForm}
          onBack={() => setStep(0)}
          onChangeTemplate={() => setTemplateChosen(false)}
          onChange={(draft) => setBuilderDraft(draft)}
        />
      )}

      {/* ─── STEP 2: Preview & Publish ─────────────────────────── */}
      {step === 2 && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
          <Alert severity="info" sx={{ mb: 3 }}>
            Participant preview — exactly what participants will see.
          </Alert>
          {/* Preview header: Back to the form on the left, the single Publish
              action on the right. Publishing only happens on click — never on
              entering Preview — and never creates a registration. */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 3 }}>
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowBack fontSize="small" />}
              onClick={() => setStep(1)}
              disabled={busy}
              sx={{ color: 'text.secondary' }}
            >
              Back to Registration Form
            </Button>
            {(event?.status === 'DRAFT' || event?.status === 'PREVIEW') && (
              <Button variant="contained" color="success" onClick={publishWithDraft} disabled={busy} sx={{ ...orgPrimaryButtonSx }}>
                {busy ? 'Publishing…' : 'Publish Event'}
              </Button>
            )}
            {event?.status === 'PUBLISHED' && (
              <Button variant="contained" component={RouterLink} to={`/organizer/events/${event.id}`} sx={{ ...orgPrimaryButtonSx }}>
                View Event
              </Button>
            )}
          </Box>
          {event?.status === 'PUBLISHED' && (
            <Alert severity="success" sx={{ mb: 3 }}>
              Event published successfully
            </Alert>
          )}
          {previewFlowStructure ? (
            <Card variant="outlined" sx={{ ...orgCardSx, mb: 3 }}>
              <CardContent sx={{ p: { xs: 2, md: 3 } }}>
                <RegistrationFlow
                  formStructure={previewFlowStructure}
                  onSubmit={noopPreviewSubmit}
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
          </Box>

          {/* ── Style/Settings sidebar: the SAME shared panel component as the
              FormBuilder (Style tab with Upload Image, Typography, Theme +
              Settings tab), bound to the same live draft. Opens with the
              exact saved configuration; edits reflect in the participant
              preview instantly. Sticky with its own scroll; hidden on smaller
              screens where content stacks. ── */}
          <Card
            variant="outlined"
            sx={{
              ...orgCardSx, width: 300, flexShrink: 0,
              display: { xs: 'none', lg: 'flex' }, flexDirection: 'column',
              position: 'sticky', top: 16,
              maxHeight: 'calc(100vh - 32px)',
            }}
          >
            <Tabs
              value={previewTab}
              onChange={(_e, v) => { if (v) setPreviewTab(v); }}
              sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 40, px: 1 }}
            >
              <Tab value="style" label="Style" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40, py: 0.5 }} />
              <Tab value="settings" label="Settings" sx={{ fontSize: 12, fontWeight: 700, minHeight: 40, py: 0.5 }} />
            </Tabs>
            <Box sx={{ flex: 1, p: 2, overflowY: 'auto', minHeight: 0 }}>
              {previewTab === 'settings' ? (
                <FormSettingsPanel settings={builderDraft?.settings || {}} onChange={updatePreviewSettings} />
              ) : (
                <StyleControls theme={builderDraft?.theme} onThemeChange={updatePreviewTheme} />
              )}
            </Box>
          </Card>
        </Box>
      )}

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
