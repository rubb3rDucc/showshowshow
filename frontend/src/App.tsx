import { Route, Switch, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useEffect, lazy, Suspense, useState, useCallback, useRef } from 'react';
import { Center, Loader } from '@mantine/core';
import { setGlobalTokenGetter } from './api/client';
import { initPostHog, identifyUser } from './lib/posthog';

import { ErrorBoundary } from './components/common/ErrorBoundary';

// Initialize PostHog on app load
initPostHog();
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { UpgradeModal } from './components/billing/UpgradeModal';
import { getSubscriptionStatus } from './api/billing';

// Custom event type for subscription-required events
declare global {
  interface WindowEventMap {
    'subscription-required': CustomEvent<{ message: string }>;
  }
}

// Eagerly loaded pages (core navigation)
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Queue } from './pages/Queue';
import { Library } from './pages/Library';
import { Browse } from './pages/Browse';
import { NetworkSectionGrid } from './pages/NetworkSectionGrid';
import { Networks } from './pages/Networks';
import { ClerkTest } from './pages/ClerkTest';

// Lazy loaded pages (less frequently accessed)
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Stats = lazy(() => import('./pages/Stats').then(m => ({ default: m.Stats })));
const PersonDetail = lazy(() => import('./pages/PersonDetail').then(m => ({ default: m.PersonDetail })));

// Loading fallback for lazy loaded pages
function PageLoader() {
  return (
    <Center py={60}>
      <Loader size="lg" />
    </Center>
  );
}

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
    mutations: {
      retry: false,
    },
  },
});

function App() {
  const { getToken, isSignedIn } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');
  const hasShownWelcomeRef = useRef(false);

  // Set up global token getter for API calls
  useEffect(() => {
    setGlobalTokenGetter(getToken);
  }, [getToken]);

  // Identify user in PostHog when signed in
  useEffect(() => {
    if (isUserLoaded && isSignedIn && user) {
      identifyUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName,
      });
    }
  }, [isUserLoaded, isSignedIn, user]);

  // Show welcome toast on first login
  useEffect(() => {
    if (!isUserLoaded || !isSignedIn || !user || hasShownWelcomeRef.current) {
      return;
    }

    const welcomeShownKey = `welcome_shown_${user.id}`;
    const hasSeenWelcome = localStorage.getItem(welcomeShownKey);

    if (!hasSeenWelcome) {
      // Mark as shown immediately to prevent duplicates
      hasShownWelcomeRef.current = true;
      localStorage.setItem(welcomeShownKey, 'true');

      // Fetch subscription status to determine appropriate message
      const showWelcomeToast = async () => {
        const firstName = user.firstName || 'there';

        try {
          const status = await getSubscriptionStatus();

          if (status.plan === 'preview') {
            // New user with trial
            toast.success(`Welcome to ShowShowShow, ${firstName}!`, {
              description: 'Your 7-day free trial has started. Enjoy full access to all features.',
              duration: 6000,
            });
          } else if (status.plan === 'free') {
            // Returning user without trial (abuse prevention or expired)
            toast.info(`Welcome back, ${firstName}!`, {
              description: 'Subscribe to unlock all features.',
              duration: 6000,
            });
          } else if (status.plan === 'pro') {
            // Existing subscriber
            toast.success(`Welcome back, ${firstName}!`, {
              description: 'Thanks for being a subscriber!',
              duration: 6000,
            });
          }
        } catch {
          // Fallback if status fetch fails
          toast.success(`Welcome to ShowShowShow, ${firstName}!`, {
            duration: 6000,
          });
        }
      };

      // Small delay to ensure the page has rendered and token is ready
      setTimeout(showWelcomeToast, 500);
    }
  }, [isUserLoaded, isSignedIn, user]);

  // Listen for subscription-required events (403 errors from API)
  useEffect(() => {
    const handler = (event: CustomEvent<{ message: string }>) => {
      setUpgradeMessage(event.detail.message);
      setUpgradeModalOpen(true);
    };
    window.addEventListener('subscription-required', handler);
    return () => window.removeEventListener('subscription-required', handler);
  }, []);

  const handleCloseUpgradeModal = useCallback(() => {
    setUpgradeModalOpen(false);
    setUpgradeMessage('');
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Switch>
        {/* Public routes */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/clerk-test" component={ClerkTest} />

        {/* Protected routes */}
        <Route path="/">
          <ProtectedRoute>
            <Layout>
              <Home />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/browse">
          <ProtectedRoute>
            <Layout>
              <Browse />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/search">
          <ProtectedRoute>
            <Layout>
              <Search />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/lineup">
          <ProtectedRoute>
            <Layout>
              <Queue />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/library">
          <ProtectedRoute>
            <Layout>
              <Library />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/stats">
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Stats />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/settings">
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <Settings />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/browse/network/:networkId/:section">
          <ProtectedRoute>
            <Layout>
              <NetworkSectionGrid />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/networks">
          <ProtectedRoute>
            <Layout>
              <Networks />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/people/:tmdbId">
          <ProtectedRoute>
            <Layout>
              <Suspense fallback={<PageLoader />}>
                <PersonDetail />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        </Route>

        {/* 404 redirect */}
        <Route>
          <Redirect to="/" />
        </Route>
        </Switch>

        <Toaster position="top-right" />
        <UpgradeModal
          opened={upgradeModalOpen}
          onClose={handleCloseUpgradeModal}
          message={upgradeMessage}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
