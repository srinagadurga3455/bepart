/**
 * Google-Forms-style settings panel for a registration form.
 * Controls: participant info collection, auth, multiple submissions,
 * confirmation message, privacy/consent section, and open/closed toggle.
 */

import {
  Box, Chip, Divider, FormControlLabel, Switch, TextField, Typography,
} from '@mui/material';
import {
  CheckCircleOutlined, Lock, LockOpen, PeopleAlt, Policy, Replay, Settings,
} from '@mui/icons-material';
import type { FormSettings } from '../../../app/types';

interface FormSettingsPanelProps {
  settings: FormSettings;
  onChange: (updated: FormSettings) => void;
}

function SettingRow({
  icon,
  label,
  sublabel,
  control,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  control: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        py: 1.25,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box sx={{ color: 'text.secondary', mt: 0.25, flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{label}</Typography>
        {sublabel && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25, lineHeight: 1.5 }}>
            {sublabel}
          </Typography>
        )}
      </Box>
      <Box sx={{ flexShrink: 0 }}>{control}</Box>
    </Box>
  );
}

export default function FormSettingsPanel({ settings, onChange }: FormSettingsPanelProps) {
  const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const registrationOpen = settings.registrationOpen !== false; // default true

  return (
    <Box>
      {/* ── Responses open/closed ── */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary' }}>
            RESPONSES
          </Typography>
          <Chip
            size="small"
            icon={registrationOpen ? <LockOpen sx={{ fontSize: '12px !important' }} /> : <Lock sx={{ fontSize: '12px !important' }} />}
            label={registrationOpen ? 'Open' : 'Closed'}
            color={registrationOpen ? 'success' : 'default'}
            sx={{ height: 20, fontSize: 10.5, fontWeight: 700 }}
          />
        </Box>
        <SettingRow
          icon={registrationOpen ? <LockOpen fontSize="small" /> : <Lock fontSize="small" />}
          label="Accept registrations"
          sublabel="Turn off to stop new registrations without cancelling the event."
          control={
            <Switch
              checked={registrationOpen}
              onChange={(e) => set('registrationOpen', e.target.checked)}
              size="small"
            />
          }
        />
        {!registrationOpen && (
          <Box sx={{ mt: 1 }}>
            <TextField
              label="Closed message"
              value={settings.closedMessage || ''}
              onChange={(e) => set('closedMessage', e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={2}
              placeholder="Registrations are currently closed."
              helperText="Shown to participants when they try to register"
            />
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Collect participant info ── */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.25 }}>
          PARTICIPANT INFO
        </Typography>
        <SettingRow
          icon={<PeopleAlt fontSize="small" />}
          label="Collect name"
          sublabel="Always collected via the system Name field."
          control={<Switch checked={true} disabled size="small" />}
        />
        <SettingRow
          icon={<PeopleAlt fontSize="small" />}
          label="Collect phone number"
          sublabel="Required for ticket delivery and duplicate prevention."
          control={<Switch checked={true} disabled size="small" />}
        />
        <SettingRow
          icon={<PeopleAlt fontSize="small" />}
          label="Collect email address"
          sublabel="Adds an email field to the first section of the form."
          control={
            <Switch
              checked={settings.collectEmail !== false}
              onChange={(e) => set('collectEmail', e.target.checked)}
              size="small"
            />
          }
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Access ── */}
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.25 }}>
          ACCESS
        </Typography>
        <SettingRow
          icon={<Lock fontSize="small" />}
          label="Require login"
          sublabel="Participants must be signed in to submit a registration."
          control={
            <Switch
              checked={settings.requireLogin === true}
              onChange={(e) => set('requireLogin', e.target.checked)}
              size="small"
            />
          }
        />
        <SettingRow
          icon={<Replay fontSize="small" />}
          label="Allow multiple submissions"
          sublabel="By default one registration per phone is allowed."
          control={
            <Switch
              checked={settings.allowMultipleSubmissions === true}
              onChange={(e) => set('allowMultipleSubmissions', e.target.checked)}
              size="small"
            />
          }
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Confirmation ── */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary' }}>
            CONFIRMATION
          </Typography>
          <Settings sx={{ fontSize: 14, color: 'text.disabled' }} />
        </Box>
        <TextField
          label="Confirmation message"
          value={settings.confirmationMessage || ''}
          onChange={(e) => set('confirmationMessage', e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={3}
          placeholder="Thank you for registering! Your ticket has been sent to your phone."
          helperText="Shown to participants immediately after a successful registration"
          sx={{ mb: 0.5 }}
        />
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* ── Privacy / Consent ── */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary' }}>
            PRIVACY &amp; CONSENT
          </Typography>
          <Policy sx={{ fontSize: 14, color: 'text.disabled' }} />
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={settings.showConsentSection === true}
              onChange={(e) => set('showConsentSection', e.target.checked)}
              size="small"
            />
          }
          label={
            <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
              Show consent section
            </Typography>
          }
          sx={{ mb: 1, ml: 0 }}
        />
        {settings.showConsentSection && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              label="Privacy / terms text"
              value={settings.consentText || ''}
              onChange={(e) => set('consentText', e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={4}
              placeholder="By registering you agree to our privacy policy and event terms…"
              helperText="Shown as a block of text participants must read before checking consent"
            />
            <TextField
              label="Consent checkbox label"
              value={settings.consentCheckboxLabel || ''}
              onChange={(e) => set('consentCheckboxLabel', e.target.value)}
              fullWidth
              size="small"
              placeholder="I agree to the terms and privacy policy."
              helperText="The required checkbox participants must tick to submit"
            />
            <Box
              sx={{
                bgcolor: 'primary.50',
                border: '1px solid',
                borderColor: 'primary.100',
                borderRadius: 2,
                px: 1.5,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CheckCircleOutlined sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography sx={{ fontSize: 12, color: 'primary.main', fontWeight: 600 }}>
                Consent checkbox is required — participants cannot submit without ticking it.
              </Typography>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
