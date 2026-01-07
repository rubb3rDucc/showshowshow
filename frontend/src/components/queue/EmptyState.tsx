import { Stack, Text, Button, Center } from '@mantine/core';
import { Link } from 'wouter';

export function EmptyState() {
  return (
    <Center py={60}>
      <Stack align="center" gap="md">
        <Text size="sm" fw={500} c="dimmed">
          Queue is Empty
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          Add shows and movies from the search page
        </Text>
        <Link href="/search">
          <Button variant="light" size="sm">
            Browse Content
          </Button>
        </Link>
      </Stack>
    </Center>
  );
}
