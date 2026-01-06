import { Route, Switch, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { setGlobalTokenGetter } from './api/client';

import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { Layout } from './components/layout/Layout';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Queue } from './pages/Queue';
import { Library } from './pages/Library';
import { Settings } from './pages/Settings';
import { Browse } from './pages/Browse';
import { Stats } from './pages/Stats';
import { NetworkSectionGrid } from './pages/NetworkSectionGrid';
import { Networks } from './pages/Networks';
import { PersonDetail } from './pages/PersonDetail';
import { ClerkTest } from './pages/ClerkTest';

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

        <Route path="/home">
          <ProtectedRoute>
            <Layout>
              <Home />
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
              <Stats />
            </Layout>
          </ProtectedRoute>
        </Route>

        <Route path="/settings">
          <ProtectedRoute>
            <Layout>
              <Settings />
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
              <PersonDetail />
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
  );
}

export default App;
