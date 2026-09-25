import { useState, useCallback } from 'react';
import type { BaseSyntheticEvent } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { Box, Typography, Button, Divider, Alert, Stack } from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';
import ProgressIndicator from './ProgressIndicator';
import FormSection from './FormSection';
import ReviewStep from './ReviewStep';
import PaymentStep from './PaymentStep';
import SuccessState from './SuccessState';
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
}

interface RegistrationFlowProps {
  formStructure: FormStructure;
  onSubmit: (formData: FormDataRecord) => void;
  isSubmitting: boolean;
  event?: FlowEventInfo;
  onBackToEvent?: () => void;
}

export default function RegistrationFlow({
  formStructure,
  onSubmit,
  isSubmitting,
  event,
  onBackToEvent,
}: RegistrationFlowProps) {
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<number, Record<string, string>>>({});

  // Paid events add a payment step after review. Amount lives on the event's
  // own formStructure (payment config), so no new model is involved.
  const isPaidEvent = !!event?.paymentRequired;
  const feeAmount: number | null = isPaidEvent
    ? (formStructure?.payment?.amount ?? event?.formStructure?.payment?.amount ?? null)
    : null;

  const methods = useForm({ mode: 'onChange' });

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

    setSectionErrors(prev => ({ ...prev, [currentSectionIndex]: errors }));
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
      if (Array.isArray(formData[key]) && (formData[key] as unknown[]).length === 0) {
        delete formData[key];
      }
    });
    onSubmit(formData);
  };

  const handleRegistrationSuccess = () => {
    setShowSuccess(true);
    setShowReview(false);
  };

  const handleFormSubmit = (e?: BaseSyntheticEvent) => {
    // Paid events go to the payment step instead of submitting immediately.
    // The registration is created only after a successful payment.
    if (isPaidEvent) {
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

  if (showSuccess) {
    return (
      <SuccessState
        event={event}
        onDone={onBackToEvent}
      />
    );
  }

  if (!formStructure?.sections?.length) {
    return (
      <Alert severity="info" variant="filled" sx={{ mb: 3 }}>
        No registration form configured for this event.
      </Alert>
    );
  }

  return (
    <FormProvider {...methods}>
      <Box sx={{ width: '100%' }}>
        <ProgressIndicator
          sections={sections}
          currentIndex={currentSectionIndex}
          completedSections={completedSections}
        />

        {showPayment ? (
          <PaymentStep
            event={event}
            amount={feeAmount}
            onBack={handleBack}
          />
        ) : showReview ? (
          <ReviewStep
            formStructure={formStructure}
            formData={methods.getValues() as FormDataRecord}
            onBack={handleBack}
            onEdit={handleEditSection}
            onConfirm={handleFormSubmit}
            isSubmitting={isSubmitting}
            confirmLabel={isPaidEvent ? 'Continue to Payment' : undefined}
            feeAmount={feeAmount}
          />
        ) : (
          <>
            <Box
              key={currentSection.id}
              sx={{
                animation: 'fadeIn 0.3s ease',
                minHeight: 300,
              }}
            >
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" color="text.primary" gutterBottom sx={{ fontWeight: 600 }}>
                  {currentSection.title}
                </Typography>
                {currentSection.description && (
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    {currentSection.description}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ mb: 4 }} />

              <Box sx={{ ml: '37.5px', borderLeft: '2px solid', borderColor: 'divider', pl: 3 }}>
                {visibleCurrentFields.map((field, fieldIndex) => (
                  <FormSection
                    key={`${currentSection.id}-${field.name}-${fieldIndex}`}
                    section={{ ...currentSection, fields: [field] }}
                    index={0}
                    register={methods.register}
                  />
                ))}
                {teamMode && visibleCurrentFields.length === 0 && (
                  <Alert severity="info" sx={{ mb: 3 }}>
                    Select the number of team members in the previous section to see the member fields.
                  </Alert>
                )}
              </Box>
            </Box>

            <Divider sx={{ my: 4 }} />

            <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                size="large"
                startIcon={<KeyboardArrowLeft />}
                onClick={handleBack}
                disabled={currentSectionIndex === 0 && !showReview}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  borderRadius: 2,
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
                sx={{
                  px: 4,
                  py: 1.5,
                  fontWeight: 600,
                  borderRadius: 2,
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&:disabled': { bgcolor: 'action.disabledBackground' },
                }}
              >
                {isLastSection ? 'Review & Register' : 'Continue'}
              </Button>
            </Stack>
          </>
        )}
      </Box>
    </FormProvider>
  );
}
