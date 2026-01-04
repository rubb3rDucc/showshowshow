import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Container,
  Card,
  Text,
  Button,
  Stack,
  Group,
  Divider,
  Loader,
  Center,
} from '@mantine/core';
import { IconMail, IconLock, IconTrash, IconUser } from '@tabler/icons-react';
import { useAuthStore } from '../stores/authStore';
import { getCurrentUser } from '../api/auth';
import { ChangeEmailModal } from '../components/settings/ChangeEmailModal';
import { ChangePasswordModal } from '../components/settings/ChangePasswordModal';
import { DeleteAccountModal } from '../components/settings/DeleteAccountModal';

export function Settings() {
  const { user: authUser } = useAuthStore();
  const [emailModalOpened, setEmailModalOpened] = useState(false);
  const [passwordModalOpened, setPasswordModalOpened] = useState(false);
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);

  // Fetch current user to get latest email and created_at
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: getCurrentUser,
    enabled: !!authUser,
  });

  const displayUser = user || authUser;

  // Format account created date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Container size="md" className="py-8">
        <Center py={60}>
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size="md" className="py-8">
      <Stack gap="xl">

        {/* Account Information */}
        <Card shadow="sm" padding="lg" radius="md" withBorder className="bg-[rgb(var(--color-bg-surface))] border-[rgb(var(--color-border-default))] dark:shadow-gray-950/50">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="lg" fw={600} className="mb-1 text-[rgb(var(--color-text-primary))]">
                  Account Information
                </Text>
                <Text size="sm" c="dimmed" className="text-[rgb(var(--color-text-secondary))]">
                  Your account details
                </Text>
              </div>
              <IconUser size={24} className="text-[rgb(var(--color-text-tertiary))]" />
            </Group>

            <Divider />

            <Stack gap="sm">
              <div>
                <Text size="sm" fw={500} className="mb-1 text-[rgb(var(--color-text-secondary))]">
                  Email Address
                </Text>
                <Text size="md" className="text-[rgb(var(--color-text-primary))]">{displayUser?.email || 'Not available'}</Text>
              </div>

              <div>
                <Text size="sm" fw={500} className="mb-1 text-[rgb(var(--color-text-secondary))]">
                  Member Since
                </Text>
                <Text size="md" className="text-[rgb(var(--color-text-primary))]">{formatDate(displayUser?.created_at)}</Text>
              </div>
            </Stack>
          </Stack>
        </Card>

        {/* Account Management */}
        <Card shadow="sm" padding="lg" radius="md" withBorder className="bg-[rgb(var(--color-bg-surface))] border-[rgb(var(--color-border-default))] dark:shadow-gray-950/50">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="lg" fw={600} className="mb-1 text-[rgb(var(--color-text-primary))]">
                  Account Management
                </Text>
                <Text size="sm" c="dimmed" className="text-[rgb(var(--color-text-secondary))]">
                  Update your email or password
                </Text>
              </div>
              <IconLock size={24} className="text-[rgb(var(--color-text-tertiary))]" />
            </Group>

            <Divider />

            <Stack gap="sm">
              <Button
                leftSection={<IconMail size={16} />}
                variant="light"
                onClick={() => setEmailModalOpened(true)}
                fullWidth
              >
                Change Email
              </Button>

              <Button
                leftSection={<IconLock size={16} />}
                variant="light"
                onClick={() => setPasswordModalOpened(true)}
                fullWidth
              >
                Change Password
              </Button>
            </Stack>
          </Stack>
        </Card>

        {/* Danger Zone */}
        <Card shadow="sm" padding="lg" radius="md" withBorder className="border-red-200 bg-red-50">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="lg" fw={600} className="mb-1 text-red-900">
                  Danger Zone
                </Text>
                <Text size="sm" c="dimmed" className="text-red-700">
                  Irreversible and destructive actions
                </Text>
              </div>
              <IconTrash size={24} className="text-red-600" />
            </Group>

            <Divider className="border-red-200" />

            <Stack gap="sm">
              <Text size="sm" className="text-red-800">
                Deleting your account will permanently remove all your data including:
              </Text>
              <ul className="list-disc list-inside text-sm text-red-800 space-y-1 ml-4">
                <li>All watch history</li>
                <li>All schedules</li>
                <li>All queue items</li>
                <li>All library items</li>
                <li>All preferences</li>
                <li>Your account information</li>
              </ul>
              <Text size="sm" fw={600} className="text-red-900 mt-2">
                This action cannot be undone.
              </Text>

              <Button
                leftSection={<IconTrash size={16} />}
                color="red"
                variant="filled"
                onClick={() => setDeleteModalOpened(true)}
                fullWidth
                className="mt-4"
              >
                Delete Account
              </Button>
            </Stack>
          </Stack>
        </Card>
      </Stack>

      {/* Modals */}
      <ChangeEmailModal
        opened={emailModalOpened}
        onClose={() => setEmailModalOpened(false)}
        currentEmail={displayUser?.email || ''}
      />

      <ChangePasswordModal
        opened={passwordModalOpened}
        onClose={() => setPasswordModalOpened(false)}
      />

      <DeleteAccountModal
        opened={deleteModalOpened}
        onClose={() => setDeleteModalOpened(false)}
        userEmail={displayUser?.email || ''}
      />
    </Container>
  );
}

