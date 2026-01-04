import { Box } from '@mantine/core';
import { QueueItemCard } from './QueueItemCard';
import { EmptyState } from './EmptyState';
import type { QueueItem } from '../../types/api';

interface QueueListProps {
  items: QueueItem[];
  onRemove: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  openEpisodeDescriptionId?: string | null;
  onToggleEpisodeDescription?: (id: string) => void;
}

export function QueueList({ 
  items, 
  onRemove,
  isDragging,
  dragHandleProps,
  openEpisodeDescriptionId,
  onToggleEpisodeDescription,
}: QueueListProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <Box style={{ width: '100%' }}>
      <Box
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'rgb(var(--color-bg-surface))',
        }}
      >
        {items.map((item) => (
          <QueueItemCard
            key={item.id}
            item={item}
            onRemove={onRemove}
            isDragging={isDragging}
            dragHandleProps={dragHandleProps}
            openEpisodeDescriptionId={openEpisodeDescriptionId}
            onToggleEpisodeDescription={onToggleEpisodeDescription}
          />
        ))}
      </Box>
    </Box>
  );
}

