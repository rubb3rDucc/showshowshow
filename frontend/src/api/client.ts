// API client with authentication
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Global token getter - will be set by App component
let globalGetToken: (() => Promise<string | null>) | null = null;

export function setGlobalTokenGetter(getter: () => Promise<string | null>) {
  globalGetToken = getter;
}

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit,
  token?: string
): Promise<T> {
  // Get token from Clerk if not provided
  let authToken = token;
  if (!authToken && globalGetToken) {
    authToken = (await globalGetToken()) || undefined;
  }

  // Don't set Content-Type for requests without a body (GET, DELETE)
  const hasBody = options?.body !== undefined;
  const headers: HeadersInit = {
    ...(hasBody && { 'Content-Type': 'application/json' }),
    ...(authToken && { Authorization: `Bearer ${authToken}` }),
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new ApiError(
      data.statusCode || response.status,
      data.code || 'UNKNOWN_ERROR',
      data.message || 'An error occurred'
    );

    // Dispatch custom event for 403 Forbidden errors (subscription required)
    if (error.statusCode === 403 && error.code === 'FORBIDDEN') {
      window.dispatchEvent(
        new CustomEvent('subscription-required', {
          detail: { message: error.message },
        })
      );
    }

    throw error;
  }

  return data;
}

