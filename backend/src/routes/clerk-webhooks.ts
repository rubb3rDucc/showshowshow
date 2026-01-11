import { Webhook } from 'svix';
import { db } from '../db/index.js';
import { setUserContext } from '../db/rls-context.js';
import { SYSTEM_USER_ID } from '../lib/constants.js';
import { identifyUser } from '../lib/posthog.js';
import { stripe } from '../lib/stripe.js';
import type { FastifyInstance } from 'fastify';
import type { WebhookEvent } from '@clerk/backend';

// Type definitions for webhook event data
interface UserEventData {
  id: string;
  email_addresses: Array<{ id: string; email_address: string }>;
  primary_email_address_id: string;
  public_metadata?: Record<string, any>;
}

interface DeletedEventData {
  id: string;
}

export const clerkWebhookRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/api/webhooks/clerk', async (request, reply) => {
    console.log('📥 Clerk webhook received');

    // Get the Svix headers for webhook verification
    const svix_id = request.headers['svix-id'] as string;
    const svix_timestamp = request.headers['svix-timestamp'] as string;
    const svix_signature = request.headers['svix-signature'] as string;

    // If there are no Svix headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      console.log('❌ Missing Svix headers');
      return reply.code(400).send({
        error: 'Missing Svix headers'
      });
    }

    // Get the webhook secret from environment variables
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.log('❌ CLERK_WEBHOOK_SECRET not configured');
      return reply.code(500).send({
        error: 'Webhook secret not configured'
      });
    }

    // Create a new Svix instance with the webhook secret
    const wh = new Webhook(webhookSecret);

    let evt: WebhookEvent;

    // Verify the webhook signature
    try {
      const payload = JSON.stringify(request.body);
      evt = wh.verify(payload, {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      }) as WebhookEvent;
      console.log(`✅ Webhook verified: ${evt.type}`);
    } catch (err) {
      console.log('❌ Invalid webhook signature:', err);
      return reply.code(400).send({
        error: 'Invalid webhook signature'
      });
    }

    // Handle the webhook event
    try {
      // Set system context for RLS bypass - webhooks run as service account
      await setUserContext(SYSTEM_USER_ID);

      switch (evt.type) {
        case 'user.created':
          console.log('👤 Processing user.created event');
          await handleUserCreated(evt);
          console.log('✅ User created successfully');
          break;
        case 'user.updated':
          console.log('👤 Processing user.updated event');
          await handleUserUpdated(evt);
          console.log('✅ User updated successfully');
          break;
        case 'user.deleted':
          console.log('👤 Processing user.deleted event');
          await handleUserDeleted(evt);
          console.log('✅ User deleted successfully');
          break;
        default:
          console.log(`ℹ️ Unhandled webhook event type: ${evt.type}`);
          break;
      }

      return reply.send({ success: true });
    } catch (err) {
      console.error('❌ Error processing webhook:', err);
      return reply.code(500).send({
        error: 'Error processing webhook'
      });
    }
  });
};

/**
 * Handle user.created webhook event
 * Creates a new user in the database with default preferences
 */
