import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import App from './App.tsx';
import './index.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { useThemeStore } from './stores/themeStore';

// Mantine theme configuration
const mantineTheme = createTheme({
  fontFamily: 'Nunito Sans, system-ui, sans-serif',
  primaryColor: 'blue',
});

// Initialize theme before rendering
useThemeStore.getState().initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={mantineTheme}>
      <App />
    </MantineProvider>
  </StrictMode>
);
