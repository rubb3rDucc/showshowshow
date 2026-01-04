import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider, createTheme } from '@mantine/core';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.tsx';
import './index.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

// Import Clerk publishable key from environment
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

// Mantine theme configuration
const mantineTheme = createTheme({
  fontFamily: 'Nunito Sans, system-ui, sans-serif',
  primaryColor: 'blue',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <MantineProvider theme={mantineTheme}>
        <App />
      </MantineProvider>
    </ClerkProvider>
  </StrictMode>
);
