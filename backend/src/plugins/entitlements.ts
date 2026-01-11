import type { FastifyRequest } from 'fastify';
import { authenticateClerk } from './clerk-auth.js';
import { db } from '../db/index.js';
import { ForbiddenError } from '../lib/errors.js';
import type { Database } from '../db/types.js';

export type EntitlementPlan = 'free' | 'preview' | 'pro';

export interface UserEntitlement {
  user_id: string;
  plan: EntitlementPlan;
  preview_expires_at: Date | null;
  pro_expires_at: Date | null;
  stripe_customer_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Compute the effective plan based on entitlement dates
 * Priority: pro > preview > free
 */
export function computeEffectivePlan(entitlement: UserEntitlement): EntitlementPlan {
  const now = new Date();

  // Check pro first (highest priority)
  if (entitlement.pro_expires_at && entitlement.pro_expires_at > now) {
    return 'pro';
  }

  // Check preview (trial)
  if (entitlement.preview_expires_at && entitlement.preview_expires_at > now) {
    return 'preview';
  }

  // Default to free
  return 'free';
}

/**
 * Get a user's entitlement record
 */
export async function getUserEntitlement(
  userId: string
): Promise<UserEntitlement | null> {
  const entitlement = await db
    .selectFrom('user_entitlements')
    .selectAll()
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return entitlement || null;
}

/**
 * Check if user can access pro features (pro or preview plan)
 */
export function canAccessProFeatures(plan: EntitlementPlan): boolean {
  return plan === 'pro' || plan === 'preview';
}

/**
 * Middleware to require an active subscription (pro or preview)
 * Use as preHandler on protected routes
 * Note: Admins bypass subscription checks
 */
export async function requireActiveSubscription(
  request: FastifyRequest
): Promise<void> {
  // First, authenticate the user
  await authenticateClerk(request);

  if (!request.user) {
    throw new ForbiddenError('Authentication required');
  }

  // Admins bypass subscription checks
  if (request.user.isAdmin) {
    return;
  }

  // Get user's entitlement
  const entitlement = await getUserEntitlement(request.user.userId);

  if (!entitlement) {
    // No entitlement record - this shouldn't happen, but treat as free
    throw new ForbiddenError(
      'Active subscription required. Your trial has expired.'
    );
  }

  // Compute effective plan
  const effectivePlan = computeEffectivePlan(entitlement);

  // Check if user can access
  if (!canAccessProFeatures(effectivePlan)) {
    throw new ForbiddenError(
      'Active subscription required. Your trial has expired.'
    );
  }
}

/**
 * Get subscription status for the current user
 */
export async function getSubscriptionStatus(userId: string): Promise<{
  plan: EntitlementPlan;
  preview_expires_at: string | null;
  pro_expires_at: string | null;
  has_payment_method: boolean;
  subscription_status: string | null;
  can_access_pro_features: boolean;
}> {
  const entitlement = await getUserEntitlement(userId);

  if (!entitlement) {
    return {
      plan: 'free',
      preview_expires_at: null,
      pro_expires_at: null,
      has_payment_method: false,
      subscription_status: null,
      can_access_pro_features: false,
    };
  }

  const effectivePlan = computeEffectivePlan(entitlement);

  // Get subscription info if user has a stripe_customer_id
  let subscriptionStatus: string | null = null;
  let hasPaymentMethod = false;

  if (entitlement.stripe_customer_id) {
    const subscription = await db
      .selectFrom('stripe_subscriptions')
      .select(['status'])
      .where('user_id', '=', userId)
      .where('status', 'in', ['active', 'trialing', 'past_due'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    if (subscription) {
      subscriptionStatus = subscription.status;
      hasPaymentMethod = true;
    }
  }

  return {
    plan: effectivePlan,
    preview_expires_at: entitlement.preview_expires_at?.toISOString() || null,
    pro_expires_at: entitlement.pro_expires_at?.toISOString() || null,
    has_payment_method: hasPaymentMethod,
    subscription_status: subscriptionStatus,
    can_access_pro_features: canAccessProFeatures(effectivePlan),
  };
}
