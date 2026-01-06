import { useState } from 'react';
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
import { IconMail, IconLock, IconUser } from '@tabler/icons-react';
import { useUser, useClerk } from '@clerk/clerk-react';

export function Settings() {
  const { user, isLoaded } = useUser();
  const { openUserProfile } = useClerk();
  const [isOAuthOnly, setIsOAuthOnly] = useState(false);

  // Check if user signed up with OAuth (no password)
  useState(() => {
    if (user) {
      const hasPassword = user.passwordEnabled;
      setIsOAuthOnly(!hasPassword);
    }
  });

  // Format account created date
  const formatDate = (dateString?: string | number | Date | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isLoaded) {
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
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="lg" fw={600} className="mb-1">
                  Account Information
                </Text>
                <Text size="sm" c="dimmed">
                  Your account details
                </Text>
              </div>
              <IconUser size={24} className="text-gray-400" />
            </Group>

            <Divider />

            <Stack gap="sm">
              <div>
                <Text size="sm" fw={500} className="mb-1">
                  Email Address
                </Text>
                <Text size="md">{user?.primaryEmailAddress?.emailAddress || 'Not available'}</Text>
              </div>

              <div>
                <Text size="sm" fw={500} className="mb-1">
                  Member Since
                </Text>
                <Text size="md">{formatDate(user?.createdAt)}</Text>
              </div>

              <div>
                <Text size="sm" fw={500} className="mb-1">
                  Sign-in Method
                </Text>
                <Text size="md">
                  {isOAuthOnly
                    ? `OAuth (${user?.externalAccounts?.[0]?.provider || 'Social'})`
                    : 'Email & Password'}
                </Text>
              </div>
            </Stack>
          </Stack>
        </Card>

        {/* Account Management */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="lg" fw={600} className="mb-1">
                  Account Management
                </Text>
                <Text size="sm" c="dimmed">
                  Update your email, password, or connected accounts
                </Text>
              </div>
              <IconLock size={24} className="text-gray-400" />
            </Group>

            <Divider />

            <Stack gap="sm">
              <Button
                leftSection={<IconMail size={16} />}
                variant="light"
                onClick={() => openUserProfile()}
                fullWidth
              >
                Change Email
              </Button>

              {!isOAuthOnly && (
                <Button
                  leftSection={<IconLock size={16} />}
                  variant="light"
                  onClick={() => openUserProfile()}
                  fullWidth
                >
                  Change Password
                </Button>
              )}

              <Button
                variant="light"
                onClick={() => openUserProfile()}
                fullWidth
              >
                Manage Connected Accounts
              </Button>

              <Text size="xs" c="dimmed" ta="center" mt="xs">
                Opens Clerk account management
              </Text>
            </Stack>
          </Stack>
        </Card>

        {/* Info about account deletion */}
        <Card shadow="sm" padding="lg" radius="md" withBorder className="border-blue-200 bg-blue-50">
          <Stack gap="md">
            <div>
              <Text size="lg" fw={600} className="mb-1 text-blue-900">
                Account Deletion
              </Text>
              <Text size="sm" className="text-blue-800">
                To delete your account, please use the Clerk account management panel.
                Click "Manage Connected Accounts" above to access full account settings.
              </Text>
            </div>
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}
