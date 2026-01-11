import { useEffect } from 'react';
import { Card, Text, Button, Stack, Group, Divider, Badge, Loader, Center } from '@mantine/core';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import {
  useSubscriptionStatus,
  useCreateCheckoutSession,
  useCreatePortalSession,
  getDaysRemaining,
  getPlanDisplayName,
} from '../../api/billing';

export function BillingSection() {
  const { data: subscriptionStatus, isLoading, error } = useSubscriptionStatus();
  const createCheckoutMutation = useCreateCheckoutSession();
  const createPortalMutation = useCreatePortalSession();

  // Check for success/cancelled query params from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionResult = params.get('subscription');

    if (subscriptionResult === 'success') {
      toast.success('Subscription activated successfully!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (subscriptionResult === 'cancelled') {
      toast.info('Checkout cancelled');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleUpgrade = async () => {
    try {
      const { checkout_url } = await createCheckoutMutation.mutateAsync({
        success_url: `${window.location.origin}/settings?subscription=success`,
        cancel_url: `${window.location.origin}/settings?subscription=cancelled`,
      });
      window.location.href = checkout_url;
    } catch (err) {
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  const handleManageBilling = async () => {
    try {
      const { portal_url } = await createPortalMutation.mutateAsync({
        return_url: `${window.location.origin}/settings`,
      });
      window.location.href = portal_url;
    } catch (err) {
      toast.error('Failed to open billing portal. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Center py="md">
          <Loader size="sm" />
        </Center>
      </Card>
    );
  }

  if (error || !subscriptionStatus) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text size="lg" fw={600} className="mb-1">
                Subscription & Billing
              </Text>
              <Text size="sm" c="dimmed">
                Unable to load subscription status
              </Text>
            </div>
            <CreditCard size={24} className="text-gray-400" />
          </Group>
        </Stack>
      </Card>
    );
  }

  const { plan, preview_expires_at, pro_expires_at } = subscriptionStatus;
  const daysRemaining = getDaysRemaining(preview_expires_at);
  const isPro = plan === 'pro';
  const isPreview = plan === 'preview';
  const isFree = plan === 'free';

  // Calculate renewal date for Pro users
  const renewalDate = pro_expires_at ? new Date(pro_expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : null;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <div>
            <Text size="lg" fw={600} className="mb-1">
              Subscription & Billing
            </Text>
            <Text size="sm" c="dimmed">
              Manage your subscription and billing settings
            </Text>
          </div>
          <CreditCard size={24} className="text-gray-400" />
        </Group>

        <Divider />

        <Stack gap="sm">
          {/* Current Plan */}
          <div>
            <Text size="sm" fw={500} className="mb-1">
              Current Plan
            </Text>
            <Group gap="sm">
              <Badge
                size="lg"
                variant={isPro ? 'filled' : isPreview ? 'light' : 'outline'}
                color={isPro ? 'teal' : isPreview ? 'blue' : 'gray'}
              >
                {getPlanDisplayName(plan)}
              </Badge>
              {isPreview && daysRemaining !== null && (
                <Text size="sm" c="dimmed">
                  {daysRemaining > 0
                    ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
                    : 'Trial expired'}
                </Text>
              )}
              {isPro && renewalDate && (
                <Text size="sm" c="dimmed">
                  Renews on {renewalDate}
                </Text>
              )}
            </Group>
          </div>

          {/* Trial Warning */}
          {isPreview && daysRemaining !== null && daysRemaining <= 3 && daysRemaining > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <Text size="sm" className="text-yellow-800">
                Your trial ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}.
                Upgrade now to keep access to all features.
              </Text>
            </div>
          )}

          {/* Expired Trial Warning */}
          {isFree && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <Text size="sm" className="text-red-800">
                Your trial has expired. Your data is preserved, but you need to upgrade to make changes.
              </Text>
            </div>
          )}

          {/* Pricing Info for non-Pro users */}
          {!isPro && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <Text size="sm" fw={500} className="text-gray-900">
                ShowShowShow Paid - $5/month
              </Text>
              <Text size="xs" c="dimmed" className="mt-1">
                Unlimited library, auto-scheduler, full statistics, and all premium features.
              </Text>
            </div>
          )}
        </Stack>

        <Divider />

        {/* Action Buttons */}
        <Stack gap="sm">
          {!isPro && (
            <Button
              leftSection={<CreditCard size={16} />}
              color="teal"
              variant="filled"
              onClick={handleUpgrade}
              loading={createCheckoutMutation.isPending}
              fullWidth
            >
              Upgrade to Paid
            </Button>
          )}

          {isPro && (
            <Button
              leftSection={<CreditCard size={16} />}
              variant="light"
              onClick={handleManageBilling}
              loading={createPortalMutation.isPending}
              fullWidth
            >
              Manage Billing
            </Button>
          )}

          {isPro && (
            <Text size="xs" c="dimmed" ta="center">
              Manage payment methods, view invoices, or cancel subscription
            </Text>
          )}
        </Stack>
      </Stack>
    </Card>
  );
}
