/**
 * Google-Forms-style template chooser shown when an organizer starts building
 * a new registration form (before any form has been saved).
 */

import { Box, Button, Card, CardActionArea, CardContent, Chip, Typography } from '@mui/material';
import { ArrowBack, AutoAwesome } from '@mui/icons-material';
import { FORM_TEMPLATES } from '../utils/formTemplates';
import type { FormTemplate } from '../utils/formTemplates';
import type { BuilderForm } from '../utils/formBuilderUtils';
import type { FormSettings } from '../../../app/types';

interface ChooseTemplateProps {
  onSelect: (form: BuilderForm, settings: FormSettings) => void;
  onBack?: () => void;
  backLabel?: string;
  eventName?: string;
}

export default function ChooseTemplate({ onSelect, onBack, backLabel, eventName }: ChooseTemplateProps) {
  const handlePick = (tpl: FormTemplate) => {
    const form = tpl.build();
    // Pre-fill the form title from the event name when not blank
    if (eventName?.trim() && tpl.id !== 'blank') {
      form.title = `${eventName.trim()} – Registration`;
    } else if (eventName?.trim() && tpl.id === 'blank') {
      form.title = eventName.trim();
    }
    onSelect(form, { ...tpl.defaultSettings });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        {onBack && (
          <Button
            startIcon={<ArrowBack fontSize="small" />}
            size="small"
            onClick={onBack}
            sx={{ color: 'text.secondary' }}
          >
            {backLabel || 'Back'}
          </Button>
        )}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Choose a template
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Start with a ready-made form or build from scratch. You can edit everything after.
          </Typography>
        </Box>
      </Box>

      {/* Template grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
          gap: 2,
        }}
      >
        {FORM_TEMPLATES.map((tpl) => {
          const isBlank = tpl.id === 'blank';
          return (
            <Card
              key={tpl.id}
              variant="outlined"
              sx={{
                borderRadius: 3,
                border: '1.5px solid',
                borderColor: isBlank ? 'divider' : 'primary.light',
                transition: 'box-shadow 0.18s, transform 0.18s',
                '&:hover': {
                  boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardActionArea onClick={() => handlePick(tpl)} sx={{ height: '100%', p: 0 }}>
                <CardContent sx={{ p: 2.5 }}>
                  {/* Icon row */}
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 3,
                      bgcolor: isBlank ? 'grey.100' : 'primary.50',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 26,
                      mb: 1.75,
                      border: '1px solid',
                      borderColor: isBlank ? 'divider' : 'primary.100',
                    }}
                  >
                    {tpl.icon}
                  </Box>

                  {/* Name + chip */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{tpl.name}</Typography>
                    {!isBlank && (
                      <Chip
                        icon={<AutoAwesome sx={{ fontSize: '12px !important' }} />}
                        label="Template"
                        size="small"
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          height: 20,
                          bgcolor: 'primary.50',
                          color: 'primary.main',
                          border: '1px solid',
                          borderColor: 'primary.100',
                        }}
                      />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, lineHeight: 1.55 }}>
                    {tpl.description}
                  </Typography>

                  {/* Section preview */}
                  {!isBlank && (
                    <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {tpl.build().sections.map((s) => (
                        <Chip
                          key={s.key}
                          label={s.title}
                          size="small"
                          sx={{ fontSize: 10.5, height: 20, bgcolor: 'grey.100', fontWeight: 500 }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
