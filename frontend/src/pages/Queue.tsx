import { useState, useRef, useEffect } from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Button,
  Group,
  Stack,
  Text,
  Center,
  Loader,
  Alert,
  Grid,
  Drawer,
  Menu,
  Box,
  ActionIcon,
} from '@mantine/core';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import { IconAlertCircle, IconList, IconChevronLeft, IconChevronDown } from '@tabler/icons-react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import { getQueue, removeFromQueue, reorderQueue } from '../api/content';
import { QueueList } from '../components/queue/QueueList';
import { QueueBuilderCalendar } from '../components/queue/QueueBuilderCalendar';
import { GenerateScheduleModal } from '../components/schedule/GenerateScheduleModal';
import { clearScheduleForDate } from '../api/schedule';
import type { QueueItem } from '../types/api';


export function Queue() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [opened, { open, close }] = useDisclosure(false);
  const [generateModalOpened, setGenerateModalOpened] = useState(false);
  // Default to today's date for "Clear Schedule for Day" - calendar manages its own date internally
  const selectedDate = new Date();
  const [openEpisodeDescriptionId, setOpenEpisodeDescriptionId] = useState<string | null>(null);

  // Fetch queue
  const { data: queue, isLoading, error } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
  });

  // Track if we're currently dragging
  const isDraggingRef = useRef(false);
  
  // Local queue state for drag-and-drop reordering (optimistic updates)
  const [localQueue, setLocalQueue] = useState<QueueItem[]>(() => queue || []);
  
  // Sync localQueue with server data when queue changes (but not during drag)
  useEffect(() => {
    if (queue && !isDraggingRef.current) {
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
      await queryClient.cancelQueries({ queryKey: ['queue'] });
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue']);
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) => 
        old ? old.filter((item) => item.id !== itemId) : []
      );
      setLocalQueue((prev) => prev.filter((item) => item.id !== itemId));
      return { previousQueue };
    },
    onSuccess: () => {
      toast.success('Removed from queue');
    },
    onError: (error, _itemId, context) => {
      if (context?.previousQueue) {
        queryClient.setQueryData(['queue'], context.previousQueue);
        setLocalQueue(context.previousQueue);
      }
      toast.error(error.message || 'Failed to remove from queue');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Reorder queue mutation
  const reorderMutation = useMutation({
    mutationFn: reorderQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reorder queue');
      isDraggingRef.current = false;
      if (queue) {
        setLocalQueue(queue);
      }
    },
  });

  // Clear schedule for date mutation
  const clearScheduleMutation = useMutation({
    mutationFn: async (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      return clearScheduleForDate(dateStr);
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Schedule cleared for selected date');
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to clear schedule');
    },
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      isDraggingRef.current = false;
      return;
    }

    const oldIndex = localQueue.findIndex((item) => item.id === active.id);
    const newIndex = localQueue.findIndex((item) => item.id === over.id);

    const newQueue = arrayMove(localQueue, oldIndex, newIndex);
    setLocalQueue(newQueue);

    const itemIds = newQueue.map((item) => item.id);
    reorderMutation.mutate(itemIds);
    
    isDraggingRef.current = false;
  };

  const handleRemove = (id: string) => {
    removeMutation.mutate(id);
  };

  const handleClearScheduleForDate = () => {
    if (!selectedDate) {
      toast.error('Please select a date first');
      return;
    }
    clearScheduleMutation.mutate(selectedDate);
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8">
        <div style={{ width: '100%', padding: '0 16px' }}>
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
      <div className="p-4 md:p-8">
        <div style={{ width: '100%', padding: '0 16px' }}>
          <Alert color="red" title="Error" icon={<IconAlertCircle />}>
            Failed to load queue. Please try again.
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white', paddingBottom: isMobile ? '80px' : 0 }}>
      <Box style={{ paddingTop: isMobile ? '6px' : '12px', paddingBottom: isMobile ? '6px' : '6px', paddingLeft: '24px', paddingRight: '24px', width: '100%', maxWidth: '100%' }}>
        {/* Header with Back Button */}
        <Box mb={isMobile ? '32px' : '48px'}>
          <Group justify="space-between" align="center" mb="md">
          {/* Title Section */}
          <Box style={{ display: isMobile ? 'none' : 'block' }}>
            <Text
              size="xl"
              fw={300}
              style={{ color: '#111827', letterSpacing: '-0.025em', marginBottom: '4px' }}
            >
              Queue
            </Text>
            <Text size="sm" c="dimmed" fw={300}>
              {localQueue.length} {localQueue.length === 1 ? 'item' : 'items'}
            </Text>
          
          </Box>

          
          

            {/* Back to Search Button */}
            {/* <Link href="/search">
              <Button
                variant="subtle"
                color="gray"
                size="sm"
                leftSection={<IconChevronLeft size={14} />}
                style={{ fontWeight: 300 }}
              >
                Search
              </Button>
            </Link> */}


            
          </Group>

          
          <Box style={{ display: isMobile ? 'block' : 'none' }}>
            
            <Text
              size="xl"
              fw={300}
              style={{ color: '#111827', letterSpacing: '-0.025em', marginBottom: '4px' }}
            >
              Schedule
            </Text>
            <Text size="sm" c="dimmed" fw={300}>
              {/* TODO: Get schedule count when available */}
              0 items
            </Text>
            
          </Box>

            {/* Schedule Actions Dropdown */}
            <Menu shadow="sm" width={200}>
              <Menu.Target>
                <Button
                  variant="subtle"
                  color="dark"
                  size="sm"

                  rightSection={<IconChevronDown size={14} />}
                >
                  RANDOM BULK SCHEDULE GENERATE
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label style={{ fontWeight: 300, fontSize: '12px' }}>
                  Auto-fill
                </Menu.Label>
                <Menu.Item
                  onClick={() => setGenerateModalOpened(true)}
                  style={{ fontWeight: 300, fontSize: '14px' }}
                >
                  Generate Schedule
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  onClick={handleClearScheduleForDate}
                  disabled={!selectedDate || clearScheduleMutation.isPending}
                  style={{ fontWeight: 300, fontSize: '14px' }}
                  color="red"
                >
                  Clear Schedule for Day
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          
          
        </Box>
      
        <Grid gutter="xl" align="flex-start">
          {/* Queue Section - Desktop Only */}
          <Grid.Col
            span={{
              base: 12,
              md: 5,
              lg: 4,
            }}
            style={{ display: isMobile ? 'none' : 'block' }}
          >
            <Box style={{ maxHeight: 'calc(100vh - 16rem)', overflowY: 'auto' }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={localQueue.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <QueueList
                    items={localQueue}
                    onRemove={handleRemove}
                    openEpisodeDescriptionId={openEpisodeDescriptionId}
                    onToggleEpisodeDescription={(id) => {
                      setOpenEpisodeDescriptionId(openEpisodeDescriptionId === id ? null : id);
                    }}
                  />
                </SortableContext>
              </DndContext>
            </Box>
          </Grid.Col>

          {/* Calendar Section - Always Visible */}
          <Grid.Col
            span={{
              base: 12,
              md: 7,
              lg: 8,
            }}
          >
            <Box style={{ height: 'calc(100vh - 16rem)' }}>
              <QueueBuilderCalendar />
            </Box>
          </Grid.Col>
        </Grid>
      </Box>

      {/* Mobile Queue Drawer */}
      {isMobile && (
        <>
          {/* Mobile Bottom Bar */}
          <Box
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: 'white',
              borderTop: '1px solid #e5e7eb',
              padding: '16px',
              zIndex: 40,
            }}
          >
            <Group justify="space-between" align="center">
              <Link href="/search">
                <Button
                  variant="subtle"
                  color="gray"
                  size="xs"
                  leftSection={<IconChevronLeft size={12} />}
                  style={{ fontWeight: 300 }}
                >
                  Search
                </Button>
              </Link>

              <Group gap="sm">
                <ActionIcon
                  variant="subtle"
                  size="md"
                  color="gray"
                  onClick={open}
                >
                  <IconList size={18} />
                </ActionIcon>
                <Text size="sm" fw={300} style={{ color: '#374151' }}>
                  {localQueue.length} {localQueue.length === 1 ? 'item' : 'items'}
                </Text>
              </Group>

              <Button
                variant="subtle"
                size="xs"
                color="dark"
                onClick={open}
                style={{ fontWeight: 300 }}
              >
                Queue
              </Button>
            </Group>
          </Box>

          <Drawer
            opened={opened}
            onClose={close}
            position="bottom"
            size="90%"
            title="Queue"
            padding="md"
            styles={{
              header: {
                borderBottom: '1px solid #e5e7eb',
                fontWeight: 300,
              },
              body: {
                padding: 0,
                height: 'calc(100% - 60px)',
              },
            }}
          >
            <Box style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={localQueue.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  <QueueList
                    items={localQueue}
                    onRemove={handleRemove}
                    openEpisodeDescriptionId={openEpisodeDescriptionId}
                    onToggleEpisodeDescription={(id) => {
                      setOpenEpisodeDescriptionId(openEpisodeDescriptionId === id ? null : id);
                    }}
                  />
                </SortableContext>
              </DndContext>
            </Box>
          </Drawer>
        </>
      )}

      {/* Generate Schedule Modal */}
      <GenerateScheduleModal
        opened={generateModalOpened}
        onClose={() => setGenerateModalOpened(false)}
        onSuccess={() => setLocation('/')}
      />
    </div>
  );
}
