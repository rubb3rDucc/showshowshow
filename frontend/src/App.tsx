import { Route, Switch, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { useEffect, lazy, Suspense } from 'react';
import { Center, Loader } from '@mantine/core';
import { setGlobalTokenGetter } from './api/client';

import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';

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
  const { getToken } = useAuth();

  // Set up global token getter for API calls
  useEffect(() => {
    setGlobalTokenGetter(getToken);
  }, [getToken]);

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
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
