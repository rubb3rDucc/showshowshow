import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Center,
  Alert,
  Modal,
  Select,
  Badge,
  Box,
  ScrollArea,
  Collapse,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconChevronDown, IconChevronUp, IconPlus, IconAlertCircle } from '@tabler/icons-react';
import { toast } from 'sonner';
import { getSchedule, createScheduleItem } from '../../api/schedule';
import { getQueue } from '../../api/content';
import type { ScheduleItem, QueueItem } from '../../types/api';

interface TimeSlot {
  hour: number;
  minute: number;
  display: string;
}

// Generate time slots (every 30 minutes from 8 AM to 11 PM)
function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 8; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = new Date();
      time.setHours(hour, minute, 0, 0);
      slots.push({
        hour,
        minute,
        display: time.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      });
    }
  }
  return slots;
}

interface QueueBuilderCalendarProps {
  expanded: boolean;
  onToggle: () => void;
}

export function QueueBuilderCalendar({ expanded, onToggle }: QueueBuilderCalendarProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [scheduleModalOpened, setScheduleModalOpened] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);

  const timeSlots = generateTimeSlots();
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Helper to safely convert to Date object
  const toDate = (date: Date | null | string | undefined): Date | null => {
    if (!date) return null;
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date;
    }
    if (typeof date === 'string') {
      const dateObj = new Date(date);
      return isNaN(dateObj.getTime()) ? null : dateObj;
    }
    return null;
  };

  // Format date as YYYY-MM-DD
  const formatDate = (date: Date | null | string | undefined): string | undefined => {
    const dateObj = toDate(date);
    if (!dateObj) return undefined;
    
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateStr = formatDate(selectedDate);

  // Fetch schedule for selected date
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule', dateStr || 'all'],
    queryFn: () => getSchedule(dateStr),
    enabled: !!dateStr && expanded,
  });

  // Fetch queue items
  const { data: queue, isLoading: queueLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
    enabled: expanded,
  });

  // Manual schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: createScheduleItem,
    onSuccess: () => {
      toast.success('Item scheduled successfully!');
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setScheduleModalOpened(false);
      setSelectedQueueItem(null);
      setSelectedTimeSlot(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to schedule item');
    },
  });

  // Get scheduled items for a specific time slot
  const getScheduledItemsForSlot = (slot: TimeSlot): ScheduleItem[] => {
    if (!schedule || !selectedDate) return [];

    const dateObj = toDate(selectedDate);
    if (!dateObj) return [];

    const slotDate = new Date(dateObj);
    slotDate.setHours(slot.hour, slot.minute, 0, 0);
    const slotStart = slotDate.getTime();
    const slotEnd = slotStart + 30 * 60 * 1000; // 30 minutes

    return schedule.filter((item) => {
      const itemTime = new Date(item.scheduled_time).getTime();
      return itemTime >= slotStart && itemTime < slotEnd;
    });
  };

  // Handle time slot click
  const handleTimeSlotClick = (slot: TimeSlot) => {
    setSelectedTimeSlot(slot);
    setScheduleModalOpened(true);
  };

  // Handle schedule from queue item
  const handleScheduleItem = (queueItem: QueueItem) => {
    if (!selectedDate || !selectedTimeSlot) return;

    const dateObj = toDate(selectedDate);
    if (!dateObj) return;

    const scheduledTime = new Date(dateObj);
    scheduledTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);

    scheduleMutation.mutate({
      content_id: queueItem.content_id,
      season: queueItem.season ?? null,
      episode: queueItem.episode ?? null,
      scheduled_time: scheduledTime.toISOString(),
    });
  };

  const isEmpty = !queue || queue.length === 0;
  const isLoading = scheduleLoading || queueLoading;

  return (
    <>
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" align="center" mb={expanded ? 'md' : 0}>
          <Group gap="xs">
            <IconCalendar size={20} />
            <Text fw={600} size="lg">
              Calendar Builder
            </Text>
          </Group>
          <Button
            variant="subtle"
            size="sm"
            onClick={onToggle}
            rightSection={expanded ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
          >
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        </Group>

        <Collapse in={expanded}>
          <Stack gap="md">
            {isLoading ? (
              <Center py={40}>
                <Stack align="center" gap="md">
                  <Loader size="sm" />
                  <Text c="dimmed">Loading calendar...</Text>
                </Stack>
              </Center>
            ) : (
              <>
                {/* Date Picker */}
                <Group>
                  <DatePickerInput
                    label="Select Date"
                    value={selectedDate}
                    onChange={(value) => {
                      // Ensure we always set a Date or null
                      const dateValue = toDate(value);
                      setSelectedDate(dateValue);
                    }}
                    leftSection={<IconCalendar size={16} />}
                    style={{ flex: 1 }}
                  />
                  <Text size="sm" c="dimmed" mt="xl">
                    Timezone: {userTimezone}
                  </Text>
                </Group>

                {/* Queue Items Panel */}
                {!isEmpty && (
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
                            onClick={() => {
                              setSelectedQueueItem(item);
                              setScheduleModalOpened(true);
                            }}
                          >
                            <Group justify="space-between">
                              <Text size="sm" fw={500}>
                                {item.title || 'Unknown'}
                              </Text>
                              <Badge size="sm" variant="light">
                                {item.content_type === 'show' ? 'TV' : 'Movie'}
                              </Badge>
                            </Group>
                          </Card>
                        ))}
                      </Stack>
                    </ScrollArea>
                  </Card>
                )}

                {/* Empty Queue State */}
                {isEmpty && (
                  <Alert icon={<IconAlertCircle size={16} />} title="Empty Queue" color="yellow">
                    Add items to your queue from the search page to schedule them.
                  </Alert>
                )}

                {/* Calendar Grid */}
                <Card withBorder p="md">
                  <Text fw={600} mb="md">
                    Time Slots - {toDate(selectedDate)?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) || 'Select a date'}
                  </Text>

                  <ScrollArea h={400}>
                    <Stack gap="xs">
                      {timeSlots.map((slot) => {
                        const scheduledItems = getScheduledItemsForSlot(slot);
                        const isOccupied = scheduledItems.length > 0;

                        return (
                          <Box
                            key={`${slot.hour}-${slot.minute}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '8px',
                              border: '1px solid #e0e0e0',
                              borderRadius: '4px',
                              backgroundColor: isOccupied ? '#f5f5f5' : 'white',
                              cursor: isEmpty ? 'not-allowed' : 'pointer',
                              opacity: isEmpty ? 0.5 : 1,
                            }}
                            onClick={() => !isEmpty && handleTimeSlotClick(slot)}
                          >
                            {/* Time Label */}
                            <Box style={{ minWidth: '80px' }}>
                              <Text size="sm" fw={500}>
                                {slot.display}
                              </Text>
                            </Box>

                            {/* Scheduled Items */}
                            <Box style={{ flex: 1 }}>
                              {isOccupied ? (
                                <Stack gap="xs">
                                  {scheduledItems.map((item) => {
                                    const isShow = item.season !== null && item.episode !== null;
                                    const displayTitle = isShow
                                      ? `${item.title} - S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
                                      : item.title;

                                    return (
                                      <Badge
                                        key={item.id}
                                        color="blue"
                                        variant="filled"
                                        size="lg"
                                        style={{ width: 'fit-content' }}
                                      >
                                        {displayTitle} ({item.duration} min)
                                      </Badge>
                                    );
                                  })}
                                </Stack>
                              ) : (
                                <Group gap="xs">
                                  <IconPlus size={16} opacity={0.3} />
                                  <Text size="sm" c="dimmed">
                                    Click to schedule
                                  </Text>
                                </Group>
                              )}
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  </ScrollArea>
                </Card>
              </>
            )}
          </Stack>
        </Collapse>
      </Card>

      {/* Schedule Item Modal */}
      <Modal
        opened={scheduleModalOpened}
        onClose={() => {
          setScheduleModalOpened(false);
          setSelectedQueueItem(null);
          setSelectedTimeSlot(null);
        }}
        title={
          selectedTimeSlot
            ? `Schedule at ${selectedTimeSlot.display}`
            : 'Select Queue Item to Schedule'
        }
        centered
        size="md"
      >
        <Stack gap="md">
          {selectedTimeSlot && selectedQueueItem ? (
            // Confirm scheduling
            <>
              <Text size="sm">
                Schedule <strong>{selectedQueueItem.title}</strong> at{' '}
                <strong>{selectedTimeSlot.display}</strong> on{' '}
                <strong>
                  {toDate(selectedDate)?.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }) || 'Invalid date'}
                </strong>
                ?
              </Text>
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setScheduleModalOpened(false);
                    setSelectedQueueItem(null);
                    setSelectedTimeSlot(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleScheduleItem(selectedQueueItem)}
                  loading={scheduleMutation.isPending}
                >
                  Schedule
                </Button>
              </Group>
            </>
          ) : selectedTimeSlot ? (
            // Select queue item for this time slot
            <>
              <Text size="sm" c="dimmed">
                Select a queue item to schedule at {selectedTimeSlot.display}:
              </Text>
              {queue && queue.length > 0 ? (
                <Select
                  label="Queue Item"
                  placeholder="Choose an item"
                  data={queue.map((item) => ({
                    value: item.id,
                    label: `${item.title || 'Unknown'} (${item.content_type === 'show' ? 'TV' : 'Movie'})`,
                  }))}
                  onChange={(value) => {
                    const item = queue.find((q) => q.id === value);
                    if (item) {
                      setSelectedQueueItem(item);
                    }
                  }}
                />
              ) : (
                <Alert icon={<IconAlertCircle size={16} />} title="Empty Queue">
                  No items in queue to schedule.
                </Alert>
              )}
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setScheduleModalOpened(false);
                    setSelectedTimeSlot(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => selectedQueueItem && handleScheduleItem(selectedQueueItem)}
                  disabled={!selectedQueueItem}
                  loading={scheduleMutation.isPending}
                >
                  Schedule
                </Button>
              </Group>
            </>
          ) : (
            // Select time slot first (shouldn't happen, but handle it)
            <Alert icon={<IconAlertCircle size={16} />} title="No Time Slot Selected">
              Please select a time slot first.
            </Alert>
          )}
        </Stack>
      </Modal>
    </>
  );
}


