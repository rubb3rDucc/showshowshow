/**
 * Application constants
 */

/**
 * System user ID for service-level operations
 * Used by webhooks and background jobs that need to bypass normal user-based RLS
 * RLS policies check for this ID to allow full access
 */
export const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
