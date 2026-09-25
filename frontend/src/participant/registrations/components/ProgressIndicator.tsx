import { Box, Typography } from '@mui/material';
import type { FormSectionDef } from '../../../app/types';

interface ProgressIndicatorProps {
  sections: FormSectionDef[];
  currentIndex: number;
  completedSections: Set<number>;
}

export default function ProgressIndicator({ sections, currentIndex }: ProgressIndicatorProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {sections.map((section, index) => (
          <Box key={section.id} sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                flex: 1,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  transition: 'all 0.3s ease',
                  ...(index < currentIndex
                    ? { bgcolor: 'primary.main', color: 'white', border: '3px solid', borderColor: 'primary.main' }
                    : index === currentIndex
                    ? { bgcolor: 'primary.main', color: 'white', border: '3px solid', borderColor: 'primary.light', boxShadow: '0 0 0 4px rgba(25, 118, 210, 0.15)' }
                    : { bgcolor: 'transparent', color: 'text.secondary', border: '2px solid', borderColor: 'divider' }),
                }}
              >
                {index < currentIndex ? '✓' : index + 1}
              </Box>
              <Typography
                variant="caption"
                color={index <= currentIndex ? 'text.primary' : 'text.secondary'}
                sx={{ maxWidth: 100, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center', fontWeight: index === currentIndex ? 600 : 500 }}
              >
                {section.title}
              </Typography>
            </Box>
            {index < sections.length - 1 && (
              <Box
                sx={{
                  flex: 1,
                  height: 2,
                  borderRadius: 1,
                  mx: 1,
                  background: index < currentIndex ? 'linear-gradient(90deg, primary.main, primary.light)' : 'divider',
                  transition: 'all 0.3s ease',
                }}
              />
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
