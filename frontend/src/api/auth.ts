import { apiCall } from './client';
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '../types/api';

export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function register(credentials: RegisterRequest): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function getCurrentUser(): Promise<User> {
  const response = await apiCall<{ user: User }>('/api/auth/me');
  return response.user;
}


