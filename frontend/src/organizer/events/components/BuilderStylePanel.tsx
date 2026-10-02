/**
 * Shared Style tab content for the registration form builder.
 *
 * Single source for the Upload Image / Typography / Theme controls, rendered
 * both in the FormBuilder's right panel and on the Preview & Publish screen
 * (same component, same state shape — never duplicated). All values live in
 * the form theme; the parent owns persistence, so switching tabs or screens
 * can never reset them.
 */

import { useState } from 'react';
import {
  Box, Button, Divider, FormControl, InputLabel, MenuItem, Select, TextField, Typography,
} from '@mui/material';
import { CheckCircleOutlined, UploadOutlined } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import type { FormTheme } from '../../../app/types';

interface StyleControlsProps {
  theme: FormTheme | undefined;
  onThemeChange: (patch: Partial<FormTheme>) => void;
}

const THEME_OPTIONS: { v: NonNullable<FormTheme['theme']>; label: string; hint: string }[] = [
  { v: 'light', label: 'Light', hint: 'Clean white form' },
  { v: 'bepart', label: 'BePart', hint: 'Brand blue accents' },
  { v: 'dark', label: 'Dark', hint: 'Dark stage, light text' },
];

export function StyleControls({ theme: themeProp, onThemeChange }: StyleControlsProps) {
  const theme = themeProp || {};
  const activeTheme = theme.theme || 'light';
  const [uploadingImage, setUploadingImage] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleHeaderImageFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      enqueueSnackbar('Please choose an image file.', { variant: 'warning' });
      return;
    }
    setUploadingImage(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1200;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        onThemeChange({ headerImageUrl: canvas.toDataURL('image/jpeg', 0.82) });
        enqueueSnackbar('Header image updated.', { variant: 'success' });
      } catch {
        enqueueSnackbar('Could not process that image.', { variant: 'error' });
      } finally {
        URL.revokeObjectURL(url);
        setUploadingImage(false);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setUploadingImage(false);
      enqueueSnackbar('Could not read that image.', { variant: 'error' });
    };
    img.src = url;
  };

  return (
    <Box>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 2 }}>
        FORM STYLE
      </Typography>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
        HEADER
      </Typography>
      <TextField label="Header image URL (optional)" value={theme.headerImageUrl && theme.headerImageUrl.startsWith('data:') ? '' : (theme.headerImageUrl || '')}
        onChange={(e) => onThemeChange({ headerImageUrl: e.target.value.trim() || undefined })}
        placeholder="https://… or upload below"
        fullWidth size="small" sx={{ mb: 1.5 }} helperText="Cover shown at the top of the participant form" />
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" component="label" startIcon={<UploadOutlined />} disabled={uploadingImage} sx={{ borderRadius: 2 }}>
          {uploadingImage ? 'Processing…' : theme.headerImageUrl ? 'Change image' : 'Upload image'}
          <input type="file" hidden accept="image/*" onChange={(e) => handleHeaderImageFile(e.target.files?.[0])} />
        </Button>
        {theme.headerImageUrl ? (
          <Button size="small" onClick={() => onThemeChange({ headerImageUrl: undefined })}>Remove</Button>
        ) : null}
      </Box>
      {theme.headerImageUrl ? (
        <Box sx={{ mb: 1.5 }}>
          <Box component="img" src={theme.headerImageUrl} alt="Form header preview"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            sx={{ width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'block' }} />
        </Box>
      ) : null}

      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
        TYPOGRAPHY
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Question typeface</InputLabel>
        <Select label="Question typeface" value={theme.questionFont || 'default'}
          onChange={(e) => onThemeChange({ questionFont: e.target.value as FormTheme['questionFont'] })}>
          <MenuItem value="default">Sans</MenuItem>
          <MenuItem value="serif">Serif</MenuItem>
          <MenuItem value="mono">Mono</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Question size</InputLabel>
        <Select label="Question size" value={theme.questionSize || 'md'}
          onChange={(e) => onThemeChange({ questionSize: e.target.value as FormTheme['questionSize'] })}>
          <MenuItem value="sm">12</MenuItem>
          <MenuItem value="md">14</MenuItem>
          <MenuItem value="lg">16</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
        <InputLabel>Answer typeface</InputLabel>
        <Select label="Answer typeface" value={theme.answerFont || 'default'}
          onChange={(e) => onThemeChange({ answerFont: e.target.value as FormTheme['answerFont'] })}>
          <MenuItem value="default">Sans</MenuItem>
          <MenuItem value="serif">Serif</MenuItem>
          <MenuItem value="mono">Mono</MenuItem>
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>Answer size</InputLabel>
        <Select label="Answer size" value={theme.answerSize || 'md'}
          onChange={(e) => onThemeChange({ answerSize: e.target.value as FormTheme['answerSize'] })}>
          <MenuItem value="sm">11</MenuItem>
          <MenuItem value="md">13</MenuItem>
          <MenuItem value="lg">15</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ my: 2 }} />
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', color: 'text.secondary', mb: 1.5 }}>
        THEME
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
        {THEME_OPTIONS.map((o) => {
          const isActive = activeTheme === o.v;
          return (
            <Box
              key={o.v}
              onClick={() => onThemeChange({ theme: o.v })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onThemeChange({ theme: o.v }); } }}
              aria-pressed={isActive}
              sx={{
                borderRadius: 2,
                border: '1.5px solid',
                borderColor: isActive ? 'primary.main' : 'divider',
                bgcolor: o.v === 'dark' ? '#171717' : o.v === 'bepart' ? '#F4F7FF' : '#fff',
                p: 1,
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.2s ease, transform 0.2s ease',
                '&:hover': { transform: 'translateY(-1px)' },
              }}
            >
              {isActive && (
                <Box sx={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'grid', placeItems: 'center', transition: 'transform 0.2s ease', transform: 'scale(1)' }}>
                  <CheckCircleOutlined sx={{ fontSize: 12 }} />
                </Box>
              )}
              <Typography sx={{ fontSize: 13, fontWeight: 800, color: o.v === 'dark' ? '#fff' : 'text.primary', fontFamily: o.v === 'dark' ? 'inherit' : undefined }}>
                Aa
              </Typography>
              <Box sx={{ height: 3, borderRadius: 1, bgcolor: o.v === 'dark' ? 'rgba(255,255,255,0.5)' : '#CBD2DC', my: 0.75 }} />
              <Box sx={{ height: 14, borderRadius: 999, bgcolor: o.v === 'dark' ? '#fff' : 'primary.main', opacity: o.v === 'light' ? 0.85 : 1 }} />
              <Typography sx={{ fontSize: 10.5, fontWeight: 700, mt: 0.75, color: o.v === 'dark' ? '#fff' : 'text.secondary', textAlign: 'center' }}>
                {o.label}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        Style applies to the participant form and preview instantly.
      </Typography>
    </Box>
  );
}
