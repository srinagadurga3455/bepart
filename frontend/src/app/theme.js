import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#2557F5', dark: '#1840C7' },
    background: { default: '#F7F7F4', paper: '#FFFFFF' },
    text: { primary: '#171717', secondary: '#737373' },
    divider: '#E9E9E4',
  },
  shape: { borderRadius: 18 },
  typography: {
    fontFamily: '"DM Sans", sans-serif',
    h1: { fontFamily: '"Manrope", sans-serif' },
    h2: { fontFamily: '"Manrope", sans-serif' },
    h3: { fontFamily: '"Manrope", sans-serif' },
    h4: { fontFamily: '"Manrope", sans-serif' },
    h5: { fontFamily: '"Manrope", sans-serif' },
    h6: { fontFamily: '"Manrope", sans-serif' },
    subtitle1: { fontFamily: '"Manrope", sans-serif' },
    subtitle2: { fontFamily: '"Manrope", sans-serif' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999 },
      },
    },
  },
});

export default theme;