async function handleUserCreated(evt: WebhookEvent) {
  const data = evt.data as UserEventData;
  const clerkUserId = data.id;
  const email_addresses = data.email_addresses;
  const public_metadata = data.public_metadata;

  // Get primary email address
  const primaryEmail = email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );

  if (!primaryEmail) {
    throw new Error('No primary email found for user');
  }

  const email = primaryEmail.email_address.toLowerCase();
  const isAdmin = public_metadata?.isAdmin === true;

  // Check if user already exists by clerk_user_id (idempotency)
  const existingClerkUser = await db
    .selectFrom('users')
    .select('id')
    .where('clerk_user_id', '=', clerkUserId)
    .executeTakeFirst();

  if (existingClerkUser) {
    return;
  }

  // Check if user exists with this email (migrating from old auth)
  const existingEmailUser = await db
    .selectFrom('users')
    .select(['id', 'auth_provider'])
    .where('email', '=', email)
    .executeTakeFirst();

  if (existingEmailUser) {
    // Link existing user to Clerk (upgrade from old auth)
    await db
      .updateTable('users')
      .set({
        clerk_user_id: clerkUserId,
        auth_provider: 'clerk',
        is_admin: isAdmin,
        updated_at: new Date(),
      })
      .where('id', '=', existingEmailUser.id)
      .execute();

    return;
  }

  // Check if this email was previously deleted (trial abuse prevention)
  const previouslyDeleted = await db
    .selectFrom('deleted_users')
    .select(['email', 'had_active_subscription', 'deleted_at'])
    .where('email', '=', email)
    .executeTakeFirst();

  // If user previously had a subscription, or deleted within last 30 days, no new trial
  const skipTrial = previouslyDeleted && (
    previouslyDeleted.had_active_subscription ||
    (previouslyDeleted.deleted_at && (Date.now() - new Date(previouslyDeleted.deleted_at).getTime()) < 30 * 24 * 60 * 60 * 1000)
  );

  // Create user and preferences in a transaction
  await db.transaction().execute(async (trx) => {
    const userId = crypto.randomUUID();

    // Create user
    await trx
      .insertInto('users')
      .values({
        id: userId,
        email: email,
        password_hash: null, // OAuth users don't have passwords
        clerk_user_id: clerkUserId,
        auth_provider: 'clerk',
        is_admin: isAdmin,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    // Create default user preferences
    await trx
      .insertInto('user_preferences')
      .values({
        id: crypto.randomUUID(),
        user_id: userId,
        include_reruns: false,
        rerun_frequency: 'sometimes',
        max_shows_per_time_slot: 2,
        time_slot_duration: 30,
        allow_overlap: false,
        default_start_time: null,
        default_end_time: null,
        onboarding_completed: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    // Create user_entitlements
    // Skip trial if user previously deleted account (abuse prevention)
    const trialExpiresAt = skipTrial ? null : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const initialPlan = skipTrial ? 'free' : 'preview';

    await trx
      .insertInto('user_entitlements')
      .values({
        user_id: userId,
        plan: initialPlan,
        preview_expires_at: trialExpiresAt,
        pro_expires_at: null,
        stripe_customer_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute();

    // Identify user in PostHog for MAU tracking
    identifyUser(userId, {
      email: email,
      created_at: new Date().toISOString(),
      auth_provider: 'clerk',
      is_admin: isAdmin,
      signup_source: 'clerk_webhook',
      plan: initialPlan,
      trial_expires_at: trialExpiresAt?.toISOString() || null,
      is_returning_user: !!previouslyDeleted,
    });
  });
}

/**
 * Handle user.updated webhook event
 * Updates user email and admin status
 */
async function handleUserUpdated(evt: WebhookEvent) {
  const data = evt.data as UserEventData;
  const clerkUserId = data.id;
  const email_addresses = data.email_addresses;
  const public_metadata = data.public_metadata;

  // Get primary email address
  const primaryEmail = email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );

  if (!primaryEmail) {
    throw new Error('No primary email found for user');
  }

  const email = primaryEmail.email_address.toLowerCase();
  const isAdmin = public_metadata?.isAdmin === true;

  // Update user in database
  await db
    .updateTable('users')
    .set({
      email: email,
      is_admin: isAdmin,
      updated_at: new Date(),
    })
    .where('clerk_user_id', '=', clerkUserId)
    .execute();
}

/**
 * Handle user.deleted webhook event
 * Records deletion in audit log, cancels subscriptions, and removes user from database
 */
async function handleUserDeleted(evt: WebhookEvent) {
  const data = evt.data as DeletedEventData;
  const clerkUserId = data.id;

  // Get user data before deletion (to access subscription info)
  const user = await db
    .selectFrom('users')
    .select(['id', 'email'])
    .where('clerk_user_id', '=', clerkUserId)
    .executeTakeFirst();

  if (!user) {
    return;
  }

  // Get entitlement and subscription info before deletion
  const entitlement = await db
    .selectFrom('user_entitlements')
    .select(['stripe_customer_id'])
    .where('user_id', '=', user.id)
    .executeTakeFirst();

  const subscription = entitlement?.stripe_customer_id
    ? await db
        .selectFrom('stripe_subscriptions')
        .select(['stripe_subscription_id', 'status'])
        .where('user_id', '=', user.id)
        .where('status', 'in', ['active', 'trialing'])
        .executeTakeFirst()
    : null;

  // Use transaction to ensure atomic deletion + audit logging
  await db.transaction().execute(async (trx) => {
    // 1. Record deletion in audit log (GDPR compliance - survives backups)
    await trx
      .insertInto('deleted_users')
      .values({
        clerk_user_id: clerkUserId,
        email: user.email,
        deleted_at: new Date(),
        deleted_reason: 'user_requested',
        stripe_customer_id: entitlement?.stripe_customer_id || null,
        stripe_subscription_id: subscription?.stripe_subscription_id || null,
        had_active_subscription: !!subscription,
      })
      .execute();

    // 2. Cancel subscription if user has one
    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.instance.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            cancel_at_period_end: true, // Let them finish their billing period
          }
        );
        console.log(`Scheduled subscription cancellation for user ${user.id}`);
      } catch (stripeError) {
        console.error(`Failed to cancel subscription: ${stripeError}`);
        // Continue with deletion - admin will need to manually cancel via Stripe dashboard
      }
    }

    // 3. Delete user from database
    // Note: Database CASCADE constraints will automatically delete:
    //   - user_preferences
    //   - user_entitlements
    //   - queue items
    //   - schedule items
    //   - watch_history
    //   - library_items
    //   - programming_blocks
    //   - rotation_groups
    //   - stripe_subscriptions
    await trx
      .deleteFrom('users')
      .where('clerk_user_id', '=', clerkUserId)
      .execute();
  });
}
