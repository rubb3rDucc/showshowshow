import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '../../stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const { user, token, isInitialized } = useAuthStore();

  useEffect(() => {
    // Only redirect if fully initialized and NO token exists
    // This prevents premature redirects during auth check
    if (isInitialized && !token && !user) {
      console.log('No auth, redirecting to login');
      setLocation('/login');
    }
  }, [user, token, isInitialized, setLocation]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div>Loading...</div>
      </div>
    );
  }

  // Allow render if token exists, even if user fetch failed temporarily
  if (!token) {
    return null;
  }

  return <>{children}</>;
}


