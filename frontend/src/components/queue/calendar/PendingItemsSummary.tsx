import { Card, Group, Text, Badge, Button, Stack, ScrollArea } from '@mantine/core';
import { Check } from 'lucide-react';
import type { PendingScheduleItem } from './types';

interface PendingItemsSummaryProps {
  pendingItems: Map<string, PendingScheduleItem>;
  onSaveAll: () => void;
  onRemove: (id: string) => void;
  isLoading: boolean;
}

export function PendingItemsSummary({
  pendingItems,
  onSaveAll,
  onRemove,
  isLoading,
}: PendingItemsSummaryProps) {
  if (pendingItems.size === 0) return null;

  return (
    <Card withBorder p="md" style={{ backgroundColor: '#fff3cd' }}>
      <Group justify="space-between" mb="sm">
        <Group gap="xs">
          <Text fw={600} size="sm">
            Pending Items ({pendingItems.size})
          </Text>
          <Badge color="yellow" variant="light" size="sm">
            Not Saved
          </Badge>
        </Group>
        <Button
          size="xs"
          onClick={onSaveAll}
          loading={isLoading}
          leftSection={<Check size={14} />}
        >
          Save All
        </Button>
      </Group>
      <ScrollArea h={100}>
        <Stack gap="xs">
          {Array.from(pendingItems.values()).map((item) => (
            <Group key={item.id} justify="space-between" wrap="nowrap">
              <Text size="xs" style={{ flex: 1 }}>
                {item.title} - {new Date(item.scheduled_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </Text>
              <Button
                size="xs"
                variant="subtle"
                color="red"
                onClick={() => onRemove(item.id)}
              >
                Remove
              </Button>
            </Group>
          ))}
        </Stack>
      </ScrollArea>
    </Card>
  );
}

