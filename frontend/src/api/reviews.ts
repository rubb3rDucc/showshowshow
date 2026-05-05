import type { JSONContent } from '@tiptap/react';
import { apiCall } from './client';

export interface Review {
  id: string;
  title: string | null;
  body: JSONContent | null;
  created_at: string;
  updated_at: string;
}

export async function getReviews(): Promise<Review[]> {
  return apiCall<Review[]>('/api/reviews');
}

export async function getReview(id: string): Promise<Review> {
  return apiCall<Review>(`/api/reviews/${id}`);
}

export async function createReview(): Promise<Review> {
  return apiCall<Review>('/api/reviews', { method: 'POST' });
}

export async function updateReview(
  id: string,
  data: { title?: string; body?: JSONContent }
): Promise<Review> {
  return apiCall<Review>(`/api/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteReview(id: string): Promise<void> {
  await apiCall<{ success: boolean }>(`/api/reviews/${id}`, { method: 'DELETE' });
}