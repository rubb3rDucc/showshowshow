import { apiCall } from './client';
import type { User } from '../types/api';

export interface ChangeEmailRequest {
  new_email: string;
  password: string;
}

export interface ChangeEmailResponse {
  success: boolean;
  user: User;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  success: boolean;
}

export interface DeleteAccountRequest {
  email: string;
  confirm: true;
}

export interface DeleteAccountResponse {
  success: boolean;
  message: string;
}

/**
 * Change user email address
 * @param data - New email and current password for verification
 */
export async function changeEmail(data: ChangeEmailRequest): Promise<ChangeEmailResponse> {
  return apiCall<ChangeEmailResponse>('/api/user/email', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Change user password
 * @param data - Current password and new password
 */
export async function changePassword(data: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  return apiCall<ChangePasswordResponse>('/api/user/password', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete user account
 * @param data - User email and confirmation flag
 */
export async function deleteAccount(data: DeleteAccountRequest): Promise<DeleteAccountResponse> {
  return apiCall<DeleteAccountResponse>('/api/user/account', {
    method: 'DELETE',
    body: JSON.stringify(data),
  });
}

