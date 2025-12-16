import { Card, Text, Stack, ScrollArea, Badge, Group } from '@mantine/core';
import type { QueueItem } from '../../../types/api';

interface QueueItemsListProps {
  queue: QueueItem[];
  onItemClick: (item: QueueItem) => void;
}

export function QueueItemsList({ queue, onItemClick }: QueueItemsListProps) {
  if (queue.length === 0) return null;

  return (
    <Card withBorder p="md">
      <Text fw={600} mb="sm">
        Queue Items ({queue.length})
      </Text>
      <ScrollArea h={150}>
        <Stack gap="xs">
          {queue.map((item) => (
            <Card
              key={item.id}
              p="xs"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => onItemClick(item)}
            >
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  {item.title || 'Unknown'}
                </Text>
                <Badge 
                  size="sm"
                  styles={{ 
                    root: { 
                      backgroundColor: '#000', 
                      color: '#fff', 
                      borderColor: '#000',
                    } 
                  }}
                >
                  {item.content_type === 'show' ? 'TV' : 'Movie'}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      </ScrollArea>
    </Card>
  );
}

