import { useAuth } from '@clerk/clerk-react';
import { apiCall } from '../api/client';

/**
 * Hook that provides an API caller with automatic Clerk token injection
 */
export function useApi() {
  const { getToken } = useAuth();

  const api = async <T>(endpoint: string, options?: RequestInit): Promise<T> => {
    const token = await getToken();
    return apiCall<T>(endpoint, options, token || undefined);
  };

  return { api };
}
