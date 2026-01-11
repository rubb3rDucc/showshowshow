import { apiCall } from './client';
import { useMutation, useQuery } from '@tanstack/react-query';

// Types
export interface SubscriptionStatus {
  plan: 'free' | 'preview' | 'pro';
  preview_expires_at: string | null;
  pro_expires_at: string | null;
  has_payment_method: boolean;
  subscription_status: string | null;
  can_access_pro_features: boolean;
}

export interface CheckoutSessionRequest {
  success_url?: string;
  cancel_url?: string;
}

export interface CheckoutSessionResponse {
  checkout_url: string;
}

export interface PortalSessionRequest {
  return_url?: string;
}

export interface PortalSessionResponse {
  portal_url: string;
}

// API Functions
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return apiCall<SubscriptionStatus>('/api/billing/status');
}

export async function createCheckoutSession(
  request?: CheckoutSessionRequest
): Promise<CheckoutSessionResponse> {
  return apiCall<CheckoutSessionResponse>('/api/billing/checkout-session', {
    method: 'POST',
    body: JSON.stringify(request || {}),
  });
}

export async function createPortalSession(
  request?: PortalSessionRequest
): Promise<PortalSessionResponse> {
  return apiCall<PortalSessionResponse>('/api/billing/portal-session', {
    method: 'POST',
    body: JSON.stringify(request || {}),
  });
}

// React Query Hooks
export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ['subscriptionStatus'],
    queryFn: getSubscriptionStatus,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: createCheckoutSession,
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: createPortalSession,
  });
}

// Helper function to calculate days remaining
export function getDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const expiryDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiryDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

// Helper function to format plan name for display
export function getPlanDisplayName(plan: SubscriptionStatus['plan']): string {
  switch (plan) {
    case 'pro':
      return 'Paid';
    case 'preview':
      return 'Free Trial';
    case 'free':
    default:
      return 'Free';
  }
}
