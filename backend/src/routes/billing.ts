import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { authenticateClerk } from '../plugins/clerk-auth.js';
import { getSubscriptionStatus } from '../plugins/entitlements.js';
import {
  createCheckoutSession,
  createCustomerPortalSession,
  handleSubscriptionChange,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  isEventProcessed,
  recordWebhookEvent,
  stripe,
} from '../lib/stripe.js';
// Note: We don't use BadRequestError here - webhook errors are handled via HTTP status codes

interface CheckoutSessionBody {
  success_url?: string;
  cancel_url?: string;
}

interface PortalSessionBody {
  return_url?: string;
}

export const billingRoutes = async (fastify: FastifyInstance) => {
  /**
   * GET /api/billing/status
   * Get current subscription status
   */
  fastify.get(
    '/api/billing/status',
    { preHandler: authenticateClerk },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const status = await getSubscriptionStatus(userId);
      return reply.send(status);
    }
  );

  /**
   * POST /api/billing/checkout-session
   * Create a Stripe Checkout session for subscription purchase
   */
  fastify.post<{ Body: CheckoutSessionBody }>(
    '/api/billing/checkout-session',
    { preHandler: authenticateClerk },
    async (request: FastifyRequest<{ Body: CheckoutSessionBody }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const email = request.user!.email;

      const defaultSuccessUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?subscription=success`;
      const defaultCancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings?subscription=cancelled`;

      const successUrl = request.body?.success_url || defaultSuccessUrl;
      const cancelUrl = request.body?.cancel_url || defaultCancelUrl;

      const checkoutUrl = await createCheckoutSession(
        userId,
        email,
        successUrl,
        cancelUrl
      );

      return reply.send({ checkout_url: checkoutUrl });
    }
  );

  /**
   * POST /api/billing/portal-session
   * Create a Stripe Customer Portal session for subscription management
   */
  fastify.post<{ Body: PortalSessionBody }>(
    '/api/billing/portal-session',
    { preHandler: authenticateClerk },
    async (request: FastifyRequest<{ Body: PortalSessionBody }>, reply: FastifyReply) => {
      const userId = request.user!.userId;

      const defaultReturnUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings`;
      const returnUrl = request.body?.return_url || defaultReturnUrl;

      const portalUrl = await createCustomerPortalSession(userId, returnUrl);

      return reply.send({ portal_url: portalUrl });
    }
  );

  /**
   * POST /api/billing/webhook
   * Handle Stripe webhook events
   * No authentication - validates using Stripe signature
   *
   * Note: We use preParsing hook to capture raw body for signature verification
   * without affecting other routes' JSON parsing.
   */
  fastify.post(
    '/api/billing/webhook',
    {
      // Capture raw body before parsing for Stripe signature verification
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(chunk as Buffer);
        }
        const rawBody = Buffer.concat(chunks).toString('utf8');
        (request as any).rawBody = rawBody;
        // Return a new stream with the same content for Fastify to parse
        const { Readable } = await import('stream');
        return Readable.from([rawBody]);
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sig = request.headers['stripe-signature'] as string;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        request.log.error('STRIPE_WEBHOOK_SECRET not configured');
        return reply.code(500).send({ error: 'Webhook secret not configured' });
      }

      let event: Stripe.Event;

      try {
        // Use rawBody for signature verification
        const rawBody = (request as any).rawBody;
        if (!rawBody) {
          throw new Error('Raw body not available');
        }
        event = stripe.instance.webhooks.constructEvent(
          rawBody,
          sig,
          webhookSecret
        );
      } catch (err) {
        request.log.error(`Webhook signature verification failed: ${err}`);
        return reply.code(400).send({ error: 'Invalid signature' });
      }

      // Check idempotency - skip if already processed
      if (await isEventProcessed(event.id)) {
        request.log.info(`Webhook event ${event.id} already processed, skipping`);
        return reply.send({ received: true, skipped: true });
      }

      let errorMessage: string | undefined;

      try {
        // Route to appropriate handler
        switch (event.type) {
          case 'customer.subscription.created':
          case 'customer.subscription.updated':
            await handleSubscriptionChange(
              event.data.object as Stripe.Subscription
            );
            break;

          case 'customer.subscription.deleted':
            await handleSubscriptionDeleted(
              event.data.object as Stripe.Subscription
            );
            break;

          case 'invoice.payment_succeeded':
            await handleInvoicePaymentSucceeded(
              event.data.object as Stripe.Invoice
            );
            break;

          case 'invoice.payment_failed':
            await handleInvoicePaymentFailed(
              event.data.object as Stripe.Invoice
            );
            break;

          default:
            request.log.info(`Unhandled webhook event type: ${event.type}`);
        }
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        request.log.error(`Error processing webhook ${event.id}: ${errorMessage}`);
        // Don't throw - we still want to acknowledge receipt
      }

      // Record the event for idempotency
      await recordWebhookEvent(
        event.id,
        event.type,
        event.data.object as Record<string, any>,
        undefined,
        errorMessage
      );

      // Always return 200 to acknowledge receipt
      return reply.send({ received: true });
    }
  );
};
