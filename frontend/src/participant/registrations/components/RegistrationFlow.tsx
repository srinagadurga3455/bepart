import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { BaseSyntheticEvent } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { Box, Typography, Button, Divider, Alert, Stack, Chip } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { KeyboardArrowLeft, KeyboardArrowRight, LockOutlined } from '@mui/icons-material';
import { useAuth } from '../../../auth/components/RequireRole';
import ProgressIndicator from './ProgressIndicator';
import FormSection from './FormSection';
import ReviewStep from './ReviewStep';
import PaymentStep, { type PaidRegistrationArgs } from './PaymentStep';
import {
  findCountFieldName,
  getSelectedCount,
  getVisibleFields,
  withDynamicRequired,
  stripHiddenMemberValues,
} from '../utils/memberGroups';
import type { FormDataRecord, FormStructure } from '../../../app/types';

/** Minimal event info the flow needs (full EventItem also satisfies this). */
export interface FlowEventInfo {
  eventName?: string;
  paymentRequired?: boolean;
  date?: string;
  closingTime?: string;
  formStructure?: FormStructure | null;
  whatsappGroupLink?: string | null;
}

interface RegistrationFlowProps {
  formStructure: FormStructure;
  onSubmit: (formData: FormDataRecord) => void;
  isSubmitting: boolean;
  eventId: string;
  event?: FlowEventInfo;
  // Organizer preview: renders the payment step as an explanation instead of
  // calling the real payment API with a draft event.
  previewMode?: boolean;
  // Paid-event completion: called ONLY after backend verification confirms
  // PAID. The parent creates the registration and shows success.
  onPaymentComplete?: (args: PaidRegistrationArgs) => void;
}

