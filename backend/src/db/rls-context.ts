/**
 * Row Level Security (RLS) context helpers
 * Sets PostgreSQL session variables for RLS policy enforcement
 */

import { sql } from 'kysely';
import { db } from './index.js';

/**
 * Set the current user context for RLS policies
 * This should be called at the start of each authenticated request
 *
 * @param userId - The UUID of the authenticated user (or SYSTEM_USER_ID for webhooks)
 */
export async function setUserContext(userId: string): Promise<void> {
  // Using set_config with is_local=true makes it session-local
  // This works correctly with connection pooling
  await sql`SELECT set_config('app.current_user_id', ${userId}, true)`.execute(db);
}

/**
 * Clear the current user context
 * Called after request completes to ensure clean state for connection pool
 */
export async function clearUserContext(): Promise<void> {
  await sql`SELECT set_config('app.current_user_id', '', true)`.execute(db);
}

/**
 * Get the current user context (useful for debugging)
 */
export async function getUserContext(): Promise<string | null> {
  const result = await sql<{ current_user_id: string }>`
    SELECT current_setting('app.current_user_id', true) as current_user_id
  `.execute(db);

  return result.rows[0]?.current_user_id || null;
}
