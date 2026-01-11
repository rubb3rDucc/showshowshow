/**
 * User activation tracking
 *
 * A user is considered "activated" when they:
 * 1. Have generated at least one schedule
 * 2. Have watched at least one item from a schedule
 *
 * This is the "aha moment" that indicates the user understands and gets value from the product.
 */

import { db } from '../db/index.js';
import { captureEvent, setUserProperties } from './posthog.js';

/**
 * Check if user has met activation criteria and fire event if first time
 */
export async function checkAndFireActivation(userId: string): Promise<boolean> {
  // Check if user has already been activated (stored as user property)
  // We track this in the database to avoid duplicate events
  const user = await db
    .selectFrom('users')
    .select(['activated_at'])
    .where('clerk_user_id', '=', userId)
    .executeTakeFirst();

  // Already activated
  if (user?.activated_at) {
    return false;
  }

  // Check criteria:
  // 1. Has generated at least one schedule (has schedule items with source_type = 'auto' or 'rotation')
  const hasGeneratedSchedule = await db
    .selectFrom('schedule')
    .select('id')
    .where('user_id', '=', userId)
    .where('source_type', 'in', ['auto', 'rotation'])
    .limit(1)
    .executeTakeFirst();

  if (!hasGeneratedSchedule) {
    return false;
  }

  // 2. Has watched at least one item from schedule
  const hasWatchedFromSchedule = await db
    .selectFrom('schedule')
    .select('id')
    .where('user_id', '=', userId)
    .where('watched', '=', true)
    .limit(1)
    .executeTakeFirst();

  if (!hasWatchedFromSchedule) {
    return false;
  }

  // User is activated! Record it
  const activatedAt = new Date();

  // Update user record
  await db
    .updateTable('users')
    .set({ activated_at: activatedAt })
    .where('clerk_user_id', '=', userId)
    .execute();

  // Fire PostHog event
  captureEvent('user_activated', {
    distinctId: userId,
    properties: {
      activated_at: activatedAt.toISOString(),
    },
  });

  // Set user property for segmentation
  setUserProperties(userId, {
    activated: true,
    activated_at: activatedAt.toISOString(),
  });

  return true;
}
