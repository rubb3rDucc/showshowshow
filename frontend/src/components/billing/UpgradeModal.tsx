import { Modal, Button, Stack, Text, Group } from '@mantine/core';
import { CreditCard, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateCheckoutSession } from '../../api/billing';

interface UpgradeModalProps {
  opened: boolean;
  onClose: () => void;
  message?: string;
}

export function UpgradeModal({ opened, onClose, message }: UpgradeModalProps) {
  const createCheckoutMutation = useCreateCheckoutSession();

  const handleUpgrade = async () => {
    try {
      const { checkout_url } = await createCheckoutMutation.mutateAsync({
        success_url: `${window.location.origin}${window.location.pathname}?subscription=success`,
        cancel_url: `${window.location.origin}${window.location.pathname}?subscription=cancelled`,
      });
      window.location.href = checkout_url;
    } catch (err) {
      toast.error('Failed to start checkout. Please try again.');
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Upgrade Required"
      centered
      size="sm"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {message || 'Your trial has expired. Upgrade to continue making changes.'}
        </Text>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <Text size="md" fw={600} className="text-gray-900">
            ShowShowShow Paid
          </Text>
          <Text size="xl" fw={700} className="text-teal-600 mt-1">
            $5
            <Text span size="sm" fw={400} c="dimmed">
              /month
            </Text>
          </Text>
          <Stack gap="xs" className="mt-3">
            <Text size="sm" className="text-gray-700">
              - Unlimited library items
            </Text>
            <Text size="sm" className="text-gray-700">
              - Auto-scheduler
            </Text>
            <Text size="sm" className="text-gray-700">
              - Full viewing statistics
            </Text>
            <Text size="sm" className="text-gray-700">
              - All premium features
            </Text>
          </Stack>
        </div>

        <Group grow>
          <Button
            variant="default"
            leftSection={<X size={16} />}
            onClick={onClose}
          >
            Maybe Later
          </Button>
          <Button
            color="teal"
            leftSection={<CreditCard size={16} />}
            onClick={handleUpgrade}
            loading={createCheckoutMutation.isPending}
          >
            Upgrade Now
          </Button>
        </Group>

        <Text size="xs" c="dimmed" ta="center">
          Your data is preserved. You can still view your library and schedules.
        </Text>
      </Stack>
    </Modal>
  );
}
