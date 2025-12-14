import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  Group,
  Stack,
  Text,
  Card,
  Center,
  Loader,
  Alert,
} from '@mantine/core';
import { IconPlus, IconAlertCircle } from '@tabler/icons-react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import { getQueue, removeFromQueue, reorderQueue } from '../api/content';
import { QueueItemCard } from '../components/queue/QueueItemCard';
import { GenerateScheduleModal } from '../components/schedule/GenerateScheduleModal';
import type { QueueItem } from '../types/api';

// Sortable wrapper for queue items
function SortableQueueItem({
  item,
  onRemove,
}: {
  item: QueueItem;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <QueueItemCard 
        item={item} 
        onRemove={onRemove} 
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

export function Queue() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  // Fetch queue
  const { data: queue, isLoading, error } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
  });

  const [generateModalOpened, setGenerateModalOpened] = useState(false);

  // Local queue state for drag-and-drop reordering (optimistic updates)
  // We need local state to handle optimistic updates during drag operations
  const [localQueue, setLocalQueue] = useState<QueueItem[]>(queue || []);
  
  // Sync local queue with server data when it changes
  // Note: This is necessary for drag-and-drop with optimistic updates.
  // The local state allows us to update the UI immediately during drag,
  // then sync back to server state when the server responds.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (queue) {
      setLocalQueue(queue);
    }
  }, [queue]);

  // Remove from queue mutation
  const removeMutation = useMutation<
    void,
    Error,
    string,
    { previousQueue: QueueItem[] | undefined }
  >({
    mutationFn: removeFromQueue,
    onMutate: async (itemId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['queue'] });
      
      // Snapshot previous value
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue']);
      
      // Optimistically update cache
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) => 
        old ? old.filter((item) => item.id !== itemId) : []
      );
      
      // Also update local state
      setLocalQueue((prev) => prev.filter((item) => item.id !== itemId));
      
      return { previousQueue };
    },
    onSuccess: () => {
      toast.success('Removed from queue');
    },
    onError: (error, _itemId, context) => {
      // Revert to previous state on error
      if (context?.previousQueue) {
        queryClient.setQueryData(['queue'], context.previousQueue);
        setLocalQueue(context.previousQueue);
      }
      toast.error(error.message || 'Failed to remove from queue');
    },
    onSettled: () => {
      // Always refetch after mutation completes
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Reorder queue mutation
  const reorderMutation = useMutation({
    mutationFn: reorderQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      // Silent success - no toast for reordering
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reorder queue');
      // Revert to server state on error
      if (queue) {
        setLocalQueue(queue);
      }
    },
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localQueue.findIndex((item) => item.id === active.id);
    const newIndex = localQueue.findIndex((item) => item.id === over.id);

    const newQueue = arrayMove(localQueue, oldIndex, newIndex);
    setLocalQueue(newQueue);

    // Send reorder request to backend
    const itemIds = newQueue.map((item) => item.id);
    reorderMutation.mutate(itemIds);
  };

  const handleRemove = (id: string) => {
    removeMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Center py={60}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Loading queue...</Text>
            </Stack>
          </Center>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          <Alert color="red" title="Error" icon={<IconAlertCircle />}>
            Failed to load queue. Please try again.
          </Alert>
        </div>
      </div>
    );
  }

  const isEmpty = !localQueue || localQueue.length === 0;

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Queue</h1>
            <p className="text-gray-600">
              {isEmpty
                ? 'Your playlist builder - add shows and movies to get started'
                : `${localQueue.length} item${localQueue.length !== 1 ? 's' : ''} in queue`}
            </p>
          </div>
          {!isEmpty && (
            <Button
              size="lg"
              onClick={() => setGenerateModalOpened(true)}
            >
              Generate Schedule
            </Button>
          )}
        </Group>

        {/* Empty State */}
        {isEmpty && (
          <Card shadow="sm" padding="xl" radius="md" withBorder>
            <Center py={40}>
              <Stack align="center" gap="md">
                <IconPlus size={48} stroke={1.5} opacity={0.3} />
                <Text size="lg" fw={500} c="dimmed">
                  Queue is Empty
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  Add shows and movies from the search page
                </Text>
                <Link href="/search">
                  <Button variant="light" leftSection={<IconPlus size={16} />}>
                    Browse Content
                  </Button>
                </Link>
              </Stack>
            </Center>
          </Card>
        )}

        {/* Queue List with Drag and Drop */}
        {!isEmpty && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={localQueue.map((item) => item.id)} strategy={verticalListSortingStrategy}>
              <Stack gap="md">
                {localQueue.map((item) => (
                  <SortableQueueItem key={item.id} item={item} onRemove={handleRemove} />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>
        )}

        {/* Hint */}
        {!isEmpty && (
          <Text size="sm" c="dimmed" ta="center" mt="xl">
            💡 Tip: Drag items to reorder them in your schedule
          </Text>
        )}
      </div>

      {/* Generate Schedule Modal */}
      <GenerateScheduleModal
        opened={generateModalOpened}
        onClose={() => setGenerateModalOpened(false)}
        onSuccess={() => setLocation('/')}
      />
    </div>
  );
}


