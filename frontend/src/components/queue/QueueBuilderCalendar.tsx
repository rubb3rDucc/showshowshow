import { useState, useMemo } from 'react';
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
  Checkbox,
  Accordion,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconChevronDown, IconChevronUp, IconPlus, IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { getSchedule, createScheduleItem, deleteScheduleItem } from '../../api/schedule';
import { getQueue, getEpisodes } from '../../api/content';
import type { ScheduleItem, QueueItem, Episode } from '../../types/api';

interface TimeSlot {
  hour: number;
  minute: number;
  display: string;
}

// Generate time slots (every 15 minutes from 12 AM to 11:45 PM)
function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
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

interface PendingScheduleItem {
  id: string; // Unique ID for pending item
  content_id: string;
  season: number | null;
  episode: number | null;
  scheduled_time: string;
  title: string;
  duration?: number;
}

export function QueueBuilderCalendar({ expanded, onToggle }: QueueBuilderCalendarProps) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [scheduleModalOpened, setScheduleModalOpened] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState<QueueItem | null>(null);
  const [selectedEpisodes, setSelectedEpisodes] = useState<Map<string, { season: number; episode: number }>>(new Map());
  const [pendingItems, setPendingItems] = useState<Map<string, PendingScheduleItem>>(new Map());
  const [hoveredTime, setHoveredTime] = useState<{ time: Date; hour: number; minute: number; availableDuration: number; mouseX: number; mouseY: number } | null>(null);

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

  // Fetch episodes when a show is selected
  const { data: episodes, isLoading: episodesLoading } = useQuery({
    queryKey: ['episodes', selectedQueueItem?.tmdb_id],
    queryFn: () => getEpisodes(selectedQueueItem!.tmdb_id!),
    enabled: !!selectedQueueItem && selectedQueueItem.content_type === 'show' && !!selectedQueueItem.tmdb_id,
  });

  // Group episodes by season
  const episodesBySeason = useMemo(() => {
    if (!episodes) return {};
    return episodes.reduce((acc, ep) => {
      if (!acc[ep.season]) acc[ep.season] = [];
      acc[ep.season].push(ep);
      return acc;
    }, {} as Record<number, Episode[]>);
  }, [episodes]);

  // Manual schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: createScheduleItem,
    onSuccess: (data, variables) => {
      // Remove from pending items if it was pending
      const pendingKey = Object.values(pendingItems).find(
        p => p.content_id === variables.content_id &&
        p.season === variables.season &&
        p.episode === variables.episode
      )?.id;
      if (pendingKey) {
        setPendingItems(prev => {
          const next = new Map(prev);
          next.delete(pendingKey);
          return next;
        });
      }
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to schedule item');
    },
  });

  // Delete schedule item mutation
  const deleteMutation = useMutation({
    mutationFn: deleteScheduleItem,
    onSuccess: () => {
      toast.success('Item removed from schedule');
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove item');
    },
  });

  // Batch schedule mutation
  const batchScheduleMutation = useMutation({
    mutationFn: async (items: PendingScheduleItem[]) => {
      const results = [];
      for (const item of items) {
        try {
          const result = await createScheduleItem({
            content_id: item.content_id,
            season: item.season,
            episode: item.episode,
            scheduled_time: item.scheduled_time,
            duration: item.duration,
          });
          results.push({ success: true, item, result });
        } catch (error) {
          results.push({ success: false, item, error });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      // Clear all pending items
      setPendingItems(new Map());
      
      if (successCount > 0) {
        toast.success(`Successfully scheduled ${successCount} item${successCount !== 1 ? 's' : ''}`);
      }
      if (failCount > 0) {
        toast.error(`Failed to schedule ${failCount} item${failCount !== 1 ? 's' : ''}`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      setScheduleModalOpened(false);
      setSelectedQueueItem(null);
      setSelectedTimeSlot(null);
      setSelectedEpisodes(new Map());
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to schedule items');
    },
  });

  // Get all scheduled items for the selected date (for timeline display)
  const getAllScheduledItems = (): { saved: ScheduleItem[]; pending: PendingScheduleItem[] } => {
    if (!selectedDate) return { saved: [], pending: [] };

    const dateObj = toDate(selectedDate);
    if (!dateObj) return { saved: [], pending: [] };

    // Filter saved items for the selected date
    const saved = schedule?.filter((item) => {
      const itemDate = new Date(item.scheduled_time);
      return (
        itemDate.getFullYear() === dateObj.getFullYear() &&
        itemDate.getMonth() === dateObj.getMonth() &&
        itemDate.getDate() === dateObj.getDate()
      );
    }) || [];

    // Filter pending items for the selected date
    const pending = Array.from(pendingItems.values()).filter((item) => {
      const itemDate = new Date(item.scheduled_time);
      return (
        itemDate.getFullYear() === dateObj.getFullYear() &&
        itemDate.getMonth() === dateObj.getMonth() &&
        itemDate.getDate() === dateObj.getDate()
      );
    });

    return { saved, pending };
  };

  // Calculate position and height for timeline blocks (12 AM to 11:59 PM = 24 hours)
  const getItemPosition = (item: ScheduleItem | PendingScheduleItem) => {
    const startTime = new Date(item.scheduled_time);
    const duration = item.duration || 0;
    
    // Calculate hours and minutes from midnight (12 AM)
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    
    // Timeline configuration - ensure 15-minute increments are proportional
    const pixelsPerHour = 120; // 120px per hour
    const pixelsPerMinute = pixelsPerHour / 60; // 2px per minute (proportional)
    const totalHeight = 24 * pixelsPerHour; // 2880px total (24 hours)
    
    // Calculate top position using exact minutes for precise alignment
    // This ensures :00, :15, :30, :45 align perfectly
    const totalMinutesFromMidnight = (startHour * 60) + startMinute;
    const topPixels = totalMinutesFromMidnight * pixelsPerMinute;
    
    // Calculate height in pixels - use proportional sizing with smaller minimum for short durations
    // For durations <= 15 minutes, use a smaller minimum (40px) to keep them compact
    // For longer durations, use larger minimum (60px) to ensure text fits
    const proportionalHeight = duration * pixelsPerMinute;
    const minHeight = duration <= 15 ? 40 : 60;
    const heightPixels = Math.max(proportionalHeight, minHeight);
    
    return { 
      top: `${topPixels}px`, 
      height: `${heightPixels}px`,
      startHour,
      startMinute,
      duration,
    };
  };

  // Find the blocking item for a given time range
  const getBlockingItem = (startTime: Date, duration: number): { item: ScheduleItem | PendingScheduleItem; type: 'saved' | 'pending' } | null => {
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    
    // Check against saved items first
    const blockingSaved = schedule?.find(item => {
      const itemStart = new Date(item.scheduled_time);
      const itemEnd = new Date(itemStart.getTime() + item.duration * 60 * 1000);
      
      // Check for overlap: new item overlaps if it starts before existing ends AND ends after existing starts
      return startTime < itemEnd && endTime > itemStart;
    });
    
    if (blockingSaved) {
      return { item: blockingSaved, type: 'saved' };
    }
    
    // Check against pending items
    const blockingPending = Array.from(pendingItems.values()).find(item => {
      const itemStart = new Date(item.scheduled_time);
      const itemEnd = new Date(itemStart.getTime() + (item.duration || 0) * 60 * 1000);
      return startTime < itemEnd && endTime > itemStart;
    });
    
    if (blockingPending) {
      return { item: blockingPending, type: 'pending' };
    }
    
    return null;
  };

  // Format error message with blocking item details
  const getOccupiedErrorMessage = (startTime: Date, duration: number): string => {
    const blocking = getBlockingItem(startTime, duration);
    
    if (!blocking) {
      return 'This time slot is already occupied. Please remove the existing item first.';
    }
    
    const { item } = blocking;
    const itemStart = new Date(item.scheduled_time);
    const itemEnd = new Date(itemStart.getTime() + (item.duration || 0) * 60 * 1000);
    
    // Format times in human-readable format
    const startTimeStr = itemStart.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    const endTimeStr = itemEnd.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    
    // Determine if the conflict is because the new item starts during an existing item
    // or if the new item would overlap with an existing item
    const newItemEnd = new Date(startTime.getTime() + duration * 60 * 1000);
    
    if (startTime >= itemStart && startTime < itemEnd) {
      // New item starts during existing item
      return `The time slot you're trying to schedule is occupied by '${item.title}' starting at ${startTimeStr}.`;
    } else if (newItemEnd > itemStart && newItemEnd <= itemEnd) {
      // New item would end during existing item
      return `The time slot you're trying to schedule is occupied by '${item.title}' ending at ${endTimeStr}.`;
    } else {
      // General overlap case
      return `The time slot you're trying to schedule overlaps with '${item.title}' (${startTimeStr} - ${endTimeStr}).`;
    }
  };

  // Check if a time range overlaps with existing items
  const isTimeRangeOccupied = (startTime: Date, duration: number): boolean => {
    return getBlockingItem(startTime, duration) !== null;
  };

  // Get scheduled items for a specific time slot (for backward compatibility)
  const getScheduledItemsForSlot = (slot: TimeSlot): { saved: ScheduleItem[]; pending: PendingScheduleItem[] } => {
    if (!selectedDate) return { saved: [], pending: [] };

    const dateObj = toDate(selectedDate);
    if (!dateObj) return { saved: [], pending: [] };

    const slotDate = new Date(dateObj);
    slotDate.setHours(slot.hour, slot.minute, 0, 0);
    const slotStart = slotDate.getTime();
    const slotEnd = slotStart + 15 * 60 * 1000; // 15 minutes

    const saved = schedule?.filter((item) => {
      const itemTime = new Date(item.scheduled_time).getTime();
      return itemTime >= slotStart && itemTime < slotEnd;
    }) || [];

    const pending = Array.from(pendingItems.values()).filter((item) => {
      const itemTime = new Date(item.scheduled_time).getTime();
      return itemTime >= slotStart && itemTime < slotEnd;
    });

    return { saved, pending };
  };

  // Check if time slot is occupied (for backward compatibility)
  const isTimeSlotOccupied = (slot: TimeSlot): boolean => {
    const dateObj = toDate(selectedDate);
    if (!dateObj) return false;

    const slotDate = new Date(dateObj);
    slotDate.setHours(slot.hour, slot.minute, 0, 0);
    
    // Check if any item overlaps with this 15-minute slot
    return isTimeRangeOccupied(slotDate, 15);
  };

  // Convert mouse position to time
  const getTimeFromPosition = (y: number, containerHeight: number): { time: Date; hour: number; minute: number } | null => {
    // Account for paddingTop
    const paddingTop = 12;
    const pixelsPerHour = 120;
    const pixelsPerMinute = pixelsPerHour / 60; // 2px per minute
    
    // Calculate minutes from midnight based on pixel position
    const adjustedY = y - paddingTop;
    const totalMinutesFromMidnight = adjustedY / pixelsPerMinute;
    
    // Round to nearest 15 minutes
    const roundedMinutes = Math.round(totalMinutesFromMidnight / 15) * 15;
    
    const hours = Math.floor(roundedMinutes / 60);
    const minutes = roundedMinutes % 60;
    
    if (hours >= 24) return null; // Don't allow past 11:59 PM
    
    const clickedTime = new Date(selectedDate!);
    clickedTime.setHours(hours, minutes, 0, 0);
    
    return { time: clickedTime, hour: hours, minute: minutes };
  };

  // Calculate available duration from a given time
  const getAvailableDuration = (startTime: Date): number => {
    const { saved, pending } = getAllScheduledItems();
    const allItems = [
      ...saved.map(item => ({ ...item, type: 'saved' as const })),
      ...pending.map(item => ({ ...item, type: 'pending' as const })),
    ];

    // Find the next scheduled item after this time
    const nextItem = allItems
      .map(item => ({
        start: new Date(item.scheduled_time),
        end: new Date(new Date(item.scheduled_time).getTime() + (item.duration || 0) * 60 * 1000),
      }))
      .filter(item => item.start > startTime)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

    // Calculate duration until next item or end of day (11:59 PM)
    const endOfDay = new Date(startTime);
    endOfDay.setHours(23, 59, 59, 0);

    if (nextItem) {
      const availableMs = Math.min(nextItem.start.getTime() - startTime.getTime(), endOfDay.getTime() - startTime.getTime());
      return Math.floor(availableMs / (60 * 1000)); // Convert to minutes
    }

    // No next item, available until end of day
    const availableMs = endOfDay.getTime() - startTime.getTime();
    return Math.floor(availableMs / (60 * 1000));
  };

  // Handle timeline mouse move for hover feedback
  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEmpty) {
      setHoveredTime(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const paddingTop = 12; // Match the paddingTop from the container
    const mouseY = e.clientY - rect.top - paddingTop;
    const timeInfo = getTimeFromPosition(mouseY, rect.height - paddingTop);
    
    if (timeInfo) {
      // Check if this time is occupied
      if (isTimeRangeOccupied(timeInfo.time, 15)) {
        setHoveredTime(null);
        return;
      }
      
      const availableDuration = getAvailableDuration(timeInfo.time);
      setHoveredTime({ 
        time: timeInfo.time, 
        hour: timeInfo.hour,
        minute: timeInfo.minute,
        availableDuration,
        mouseX: e.clientX,
        mouseY: e.clientY,
      });
    } else {
      setHoveredTime(null);
    }
  };

  // Handle timeline mouse leave
  const handleTimelineMouseLeave = () => {
    setHoveredTime(null);
  };

  // Handle timeline click - convert click position to time
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isEmpty) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const paddingTop = 12; // Match the paddingTop from the container
    const clickY = e.clientY - rect.top - paddingTop;
    const timeInfo = getTimeFromPosition(clickY, rect.height - paddingTop);
    
    if (!timeInfo) return;
    
    // Check if this time is occupied
    if (isTimeRangeOccupied(timeInfo.time, 15)) {
      toast.error(getOccupiedErrorMessage(timeInfo.time, 15));
      return;
    }
    
    // Create a time slot for the clicked time
    const clickedSlot: TimeSlot = {
      hour: timeInfo.hour,
      minute: timeInfo.minute,
      display: timeInfo.time.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
    
    setSelectedTimeSlot(clickedSlot);
    setScheduleModalOpened(true);
  };

  // Handle time slot click (for backward compatibility)
  const handleTimeSlotClick = (slot: TimeSlot) => {
    // Check if slot is already occupied
    if (isTimeSlotOccupied(slot)) {
      const dateObj = toDate(selectedDate);
      if (dateObj) {
        const slotDate = new Date(dateObj);
        slotDate.setHours(slot.hour, slot.minute, 0, 0);
        toast.error(getOccupiedErrorMessage(slotDate, 15));
      } else {
        toast.error('This time slot is already occupied. Please remove the existing item first.');
      }
      return;
    }
    setSelectedTimeSlot(slot);
    setScheduleModalOpened(true);
  };

  // Handle episode checkbox toggle
  const handleEpisodeToggle = (season: number, episodeNumber: number, checked: boolean) => {
    const key = `${season}-${episodeNumber}`;
    setSelectedEpisodes(prev => {
      const next = new Map(prev);
      if (checked) {
        next.set(key, { season, episode: episodeNumber });
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  // Check if episode is selected
  const isEpisodeSelected = (season: number, episodeNumber: number): boolean => {
    return selectedEpisodes.has(`${season}-${episodeNumber}`);
  };

  // Add selected episodes to pending items
  const addToPending = (queueItem: QueueItem) => {
    if (!selectedDate || !selectedTimeSlot) return;

    const dateObj = toDate(selectedDate);
    if (!dateObj) return;

    // Calculate scheduled time
    const scheduledTime = new Date(dateObj);
    scheduledTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);

    if (queueItem.content_type === 'show') {
      if (selectedEpisodes.size === 0) {
        toast.error('Please select at least one episode');
        return;
      }

      // For shows, only allow scheduling the first episode in the selected time slot
      const firstEpisode = Array.from(selectedEpisodes.values())[0];
      const episodeData = episodes?.find(
        ep => ep.season === firstEpisode.season && ep.episode_number === firstEpisode.episode
      );

      const duration = episodeData?.duration || 30;
      
      // Check if time range is occupied
      if (isTimeRangeOccupied(scheduledTime, duration)) {
        toast.error(getOccupiedErrorMessage(scheduledTime, duration));
        return;
      }

      const pendingId = `${queueItem.content_id}-${firstEpisode.season}-${firstEpisode.episode}-${scheduledTime.toISOString()}`;
      const newPendingItems = new Map(pendingItems);
      newPendingItems.set(pendingId, {
        id: pendingId,
        content_id: queueItem.content_id,
        season: firstEpisode.season,
        episode: firstEpisode.episode,
        scheduled_time: scheduledTime.toISOString(),
        title: `${queueItem.title} - S${String(firstEpisode.season).padStart(2, '0')}E${String(firstEpisode.episode).padStart(2, '0')}`,
        duration: episodeData?.duration,
      });

      setPendingItems(newPendingItems);
      toast.success('Added to pending. Select another time slot for additional episodes.');
      setSelectedEpisodes(new Map());
    } else {
      // For movies, use default duration (will be fetched from backend if not provided)
      const duration = 120; // Default movie duration, backend will use actual if available
      
      // Check if time range is occupied
      if (isTimeRangeOccupied(scheduledTime, duration)) {
        toast.error(getOccupiedErrorMessage(scheduledTime, duration));
        return;
      }

      const pendingId = `${queueItem.content_id}-${scheduledTime.toISOString()}`;
      const newPendingItems = new Map(pendingItems);
      newPendingItems.set(pendingId, {
        id: pendingId,
        content_id: queueItem.content_id,
        season: null,
        episode: null,
        scheduled_time: scheduledTime.toISOString(),
        title: queueItem.title || 'Unknown',
        duration: undefined, // Will be set by backend
      });

      setPendingItems(newPendingItems);
      toast.success('Added to pending');
    }
  };

  // Handle schedule from queue item (immediate save)
  const handleScheduleItem = async (queueItem: QueueItem) => {
    if (!selectedDate || !selectedTimeSlot) return;

    const dateObj = toDate(selectedDate);
    if (!dateObj) return;

    const scheduledTime = new Date(dateObj);
    scheduledTime.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);

    if (queueItem.content_type === 'show') {
      if (selectedEpisodes.size === 0) {
        toast.error('Please select at least one episode');
        return;
      }

      // For shows, only schedule the first selected episode in this time slot
      const firstEpisode = Array.from(selectedEpisodes.values())[0];
      const episodeData = episodes?.find(
        ep => ep.season === firstEpisode.season && ep.episode_number === firstEpisode.episode
      );

      const duration = episodeData?.duration || 30;
      
      // Check if time range is occupied
      if (isTimeRangeOccupied(scheduledTime, duration)) {
        toast.error(getOccupiedErrorMessage(scheduledTime, duration));
        return;
      }
      
      await scheduleMutation.mutateAsync({
        content_id: queueItem.content_id,
        season: firstEpisode.season,
        episode: firstEpisode.episode,
        scheduled_time: scheduledTime.toISOString(),
        duration: episodeData?.duration,
      });

      toast.success('Episode scheduled. Select another time slot for additional episodes.');
      setScheduleModalOpened(false);
      setSelectedQueueItem(null);
      setSelectedTimeSlot(null);
      setSelectedEpisodes(new Map());
    } else {
      // For movies, use default duration (backend will use actual if available)
      const duration = 120; // Default movie duration
      
      // Check if time range is occupied
      if (isTimeRangeOccupied(scheduledTime, duration)) {
        toast.error(getOccupiedErrorMessage(scheduledTime, duration));
        return;
      }
      
      scheduleMutation.mutate({
        content_id: queueItem.content_id,
        season: null,
        episode: null,
        scheduled_time: scheduledTime.toISOString(),
        // Duration will be determined by backend from content
      });
    }
  };

  // Save all pending items
  const handleSaveAll = () => {
    if (pendingItems.size === 0) {
      toast.error('No pending items to save');
      return;
    }
    batchScheduleMutation.mutate(Array.from(pendingItems.values()));
  };

  // Remove pending item
  const handleRemovePending = (id: string) => {
    setPendingItems(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
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

                {/* Pending Items Summary */}
                {pendingItems.size > 0 && (
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
                        onClick={handleSaveAll}
                        loading={batchScheduleMutation.isPending}
                        leftSection={<IconCheck size={14} />}
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
                              onClick={() => handleRemovePending(item.id)}
                            >
                              Remove
                            </Button>
                          </Group>
                        ))}
                      </Stack>
                    </ScrollArea>
                  </Card>
                )}

                {/* Calendar Timeline */}
                <Card withBorder p="md">
                  <Group justify="space-between" mb="md">
                    <Text fw={600}>
                      Timeline - {toDate(selectedDate)?.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      }) || 'Select a date'}
                    </Text>
                    {pendingItems.size > 0 && (
                      <Badge color="yellow" variant="light">
                        {pendingItems.size} pending
                      </Badge>
                    )}
                  </Group>

                  <ScrollArea h={600}>
                    <Box
                      style={{
                        position: 'relative',
                        minHeight: '2880px', // 24 hours * 120px per hour (increased for better spacing)
                        paddingTop: '12px', // Add padding to prevent 12:00 AM from being cut off
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        backgroundColor: '#fafafa',
                        cursor: isEmpty ? 'not-allowed' : 'pointer',
                      }}
                      onClick={handleTimelineClick}
                      onMouseMove={handleTimelineMouseMove}
                      onMouseLeave={handleTimelineMouseLeave}
                    >
                      {/* Time labels on the left */}
                      <Box
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '80px',
                          height: '100%',
                          borderRight: '1px solid #e0e0e0',
                          backgroundColor: 'white',
                          zIndex: 1,
                        }}
                      >
                        {Array.from({ length: 24 }, (_, i) => {
                          const hour = i;
                          const time = new Date();
                          time.setHours(hour, 0, 0, 0);
                          const topPercent = (i / 24) * 100;
                          
                          return (
                            <Box
                              key={hour}
                              style={{
                                position: 'absolute',
                                top: `${topPercent}%`,
                                left: '8px',
                                transform: i === 0 ? 'translateY(0)' : 'translateY(-50%)', // Don't translate first item to prevent cutoff
                              }}
                            >
                              <Text size="xs" fw={500} c="dimmed">
                                {time.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </Text>
                            </Box>
                          );
                        })}
                      </Box>

                      {/* Timeline grid lines - hourly and 15-minute increments */}
                      {Array.from({ length: 24 * 4 }, (_, i) => {
                        // Create lines every 15 minutes (96 lines total: 24 hours * 4)
                        const minutesFromMidnight = i * 15;
                        const pixelsPerHour = 120;
                        const pixelsPerMinute = pixelsPerHour / 60;
                        const topPixels = 12 + (minutesFromMidnight * pixelsPerMinute); // Account for paddingTop
                        
                        // Make hourly lines more prominent
                        const isHourly = minutesFromMidnight % 60 === 0;
                        
                        return (
                          <Box
                            key={`grid-${i}`}
                            style={{
                              position: 'absolute',
                              top: `${topPixels}px`,
                              left: '80px',
                              right: 0,
                              height: isHourly ? '1px' : '1px',
                              backgroundColor: isHourly ? '#d0d0d0' : '#f0f0f0',
                              pointerEvents: 'none',
                              opacity: isHourly ? 1 : 0.5,
                            }}
                          />
                        );
                      })}

                      {/* Scheduled items as blocks */}
                      <Box
                        style={{
                          position: 'absolute',
                          left: '80px',
                          top: '12px', // Match paddingTop to align with time labels
                          right: 0,
                          bottom: 0,
                          pointerEvents: 'none', // Allow clicks to pass through to timeline (blocks will override)
                        }}
                      >
                        {(() => {
                          const { saved, pending } = getAllScheduledItems();
                          const allItems = [
                            ...saved.map(item => ({ ...item, type: 'saved' as const })),
                            ...pending.map(item => ({ ...item, type: 'pending' as const })),
                          ];

                          return allItems.map((item) => {
                            const position = getItemPosition(item);
                            const isShow = item.season !== null && item.episode !== null;
                            const displayTitle = isShow
                              ? `${item.title} - S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
                              : item.title;

                            const startTime = new Date(item.scheduled_time);
                            const timeStr = startTime.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            });

                            return (
                              <Box
                                key={item.id}
                                style={{
                                  position: 'absolute',
                                  top: position.top,
                                  left: '8px',
                                  right: '8px',
                                  height: position.height,
                                  marginBottom: '8px', // Increased spacing between blocks
                                  paddingBottom: '4px', // Additional padding at bottom for clickability after short blocks
                                  backgroundColor: item.type === 'saved' ? '#4A90E2' : '#FFD700',
                                  border: `2px solid ${item.type === 'saved' ? '#2563EB' : '#F59E0B'}`,
                                  borderRadius: '6px',
                                  padding: position.duration <= 15 ? '8px 12px' : '12px 14px', // Smaller padding for short blocks
                                  cursor: 'default',
                                  zIndex: 2,
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                  gap: position.duration <= 15 ? '4px' : '6px', // Smaller gap for short blocks
                                  pointerEvents: 'auto', // Allow clicks on the block itself
                                  minHeight: position.duration <= 15 ? '40px' : '60px', // Smaller minimum for short durations
                                  boxSizing: 'border-box', // Ensure padding is included in height
                                }}
                                onMouseDown={(e) => {
                                  // Only stop propagation for clicks on the block content
                                  // Allow clicks between blocks to pass through
                                  const target = e.target as HTMLElement;
                                  if (target.closest('button') || target.closest('[data-block-content]')) {
                                    e.stopPropagation();
                                  }
                                }}
                                onClick={(e) => {
                                  // Only stop propagation if clicking on block content
                                  const target = e.target as HTMLElement;
                                  if (!target.closest('button') && !target.closest('[data-block-content]')) {
                                    // Click is on empty space in block, allow it to pass through
                                    return;
                                  }
                                  e.stopPropagation();
                                }}
                              >
                                {position.duration <= 15 ? (
                                  // For short blocks: title and duration on same line
                                  <Group 
                                    justify="space-between" 
                                    wrap="nowrap" 
                                    gap="xs"
                                    data-block-content
                                    style={{ width: '100%' }}
                                  >
                                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                      <Text
                                        size="xs"
                                        fw={600}
                                        c="white"
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flex: 1,
                                        }}
                                        data-block-content
                                      >
                                        {displayTitle}
                                      </Text>
                                      <Text size="xs" c="white" opacity={0.9} style={{ whiteSpace: 'nowrap' }} data-block-content>
                                        {item.duration || '?'} min
                                      </Text>
                                    </Group>
                                    <Button
                                      size="xs"
                                      variant="subtle"
                                      color="red"
                                      style={{
                                        padding: '2px 4px',
                                        minWidth: 'auto',
                                        height: '18px',
                                        backgroundColor: 'rgba(255,255,255,0.2)',
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (item.type === 'saved') {
                                          deleteMutation.mutate(item.id);
                                        } else {
                                          handleRemovePending(item.id);
                                        }
                                      }}
                                    >
                                      <IconX size={12} />
                                    </Button>
                                  </Group>
                                ) : (
                                  // For longer blocks: title on top, time/duration below
                                  <>
                                    <Group 
                                      justify="space-between" 
                                      wrap="nowrap" 
                                      gap="xs"
                                      data-block-content
                                    >
                                      <Text
                                        size="xs"
                                        fw={600}
                                        c="white"
                                        style={{
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          flex: 1,
                                        }}
                                        data-block-content
                                      >
                                        {displayTitle}
                                      </Text>
                                      <Button
                                        size="xs"
                                        variant="subtle"
                                        color="red"
                                        style={{
                                          padding: '2px 4px',
                                          minWidth: 'auto',
                                          height: '18px',
                                          backgroundColor: 'rgba(255,255,255,0.2)',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (item.type === 'saved') {
                                            deleteMutation.mutate(item.id);
                                          } else {
                                            handleRemovePending(item.id);
                                          }
                                        }}
                                      >
                                        <IconX size={12} />
                                      </Button>
                                    </Group>
                                    <Text size="xs" c="white" opacity={0.9} data-block-content>
                                      {timeStr} - {item.duration || '?'} min
                                    </Text>
                                  </>
                                )}
                              </Box>
                            );
                          });
                        })()}
                      </Box>

                      {/* Hover indicator line and duration info */}
                      {hoveredTime && !isEmpty && (
                        <>
                          {/* Vertical line showing hover position */}
                          <Box
                            style={{
                              position: 'absolute',
                              top: `${12 + ((hoveredTime.hour * 60 + hoveredTime.minute) * 2)}px`, // 2px per minute, account for paddingTop
                              left: '80px',
                              right: 0,
                              height: '2px',
                              backgroundColor: '#4A90E2',
                              pointerEvents: 'none',
                              zIndex: 5,
                              boxShadow: '0 0 4px rgba(74, 144, 226, 0.5)',
                            }}
                          />
                          {/* Tooltip showing time and available duration - positioned to the right of cursor */}
                          <Box
                            style={{
                              position: 'fixed', // Use fixed positioning relative to viewport
                              top: `${hoveredTime.mouseY}px`,
                              left: `${hoveredTime.mouseX + 15}px`, // Position to the right of cursor
                              backgroundColor: 'rgba(0,0,0,0.9)',
                              color: 'white',
                              padding: '10px 14px',
                              borderRadius: '6px',
                              pointerEvents: 'none',
                              zIndex: 1000, // High z-index to appear above everything
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              minWidth: '180px',
                              transform: 'translateY(-50%)', // Center vertically on cursor
                            }}
                          >
                            <Text size="sm" fw={600} mb={4}>
                              {hoveredTime.time.toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              })}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {hoveredTime.availableDuration >= 60
                                ? `${Math.floor(hoveredTime.availableDuration / 60)}h ${hoveredTime.availableDuration % 60}m available`
                                : `${hoveredTime.availableDuration}m available`}
                            </Text>
                            <Text size="xs" c="blue" mt={4} style={{ fontStyle: 'italic' }}>
                              Click to schedule
                            </Text>
                          </Box>
                        </>
                      )}

                      {/* Click hint */}
                      {!isEmpty && !hoveredTime && (
                        <Box
                          style={{
                            position: 'absolute',
                            bottom: '16px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            color: 'white',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            pointerEvents: 'none',
                            zIndex: 3,
                          }}
                        >
                          <Text size="xs">Hover to see available time • Click to schedule</Text>
                        </Box>
                      )}
                    </Box>
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
          setSelectedEpisodes(new Map());
        }}
        title={
          selectedTimeSlot
            ? `Schedule at ${selectedTimeSlot.display}`
            : 'Select Queue Item to Schedule'
        }
        centered
        size="lg"
        styles={{
          root: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          content: {
            margin: 'auto',
            maxWidth: '90vw',
            maxHeight: '90vh',
            marginTop: '20px', // Add top margin to prevent cutoff
            marginBottom: '20px',
          },
          body: {
            maxHeight: 'calc(90vh - 100px)', // Account for header and padding
            overflow: 'auto',
          },
        }}
      >
        <Stack gap="md">
          {selectedTimeSlot && selectedQueueItem ? (
            // Show episode selection for shows or confirmation for movies
            <>
              <Text size="sm" c="dimmed">
                Scheduling for <strong>{selectedQueueItem.title}</strong> at{' '}
                <strong>{selectedTimeSlot.display}</strong> on{' '}
                <strong>
                  {toDate(selectedDate)?.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  }) || 'Invalid date'}
                </strong>
              </Text>

              {/* Episode Selection for Shows */}
              {selectedQueueItem.content_type === 'show' && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">
                    Select Episodes {selectedEpisodes.size > 0 && `(${selectedEpisodes.size} selected)`}
                  </Text>
                  
                  {episodesLoading ? (
                    <Center py="md">
                      <Loader size="sm" />
                    </Center>
                  ) : episodes && episodes.length > 0 ? (
                    <ScrollArea h={300}>
                      <Accordion>
                        {Object.entries(episodesBySeason)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([seasonNum, seasonEpisodes]) => (
                            <Accordion.Item key={seasonNum} value={`season-${seasonNum}`}>
                              <Accordion.Control>
                                <Text fw={500}>
                                  Season {seasonNum} ({seasonEpisodes.length} episodes)
                                </Text>
                              </Accordion.Control>
                              <Accordion.Panel>
                                <Stack gap="xs">
                                  {seasonEpisodes.map((ep) => (
                                    <Checkbox
                                      key={ep.id}
                                      label={
                                        <Text size="sm">
                                          E{ep.episode_number.toString().padStart(2, '0')} - {ep.title}
                                          {ep.duration && (
                                            <Text component="span" c="dimmed" size="xs" ml="xs">
                                              ({ep.duration} min)
                                            </Text>
                                          )}
                                        </Text>
                                      }
                                      checked={isEpisodeSelected(ep.season, ep.episode_number)}
                                      onChange={(e) =>
                                        handleEpisodeToggle(
                                          ep.season,
                                          ep.episode_number,
                                          e.currentTarget.checked
                                        )
                                      }
                                    />
                                  ))}
                                </Stack>
                              </Accordion.Panel>
                            </Accordion.Item>
                          ))}
                      </Accordion>
                    </ScrollArea>
                  ) : (
                    <Alert icon={<IconAlertCircle size={16} />} title="No Episodes">
                      Episodes not available for this show.
                    </Alert>
                  )}
                </Box>
              )}

              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setScheduleModalOpened(false);
                    setSelectedQueueItem(null);
                    setSelectedTimeSlot(null);
                    setSelectedEpisodes(new Map());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="light"
                  onClick={() => selectedQueueItem && addToPending(selectedQueueItem)}
                  disabled={
                    !selectedQueueItem ||
                    (selectedQueueItem.content_type === 'show' && selectedEpisodes.size === 0)
                  }
                >
                  Add to Pending
                </Button>
                <Button
                  onClick={() => selectedQueueItem && handleScheduleItem(selectedQueueItem)}
                  disabled={
                    !selectedQueueItem ||
                    (selectedQueueItem.content_type === 'show' && selectedEpisodes.size === 0)
                  }
                  loading={scheduleMutation.isPending}
                >
                  Schedule Now
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
                      setSelectedEpisodes(new Map()); // Reset episode selection
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
                    setSelectedEpisodes(new Map());
                  }}
                >
                  Cancel
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


