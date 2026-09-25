import { useForm } from 'react-hook-form';
import { Box, Typography, Button, Card, CardContent, Alert, Divider } from '@mui/material';
import { FormProvider } from 'react-hook-form';
import FormSection from './FormSection';

export default function RegistrationForm({ formStructure, onSubmit, isSubmitting, submitLabel = 'Register Now' }) {
  const methods = useForm({ mode: 'onBlur' });

  const handleSubmit = (data) => {
    const formData = { ...data };
    Object.keys(formData).forEach((key) => {
      if (Array.isArray(formData[key]) && formData[key].length === 0) {
        delete formData[key];
      }
    });
    onSubmit(formData);
  };

  if (!formStructure?.sections?.length) {
    return (
      <Alert severity="info" variant="filled" sx={{ mb: 3 }}>
        No registration form configured for this event.
      </Alert>
    );
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(handleSubmit)}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={600} color="text.primary" gutterBottom>
            Registration Form
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {formStructure.description || 'Please fill in the details below to complete your registration.'}
          </Typography>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {formStructure.sections.map((section, index) => (
          <FormSection key={section.id} section={section} index={index} register={methods.register} />
        ))}

        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isSubmitting}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
              bgcolor: 'primary.main',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:disabled': { bgcolor: 'action.disabledBackground' },
            }}
          >
            {isSubmitting ? 'Registering...' : submitLabel}
          </Button>
        </Box>
      </form>
    </FormProvider>
  );
}