export default function RegistrationFlow({
  formStructure,
  onSubmit,
  isSubmitting,
  eventId,
  event,
  previewMode = false,
  onPaymentComplete,
}: RegistrationFlowProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paidFormData, setPaidFormData] = useState<FormDataRecord | null>(null);

  // Paid events add a payment step after review. Amount lives on the event's
  // own formStructure (payment config), so no new model is involved.
  const isPaidEvent = !!event?.paymentRequired;
  const feeAmount: number | null = isPaidEvent
    ? (formStructure?.payment?.amount ?? event?.formStructure?.payment?.amount ?? null)
    : null;

  const methods = useForm({ mode: 'onChange' });

  // Organizer-configured visual theme (optional, backward-compatible).
  // Applied here so the builder preview AND the real participant flow render
  // identically — one renderer, no separate fake preview.
  const formTheme = formStructure?.theme;
  const themeName = formTheme?.theme || 'light';
  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: { mode: themeName === 'dark' ? 'dark' : 'light', primary: { main: '#2557F5' } },
        typography: { fontFamily: '"DM Sans", sans-serif' },
      }),
    [themeName],
  );
  const FONT_STACKS: Record<string, string | undefined> = {
    default: undefined,
    serif: "Georgia, 'Times New Roman', serif",
    mono: "ui-monospace, 'Cascadia Code', Menlo, monospace",
  };
  const SIZE_PX: Record<string, number> = { sm: 13, md: 15, lg: 17 };
  const qFont = formTheme?.questionFont && formTheme.questionFont !== 'default' ? FONT_STACKS[formTheme.questionFont] : undefined;
  const aFont = formTheme?.answerFont && formTheme.answerFont !== 'default' ? FONT_STACKS[formTheme.answerFont] : undefined;
  const qSize = formTheme?.questionSize ? SIZE_PX[formTheme.questionSize] : undefined;
  const aSize = formTheme?.answerSize ? SIZE_PX[formTheme.answerSize] : undefined;

  // Account prefill (honest, minimal): participants normally register WITHOUT
  // a BePart login (OTP login is ADMIN/ORGANIZER only), so name/mobile come
  // from the form itself. But when the visitor IS signed in and their account
  // has a name/phone, prefill matching empty fields and say so visibly —
  // never silently. Values stay editable; nothing is stored twice.
  // Organizer preview NEVER prefills: the preview must show pristine empty
  // fields exactly as a new participant sees them (otherwise the organizer's
  // own account data looks like mock/dummy data in the preview).
  const { user } = useAuth();
  const [prefilled, setPrefilled] = useState<string[]>([]);
  const prefillDone = useRef(false);
  useEffect(() => {
    if (prefillDone.current || !user || previewMode) return;
    const allNames = new Set<string>();
    for (const s of formStructure?.sections || []) {
      for (const f of s.fields || []) allNames.add(f.name);
    }
    const pick = (cands: string[]) => cands.find((c) => allNames.has(c));
    const filled: string[] = [];
    const nameField = user.name ? pick(['fullName', 'name', 'participantName', 'member1Name']) : undefined;
    if (nameField && !methods.getValues(nameField)) {
      methods.setValue(nameField, user.name, { shouldValidate: false });
      filled.push(nameField);
    }
    const phoneField = user.phone ? pick(['phone', 'phoneNumber', 'mobile', 'mobileNumber', 'contactNumber']) : undefined;
    if (phoneField && !methods.getValues(phoneField)) {
      methods.setValue(phoneField, user.phone, { shouldValidate: false });
      filled.push(phoneField);
    }
    prefillDone.current = true;
    if (filled.length > 0) setPrefilled(filled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const sections = formStructure?.sections || [];
  const totalSections = sections.length;

  // Team mode: a "number of members" dropdown drives which member groups show.
  const countFieldName = findCountFieldName(formStructure);
  const teamMode = !!countFieldName;
  const countValue = countFieldName ? methods.watch(countFieldName) : undefined;
  const selectedCount = countFieldName
    ? getSelectedCount({ [countFieldName]: countValue } as FormDataRecord, countFieldName)
    : Number.POSITIVE_INFINITY;

  const validateCurrentSection = useCallback(async () => {
    const section = sections[currentSectionIndex];
    if (!section) return true;

    // Validate only the currently visible fields (hidden member groups excluded)
    const values: FieldValues = methods.getValues();
    const count = countFieldName ? getSelectedCount(values as FormDataRecord, countFieldName) : Number.POSITIVE_INFINITY;
    const visibleFields = getVisibleFields(section, count).map((f) => withDynamicRequired(f, count));
    const errors: Record<string, string> = {};

    for (const field of visibleFields) {
      const valid = await methods.trigger(field.name);
      const value: unknown = methods.getValues(field.name);
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === 'string' && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
      if (!valid || (field.required && empty)) {
        errors[field.name] = (methods.formState.errors[field.name]?.message as string | undefined) || `${field.label} is required`;
        // Mark invalid fields as touched so inline errors/highlights appear
        methods.setValue(field.name, value, { shouldTouch: true });
      }
    }

    return Object.keys(errors).length === 0;
  }, [methods, sections, currentSectionIndex, countFieldName]);

  const handleContinue = async () => {
    const isValid = await validateCurrentSection();
    if (!isValid) return;

    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(prev => prev + 1);
    } else {
      setShowReview(true);
    }
  };

  const handleBack = () => {
    if (showPayment) {
      setShowPayment(false);
    } else if (showReview) {
      setShowReview(false);
    } else if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
    }
  };

  const handleEditSection = (sectionIndex: number) => {
    setShowReview(false);
    setCurrentSectionIndex(sectionIndex);
  };

  const handleSubmit = (data: FieldValues) => {
    // Hidden member groups are never submitted, even if values were kept in form state
    const scoped = countFieldName ? stripHiddenMemberValues(data as FormDataRecord, getSelectedCount(data as FormDataRecord, countFieldName)) : { ...data };
    const formData: FormDataRecord = { ...scoped };
    Object.keys(formData).forEach((key) => {
      const value = formData[key];
      // Omit unanswered questions so the record stores only real answers.
      // (Client validation already blocks submit while a REQUIRED field is
      // empty, and the backend tolerates absent optionals.)
      if (value === undefined || value === null) {
        delete formData[key];
      } else if (typeof value === 'string' && !value.trim()) {
        delete formData[key];
      } else if (Array.isArray(value) && value.length === 0) {
        delete formData[key];
      }
    });
    onSubmit(formData);
    if (previewMode) {
      // Organizer sandbox: restart the walkthrough for another pass. No
      // registration is created — the parent's onSubmit is a no-op.
      methods.reset();
      setShowReview(false);
      setCurrentSectionIndex(0);
    }
  };

  const handleFormSubmit = (e?: BaseSyntheticEvent) => {
    // Paid events go to the payment step instead of submitting immediately.
    // Snapshot the reviewed answers so the payment step can send them as
    // pendingFormData; the registration is created only after payment.
    if (isPaidEvent) {
      setPaidFormData({ ...(methods.getValues() as FormDataRecord) });
      setShowPayment(true);
      return;
    }
    methods.handleSubmit(handleSubmit)(e);
  };

  const isLastSection = currentSectionIndex === totalSections - 1;
  const currentSection = sections[currentSectionIndex];
  // Only the selected member groups render; entered values in hidden groups are preserved in form state
  const visibleCurrentFields = currentSection
    ? getVisibleFields(currentSection, selectedCount).map((f) => withDynamicRequired(f, selectedCount))
    : [];
  const completedSections = new Set<number>();
  for (let i = 0; i < currentSectionIndex; i++) {
    completedSections.add(i);
  }

  if (!formStructure?.sections?.length) {
    return (
      <Alert severity="info" variant="filled" sx={{ mb: 3 }}>
        No registration form configured for this event.
      </Alert>
    );
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <FormProvider {...methods}>
      <Box
        sx={{
          width: '100%',
          borderRadius: 2,
          ...(themeName === 'dark'
            ? { bgcolor: '#121212', p: { xs: 2, sm: 3 } }
            : themeName === 'bepart'
              ? { bgcolor: '#F4F7FF', borderTop: '4px solid', borderTopColor: 'primary.main', p: { xs: 2, sm: 3 }, borderRadius: 2 }
              : {}),
          ...(qFont || qSize
            ? { '& .MuiTypography-root': { fontFamily: qFont, fontSize: qSize } }
            : {}),
          ...(aFont || aSize
            ? { '& .MuiInputBase-input': { fontFamily: aFont, fontSize: aSize } }
            : {}),
        }}
      >
        {formTheme?.headerImageUrl ? (
          <Box
            component="img"
            src={formTheme.headerImageUrl}
            alt="Form header"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            sx={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 2, display: 'block', mb: 2.5 }}
          />
        ) : null}
        <ProgressIndicator
          sections={sections}
          currentIndex={currentSectionIndex}
          completedSections={completedSections}
        />

        {showPayment ? (
          previewMode ? (
            <Box sx={{ width: '100%' }}>
              <Alert severity="info" sx={{ mb: 3 }}>
                Paid events show a payment step here for participants (fee{feeAmount != null ? ` ${feeAmount}` : ''}, optional coupon).
                No real payment is created in preview.
              </Alert>
              <Button variant="outlined" size="large" startIcon={<KeyboardArrowLeft />} onClick={handleBack}
                sx={{ px: 4, py: 1.5, fontWeight: 600, borderRadius: 2 }}>
                Back
              </Button>
            </Box>
          ) : (
            <PaymentStep
              eventId={eventId}
              event={event}
              feeRupees={feeAmount}
              formData={paidFormData || {}}
              phone={typeof paidFormData?.phone === 'string' ? paidFormData.phone.trim() : ''}
              onBack={handleBack}
              onPaid={(args) => onPaymentComplete?.(args)}
              actionPending={isSubmitting}
            />
          )
        ) : showReview ? (
          <ReviewStep
            formStructure={formStructure}
            formData={methods.getValues() as FormDataRecord}
            onBack={handleBack}
            onEdit={handleEditSection}
            onConfirm={handleFormSubmit}
            isSubmitting={isSubmitting}
            confirmLabel={previewMode ? 'Done' : isPaidEvent ? 'Continue to Payment' : undefined}
            title={previewMode ? 'Preview Your Registration' : undefined}
            subtitle={previewMode ? 'This review step is exactly what participants will see before confirming.' : undefined}
            feeAmount={feeAmount}
          />
        ) : (
          <>
            {/* ── Section header ──────────────────────────────── */}
            <Box
              key={currentSection.id}
              sx={{ animation: 'fadeIn 0.3s ease' }}
            >
              {/* Section title & description */}
              {(currentSection.title || currentSection.description) && (
                <Box sx={{ mb: 2.5 }}>
                  {currentSection.title && (
                    <Typography
                      sx={{
                        fontWeight: 700,
                        fontSize: '1rem',
                        color: '#1E293B',
                        letterSpacing: '-0.01em',
                        fontFamily: '"DM Sans", sans-serif',
                      }}
                    >
                      {currentSection.title}
                    </Typography>
                  )}
                  {currentSection.description && (
                    <Typography
                      sx={{ fontSize: 13.5, color: '#64748B', mt: 0.5, lineHeight: 1.55 }}
                    >
                      {currentSection.description}
                    </Typography>
                  )}
                </Box>
              )}

              {/* Account prefill notice */}
              {prefilled.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    bgcolor: '#EEF2FF',
                    border: '1px solid #C7D5FD',
                    borderRadius: 2.5,
                    px: 2,
                    py: 1.5,
                    mb: 3,
                  }}
                >
                  <LockOutlined sx={{ fontSize: 18, color: '#2557F5', mt: 0.15, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontSize: 13.5, color: '#1E293B', fontWeight: 600, lineHeight: 1.4 }}>
                      Signed in as {user?.name || user?.email}
                    </Typography>
                    <Typography sx={{ fontSize: 13, color: '#4B5563', mt: 0.25, lineHeight: 1.5 }}>
                      Your {prefilled.length > 1 ? 'name and mobile number were' : 'name was'} filled
                      from your BePart account. You can still edit{' '}
                      {prefilled.length > 1 ? 'them' : 'it'} below.
                    </Typography>
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        icon={<LockOutlined style={{ fontSize: 12 }} />}
                        label="BePart account field"
                        variant="outlined"
                        sx={{
                          fontSize: 11.5,
                          height: 22,
                          borderColor: '#2557F5',
                          color: '#2557F5',
                          '& .MuiChip-icon': { color: '#2557F5' },
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Fields */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {visibleCurrentFields.map((field, fieldIndex) => (
                  <FormSection
                    key={`${currentSection.id}-${field.name}-${fieldIndex}`}
                    section={{ ...currentSection, fields: [field] }}
                    index={0}
                    register={methods.register}
                  />
                ))}
                {teamMode && visibleCurrentFields.length === 0 && (
                  <Box
                    sx={{
                      bgcolor: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 2.5,
                      px: 2.5,
                      py: 2,
                      mb: 2,
                    }}
                  >
                    <Typography sx={{ fontSize: 13.5, color: '#64748B' }}>
                      Select the number of team members in the previous section to see the member
                      fields.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>

            <Divider sx={{ my: 3.5 }} />

            {/* ── Navigation buttons ──────────────────────────── */}
            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5}>
              <Button
                variant="outlined"
                size="large"
                startIcon={<KeyboardArrowLeft />}
                onClick={handleBack}
                disabled={currentSectionIndex === 0 && !showReview}
                fullWidth
                sx={{
                  py: 1.4,
                  fontWeight: 700,
                  fontSize: 15,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  borderColor: '#CBD5E1',
                  color: '#475569',
                  '&:hover': { borderColor: '#2557F5', color: '#2557F5', bgcolor: '#EEF2FF' },
                  '&.Mui-disabled': { borderColor: '#E2E8F0', color: '#CBD5E1' },
                }}
              >
                Back
              </Button>

              <Button
                variant="contained"
                size="large"
                endIcon={<KeyboardArrowRight />}
                onClick={handleContinue}
                disabled={isSubmitting}
                fullWidth
                sx={{
                  py: 1.4,
                  fontWeight: 700,
                  fontSize: 15,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  bgcolor: '#2557F5',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: '#1D46C8',
                    boxShadow: '0 8px 20px -8px rgba(37,87,245,0.55)',
                  },
                  '&.Mui-disabled': { bgcolor: '#93A8F4', boxShadow: 'none' },
                }}
              >
                {isLastSection ? (previewMode ? 'Preview' : 'Review & Register') : 'Continue'}
              </Button>
            </Stack>
          </>
        )}
      </Box>
      </FormProvider>
    </ThemeProvider>
  );
}
