import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, Step, StepLabel, Stepper } from '@mui/material';
import { useForm } from 'react-hook-form';
import { authApi, isEmailIdentifier } from '../api/auth';
import { apiErrorMessage } from '../../app/api/client';

function roleHome(role: string | undefined): string {
  if (role === 'ADMIN') return '/admin';
  if (role === 'ORGANIZER') return '/organizer';
  return '/events';
}

interface IdentifierForm {
  identifier: string;
}

interface OtpForm {
  otp: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<IdentifierForm>();
  const { register: registerOtp, handleSubmit: handleOtpSubmit, formState: { errors: otpErrors } } = useForm<OtpForm>();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const validateIdentifier = (value: string): string | true => {
    const clean = value.trim();
    if (!clean) return 'Email or phone number is required';
    if (clean.includes('@')) {
      if (!/^\S+@\S+\.\S+$/.test(clean)) return 'Enter a valid email';
    } else if (!/^\+?[0-9\s\-()]{7,20}$/.test(clean)) {
      return 'Enter a valid phone number';
    }
    return true;
  };

  const onRequestOtp = async (data: IdentifierForm) => {
    setError('');
    setInfo('');
    setSending(true);
    try {
      const clean = data.identifier.trim();
      await authApi.requestOtp(clean);
      setEmail(clean);
      setIdentifier(isEmailIdentifier(clean) ? 'email' : 'phone number');
      setStep(1);
      setInfo('OTP sent. In development, find it in the backend server console.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send OTP. Check the details and try again.'));
    } finally {
      setSending(false);
    }
  };

  const onVerifyOtp = async (data: OtpForm) => {
    setError('');
    setVerifying(true);
    try {
      const res = await authApi.verifyOtp(email, data.otp.trim());
      localStorage.setItem('accessToken', res.data.accessToken);
      const role = res.data.user?.role;
      navigate(from || roleHome(role), { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid or expired OTP. Try again.'));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh', px: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 440, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom align="center" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
            BePart Login
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Organizers sign in with their registered phone number, admins with email — both via a one-time passcode.
          </Typography>
          <Stepper activeStep={step} sx={{ mb: 3 }}>
            <Step><StepLabel>Email or phone</StepLabel></Step>
            <Step><StepLabel>Passcode</StepLabel></Step>
          </Stepper>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {info && <Alert severity="info" sx={{ mb: 2 }}>{info}</Alert>}
          {step === 0 ? (
            <form onSubmit={handleSubmit(onRequestOtp)}>
              <TextField
                fullWidth
                label="Email or phone number"
                placeholder="e.g. 9876543210"
                autoComplete="username"
                {...register('identifier', { validate: validateIdentifier })}
                error={!!errors.identifier}
                helperText={errors.identifier?.message}
                margin="normal"
              />
              <Button type="submit" variant="contained" size="large" fullWidth disabled={sending} sx={{ mt: 2 }}>
                {sending ? 'Sending…' : 'Send Passcode'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit(onVerifyOtp)}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Enter the 6-digit passcode sent to your {identifier || 'email'} (<strong>{email}</strong>).
              </Typography>
              <TextField
                fullWidth
                label="6-digit passcode"
                inputMode="numeric"
                autoComplete="one-time-code"
                {...registerOtp('otp', { required: 'Passcode is required', pattern: { value: /^\d{6}$/, message: 'Enter the 6-digit passcode' } })}
                error={!!otpErrors.otp}
                helperText={otpErrors.otp?.message}
                margin="normal"
              />
              <Button type="submit" variant="contained" size="large" fullWidth disabled={verifying} sx={{ mt: 2 }}>
                {verifying ? 'Verifying…' : 'Verify & Sign In'}
              </Button>
              <Button fullWidth sx={{ mt: 1 }} onClick={() => { setStep(0); setError(''); setInfo(''); }}>
                Use different details
              </Button>
            </form>
          )}
          <Typography variant="body2" align="center" sx={{ mt: 2 }}>
            Looking for events?{' '}
            <RouterLink to="/events">Browse as a participant</RouterLink>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
