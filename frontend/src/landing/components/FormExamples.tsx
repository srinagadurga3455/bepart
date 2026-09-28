import { Box, Container, Grid, Typography } from '@mui/material';
import { CheckCircleOutlined } from '@mui/icons-material';

interface ExampleForm {
  title: string;
  subtitle: string;
  fields: { label: string; hint: string; required?: boolean }[];
}

// Concrete form examples organizers actually build: sectioned fields with
// required markers, matching the real builder output.
const EXAMPLES: ExampleForm[] = [
  {
    title: 'Hackathon',
    subtitle: 'Team registration · 3 sections',
    fields: [
      { label: 'Team name', hint: 'Text · required', required: true },
      { label: 'Team members', hint: 'Repeatable group · 2–4' },
      { label: 'College', hint: 'Text · required', required: true },
      { label: 'Branch', hint: 'Dropdown · required', required: true },
    ],
  },
  {
    title: 'Workshop',
    subtitle: 'Individual signup · 2 sections',
    fields: [
      { label: 'Name', hint: 'Text · required', required: true },
      { label: 'Email', hint: 'Email · required', required: true },
      { label: 'Phone', hint: 'Phone · required', required: true },
      { label: 'Experience', hint: 'Radio · Beginner / Intermediate' },
    ],
  },
  {
    title: 'Competition',
    subtitle: 'Individual entry · 2 sections',
    fields: [
      { label: 'Participant details', hint: 'Text · required', required: true },
      { label: 'Category', hint: 'Dropdown · Solo / Group' },
      { label: 'Institution', hint: 'Text · required', required: true },
    ],
  },
];

function ExampleCard({ example }: { example: ExampleForm }) {
  return (
    <Box sx={{ bgcolor: '#FFFFFF', border: '1px solid', borderColor: 'divider', borderRadius: 4, overflow: 'hidden', height: '100%' }}>
      <Box sx={{ borderTop: '8px solid', borderTopColor: 'primary.main', px: 3, pt: 2.5, pb: 1.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 17 }}>{example.title}</Typography>
        <Typography variant="caption" color="text.secondary">{example.subtitle}</Typography>
      </Box>
      <Box sx={{ px: 3, pb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {example.fields.map((f) => (
          <Box key={f.label} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 2, py: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{f.label}</Typography>
              {f.required && <CheckCircleOutlined sx={{ fontSize: 14, color: 'primary.main' }} />}
            </Box>
            <Typography variant="caption" color="text.secondary">{f.hint}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function FormExamples() {
  return (
    <Box component="section" sx={{ px: { xs: 2, sm: 3, lg: 4 }, pb: { xs: 7, md: 9 } }}>
      <Container maxWidth="lg">
        <Typography align="center" sx={{ color: 'primary.main', fontSize: 13, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Custom Registration Forms
        </Typography>
        <Typography component="h2" align="center" sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: { xs: '1.6rem', sm: '2rem', md: '2.4rem' }, letterSpacing: '-0.05em', lineHeight: 1.15, mt: 2 }}>
          Forms shaped like your event
        </Typography>
        <Typography align="center" color="text.secondary" sx={{ mt: 1.5, maxWidth: 640, mx: 'auto', fontSize: 15, lineHeight: 1.7 }}>
          Organizers build multi-section forms with questions, options, required fields and team
          groups — then preview them exactly as participants will see them.
        </Typography>

        <Grid container spacing={2.5} sx={{ mt: { xs: 3, md: 4 } }}>
          {EXAMPLES.map((e) => (
            <Grid size={{ xs: 12, md: 4 }} key={e.title}>
              <ExampleCard example={e} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

export default FormExamples;
