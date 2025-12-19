import { create } from 'zustand';
import * as authApi from '../api/auth';
import type { User } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  isLoading: false,
  isInitialized: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authApi.login({ email, password });
      localStorage.setItem('token', response.token);
      set({
        user: response.user,
        token: response.token,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await authApi.register({ email, password });
      localStorage.setItem('token', response.token);
      set({
        user: response.user,
        token: response.token,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({
      user: null,
      token: null,
    });
  },

  initialize: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isInitialized: true });
      return;
    }

    try {
      const user = await authApi.getCurrentUser();
      set({
        user,
        token,
        isInitialized: true,
      });
    } catch (error) {
      // Only clear token on auth errors (401), not network errors
      const isAuthError = error && typeof error === 'object' && 'statusCode' in error && 
                          (error as { statusCode: number }).statusCode === 401;
      
      if (isAuthError) {
        console.log('Auth token invalid, logging out');
        localStorage.removeItem('token');
        set({
          user: null,
          token: null,
          isInitialized: true,
        });
      } else {
        // Network or other error - keep token and retry
        console.warn('Failed to verify auth, keeping session:', error);
        set({
          user: null, // Clear user but keep token for retry
          token,
          isInitialized: true,
        });
      }
    }
  },

  setUser: (user: User) => {
    set({ user });
  },
}));


