import { Webhook } from 'svix';
import { db } from '../db/index.js';
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
    // Get the Svix headers for webhook verification
    const svix_id = request.headers['svix-id'] as string;
    const svix_timestamp = request.headers['svix-timestamp'] as string;
    const svix_signature = request.headers['svix-signature'] as string;

    // If there are no Svix headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return reply.code(400).send({
        error: 'Missing Svix headers'
      });
    }

    // Get the webhook secret from environment variables
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
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
    } catch (err) {
      console.error('Error verifying webhook:', err);
      return reply.code(400).send({
        error: 'Invalid webhook signature'
      });
    }

    // Handle the webhook event
    try {
      switch (evt.type) {
        case 'user.created':
          await handleUserCreated(evt);
          break;
        case 'user.updated':
          await handleUserUpdated(evt);
          break;
        case 'user.deleted':
          await handleUserDeleted(evt);
          break;
        default:
          console.log(`Unhandled webhook event type: ${evt.type}`);
      }

      return reply.send({ success: true });
    } catch (error) {
      console.error('Error handling webhook event:', error);
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

  // Check if user already exists (idempotency)
  const existingUser = await db
    .selectFrom('users')
    .select('id')
    .where('clerk_user_id', '=', clerkUserId)
    .executeTakeFirst();

  if (existingUser) {
    console.log(`User ${clerkUserId} already exists, skipping creation`);
    return;
  }

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

    console.log(`Created user ${userId} for Clerk user ${clerkUserId}`);
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
  const result = await db
    .updateTable('users')
    .set({
      email: email,
      is_admin: isAdmin,
      updated_at: new Date(),
    })
    .where('clerk_user_id', '=', clerkUserId)
    .execute();

  console.log(`Updated user for Clerk user ${clerkUserId}`);
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
    console.warn(`User not found for Clerk user ${clerkUserId}, skipping deletion`);
    return;
  }

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
        stripe_customer_id: null, // TODO: Add when Stripe integration is complete
        stripe_subscription_id: null, // TODO: Add when Stripe integration is complete
        had_active_subscription: false, // TODO: Set based on subscription status
      })
      .execute();

    // 2. TODO: Cancel subscription if user has one
    // Example with Stripe (uncomment when Stripe is integrated):
    // if (user.stripe_subscription_id) {
    //   try {
    //     await stripe.subscriptions.update(user.stripe_subscription_id, {
    //       cancel_at_period_end: true, // Let them finish their billing period
    //     });
    //     console.log(`Scheduled subscription cancellation for user ${user.id}`);
    //   } catch (stripeError) {
    //     console.error(`Failed to cancel subscription: ${stripeError}`);
    //     // Continue with deletion - admin will need to manually cancel via Stripe dashboard
    //   }
    // }

    // 3. Delete user from database
    // Note: Database CASCADE constraints will automatically delete:
    //   - user_preferences
    //   - queue items
    //   - schedule items
    //   - watch_history
    //   - library_items
    //   - programming_blocks
    //   - rotation_groups
    await trx
      .deleteFrom('users')
      .where('clerk_user_id', '=', clerkUserId)
      .execute();
  });

  console.log(`✅ Deleted user ${user.email} (${user.id}) for Clerk user ${clerkUserId}`);
  console.log(`   Deletion logged in audit table for GDPR compliance`);
}
