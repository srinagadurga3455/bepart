import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SnackbarProvider } from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

import App from './App.jsx';
import theme from './shared/theme.js';
import './index.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <App />
        </SnackbarProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>
);