import Stripe from 'stripe';
import { db } from '../db/index.js';
import { captureEvent } from './posthog.js';

// Initialize Stripe with the secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripePriceId = process.env.STRIPE_PRICE_ID;

// Create stripe instance lazily to allow for missing keys during startup
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(stripeSecretKey);
  }
  return stripeInstance;
}

export const stripe = {
  get instance() {
    return getStripe();
  },
};

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Check if user already has a stripe_customer_id
  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['stripe_customer_id'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (entitlement?.stripe_customer_id) {
    return entitlement.stripe_customer_id;
  }

  // Create a new Stripe customer
  const customer = await getStripe().customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });

  // Update user_entitlements with the new customer ID
  await db
    .updateTable('user_entitlements')
    .set({
      stripe_customer_id: customer.id,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();

  return customer.id;
}

/**
 * Create a Stripe Checkout session for subscription purchase
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  if (!stripePriceId) {
    throw new Error('STRIPE_PRICE_ID is not configured');
  }

  const customerId = await getOrCreateStripeCustomer(userId, email);

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        user_id: userId,
      },
    },
  });

  // Track checkout session created
  captureEvent('checkout_session_created', {
    distinctId: userId,
    properties: {
      session_id: session.id,
      price_id: stripePriceId,
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return session.url;
}

/**
 * Create a Stripe Customer Portal session for subscription management
 */
export async function createCustomerPortalSession(
  userId: string,
  returnUrl: string
): Promise<string> {
  // Get the user's stripe_customer_id
  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['stripe_customer_id'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!entitlement?.stripe_customer_id) {
    throw new Error('User does not have a Stripe customer ID');
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: entitlement.stripe_customer_id,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Sync a Stripe subscription to user_entitlements and stripe_subscriptions
 */
export async function syncSubscriptionToEntitlements(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Find user by stripe_customer_id
  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['user_id'])
    .where('stripe_customer_id', '=', customerId)
    .executeTakeFirst();

  if (!entitlement) {
    console.error(
      `No user found for stripe_customer_id: ${customerId}`
    );
    return;
  }

  const userId = entitlement.user_id;
  const isActive =
    subscription.status === 'active' || subscription.status === 'trialing';

  // Get the first subscription item to access period info (API 2025-12-15.clover moved these)
  const firstItem = subscription.items.data[0];
  const currentPeriodStart = firstItem?.current_period_start;
  const currentPeriodEnd = firstItem?.current_period_end;

  // Update user_entitlements
  await db
    .updateTable('user_entitlements')
    .set({
      plan: isActive ? 'pro' : 'free',
      pro_expires_at: isActive && currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000)
        : null,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();

  // Get the price ID from the subscription
  const priceId = firstItem?.price?.id || '';

  // Upsert stripe_subscriptions record
  const existingSubscription = await db
    .selectFrom('stripe_subscriptions')
    .select(['id'])
    .where('stripe_subscription_id', '=', subscription.id)
    .executeTakeFirst();

  if (existingSubscription) {
    await db
      .updateTable('stripe_subscriptions')
      .set({
        status: subscription.status as any,
        current_period_start: currentPeriodStart
          ? new Date(currentPeriodStart * 1000)
          : new Date(),
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : new Date(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        updated_at: new Date(),
      })
      .where('id', '=', existingSubscription.id)
      .execute();
  } else {
    await db
      .insertInto('stripe_subscriptions')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        stripe_price_id: priceId,
        status: subscription.status as any,
        current_period_start: currentPeriodStart
          ? new Date(currentPeriodStart * 1000)
          : new Date(),
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : new Date(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at
          ? new Date(subscription.canceled_at * 1000)
          : null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();
  }

  // Track subscription event
  captureEvent('subscription_synced', {
    distinctId: userId,
    properties: {
      subscription_id: subscription.id,
      status: subscription.status,
      is_active: isActive,
    },
  });
}

/**
 * Handle subscription.created or subscription.updated webhook
 */
export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
): Promise<void> {
  await syncSubscriptionToEntitlements(subscription);

  // Track specific events
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['user_id'])
    .where('stripe_customer_id', '=', customerId)
    .executeTakeFirst();

  if (entitlement) {
    if (
      subscription.status === 'active' &&
      !subscription.cancel_at_period_end
    ) {
      captureEvent('subscription_created', {
        distinctId: entitlement.user_id,
        properties: {
          subscription_id: subscription.id,
        },
      });
    }
  }
}

/**
 * Handle subscription.deleted webhook
 */
export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Find user by stripe_customer_id
  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['user_id'])
    .where('stripe_customer_id', '=', customerId)
    .executeTakeFirst();

  if (!entitlement) {
    console.error(
      `No user found for stripe_customer_id: ${customerId}`
    );
    return;
  }

  const userId = entitlement.user_id;

  // Update user_entitlements to free plan
  await db
    .updateTable('user_entitlements')
    .set({
      plan: 'free',
      pro_expires_at: null,
      updated_at: new Date(),
    })
    .where('user_id', '=', userId)
    .execute();

  // Update stripe_subscriptions record
  await db
    .updateTable('stripe_subscriptions')
    .set({
      status: 'canceled',
      canceled_at: new Date(),
      updated_at: new Date(),
    })
    .where('stripe_subscription_id', '=', subscription.id)
    .execute();

  // Track subscription canceled
  captureEvent('subscription_canceled', {
    distinctId: userId,
    properties: {
      subscription_id: subscription.id,
    },
  });
}

/**
 * Handle invoice.payment_succeeded webhook
 */
export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['user_id'])
    .where('stripe_customer_id', '=', customerId)
    .executeTakeFirst();

  if (entitlement) {
    captureEvent('payment_succeeded', {
      distinctId: entitlement.user_id,
      properties: {
        invoice_id: invoice.id,
        amount: invoice.amount_paid,
      },
    });
  }
}

/**
 * Handle invoice.payment_failed webhook
 */
export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['user_id'])
    .where('stripe_customer_id', '=', customerId)
    .executeTakeFirst();

  if (entitlement) {
    captureEvent('payment_failed', {
      distinctId: entitlement.user_id,
      properties: {
        invoice_id: invoice.id,
        amount: invoice.amount_due,
      },
    });
  }
}

/**
 * Check if a webhook event has already been processed (idempotency)
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
  const existing = await db
    .selectFrom('stripe_webhook_events')
    .select(['id'])
    .where('stripe_event_id', '=', eventId)
    .executeTakeFirst();

  return !!existing;
}

/**
 * Record a webhook event as processed
 */
export async function recordWebhookEvent(
  eventId: string,
  eventType: string,
  payload: Record<string, any>,
  userId?: string,
  errorMessage?: string
): Promise<void> {
  await db
    .insertInto('stripe_webhook_events')
    .values({
      id: crypto.randomUUID(),
      stripe_event_id: eventId,
      event_type: eventType,
      processed_at: new Date(),
      payload,
      user_id: userId || null,
      error_message: errorMessage || null,
      created_at: new Date(),
    })
    .execute();
}
