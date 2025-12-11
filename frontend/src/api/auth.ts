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
  return apiCall<User>('/api/auth/me');
}


