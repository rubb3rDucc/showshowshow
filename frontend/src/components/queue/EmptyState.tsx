import React from 'react';
import { Stack, Text, Button, Center } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'wouter';

export function EmptyState() {
  return (
    <Center py={60}>
      <Stack align="center" gap="md">
        <IconPlus size={40} stroke={1.5} opacity={0.3} />
        <Text size="sm" fw={500} c="dimmed">
          Queue is Empty
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          Add shows and movies from the search page
        </Text>
        <Link href="/search">
          <Button variant="light" size="sm" leftSection={<IconPlus size={14} />}>
            Browse Content
          </Button>
        </Link>
      </Stack>
    </Center>
  );
}

