import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import {
  Card,
  Text,
  Stack,
  Group,
  Box,
  Button,
  Loader,
  Center,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconClock, IconAlertCircle, IconTrash, IconEdit } from '@tabler/icons-react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { getSchedule, clearScheduleForDate } from '../../api/schedule';
import { getEpisodes } from '../../api/content';
import type { ScheduleItem } from '../../types/api';
import { ScheduleCard, adaptScheduleItemForCard, adaptScheduleItemToQueueCard } from './ScheduleCard';

export function ScheduleView() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewAll, setViewAll] = useState(false);
  const queryClient = useQueryClient();

  // Get user's timezone info
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || 'Local';

  // Format date as YYYY-MM-DD (using local date to preserve the calendar date selected)
  const formatDate = (date: Date | null | undefined): string | undefined => {
    if (!date) return undefined;
    
    // Convert to Date if needed
    const dateObj = date instanceof Date ? date : new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date:', date);
      return undefined;
    }
    
    // Extract the local calendar date components to preserve what the user selected
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const formatted = `${year}-${month}-${day}`;
    
    console.log('Formatting date:', { input: date, output: formatted, dateObj });
    
    return formatted;
  };

  const dateStr = viewAll ? undefined : formatDate(selectedDate);

  // Fetch schedule (filtered or all)
  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ['schedule', dateStr || 'all'],
    queryFn: () => getSchedule(dateStr),
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

  // Get unique shows from schedule to fetch episode titles
  const scheduleShows = useMemo(() => {
    if (!schedule) return [];
    const shows = new Map<string, { content_id: string; tmdb_id: number }>();
    schedule.forEach(item => {
      if (item.content_type === 'show' && item.tmdb_id && item.season !== null && item.episode !== null) {
        if (!shows.has(item.content_id)) {
          shows.set(item.content_id, { content_id: item.content_id, tmdb_id: item.tmdb_id });
        }
      }
    });
    return Array.from(shows.values());
  }, [schedule]);

  // Fetch episodes for all scheduled shows in parallel using useQueries
  const scheduleEpisodesQueries = useQueries({
    queries: scheduleShows.map(show => ({
      queryKey: ['episodes', show.tmdb_id, 'schedule'],
      queryFn: () => getEpisodes(show.tmdb_id),
      enabled: !!show.tmdb_id,
    })),
  });

  // Combine all episode data into a single map for easy lookup
  const episodeTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    scheduleEpisodesQueries.forEach((query, index) => {
      if (query.data) {
        const show = scheduleShows[index];
        query.data.forEach(ep => {
          const key = `${show.content_id}-${ep.season}-${ep.episode_number}`;
          map.set(key, ep.title);
        });
      }
    });
    return map;
  }, [scheduleEpisodesQueries, scheduleShows]);

  // Clear schedule for selected date mutation
  const clearMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) {
        throw new Error('Please select a date first');
      }
      const dateStr = formatDate(selectedDate);
      if (!dateStr) {
        throw new Error('Invalid date');
      }
      return clearScheduleForDate(dateStr);
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Schedule cleared for selected date!');
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to clear schedule');
    },
  });

  // Group schedule by date (using LOCAL timezone)
  const groupedSchedule = schedule?.reduce((acc, item) => {
    // Parse UTC time from backend - JavaScript automatically converts to local
    const scheduledDate = new Date(item.scheduled_time);
    
    // Get local date string (YYYY-MM-DD format for consistency and sorting)
    const year = scheduledDate.getFullYear();
    const month = String(scheduledDate.getMonth() + 1).padStart(2, '0');
    const day = String(scheduledDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    // Display date in user's locale
    const dateDisplay = scheduledDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    
    if (!acc[dateKey]) {
      acc[dateKey] = { display: dateDisplay, items: [] };
    }
    acc[dateKey].items.push(item);
    return acc;
  }, {} as Record<string, { display: string; items: ScheduleItem[] }>);

  if (isLoading) {
    return (
      <Center py={60}>
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading schedule...</Text>
        </Stack>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" title="Error" icon={<IconAlertCircle />}>
        Failed to load schedule. Please try again.
      </Alert>
    );
  }

  const isEmpty = !schedule || schedule.length === 0;

  return (
    <Stack gap="lg">
      <Group align="center" gap="xs">
        <IconClock size={16} />
        <Text size="sm" c="dimmed">
          All times shown in your timezone: <strong>{timezoneAbbr}</strong> ({userTimezone})
        </Text>
      </Group>

      {/* Date Picker and Controls */}
      <Group justify="space-between" align="center">
        <DatePickerInput
          value={selectedDate}
          onChange={(date) => {
            // Handle different date types from Mantine DatePickerInput
            let dateObj: Date | null = null;
            
            if (!date) {
              dateObj = null;
            } else {
              // Mantine can return Date, string, or other types
              const dateValue = date as unknown;
              
              if (dateValue instanceof Date) {
                dateObj = dateValue;
              } else if (typeof dateValue === 'string') {
                // Parse string date (YYYY-MM-DD format)
                dateObj = new Date(dateValue + 'T00:00:00'); // Add time to avoid timezone issues
              } else {
                // Try to convert to Date (handle unknown types)
                const dateStr = String(dateValue);
                dateObj = new Date(dateStr);
              }
            }
            
            // Validate the date
            if (dateObj && isNaN(dateObj.getTime())) {
              console.error('Invalid date:', date);
              return;
            }
            
            setSelectedDate(dateObj);
            setViewAll(false);
          }}
          placeholder="Pick date"
          leftSection={<IconCalendar size={16} />}
          style={{ maxWidth: 250 }}
          disabled={viewAll}
        />
        <Group gap="xs">
          <Button
            variant={viewAll ? 'filled' : 'subtle'}
            onClick={() => setViewAll(!viewAll)}
          >
            {viewAll ? 'View by Date' : 'View All'}
          </Button>
          <Button
            variant="subtle"
            onClick={() => {
              setSelectedDate(new Date());
              setViewAll(false);
            }}
            disabled={viewAll}
          >
            Today
          </Button>
          <Button
            variant="light"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => clearMutation.mutate()}
            loading={clearMutation.isPending}
            disabled={!schedule || schedule.length === 0 || viewAll || !selectedDate}
          >
            Clear Schedule for Day
          </Button>
          <Link href="/queue">
            <Button
              variant="subtle"
              leftSection={<IconEdit size={16} />}
            >
              Edit Queue
            </Button>
          </Link>
        </Group>
      </Group>

      {/* Debug Info */}
      <Text size="xs" c="dimmed">
        {viewAll ? 'Viewing: All dates' : `Viewing: ${dateStr || 'Unknown date'}`} | Found: {schedule?.length || 0} items
      </Text>

      {/* Date Header - Always show when viewing by specific date */}
      {!viewAll && selectedDate && (
        <Text size="lg" fw={600} mb="md">
          {selectedDate instanceof Date 
            ? selectedDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              })
            : new Date(selectedDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              })}
        </Text>
      )}

      {/* Empty State */}
      {isEmpty && (
        <Card shadow="sm" padding="xl" radius="md" withBorder>
          <Center py={40}>
            <Stack align="center" gap="md">
              <IconCalendar size={48} stroke={1.5} opacity={0.3} />
              <Text size="lg" fw={500} c="dimmed">
                No schedule for this date
              </Text>
              <Text size="sm" c="dimmed" ta="center">
                Generate a schedule from your queue to get started
              </Text>
            </Stack>
          </Center>
        </Card>
      )}

      {/* Schedule List */}
      {groupedSchedule && Object.keys(groupedSchedule)
        .sort() // Sort dates chronologically (YYYY-MM-DD format sorts correctly)
        .map((dateKey) => {
          // If viewing by specific date, show the selected date; otherwise show the item's date
          let displayDate: string;
          
          if (viewAll) {
            displayDate = groupedSchedule[dateKey].display;
          } else if (selectedDate) {
            // Ensure selectedDate is a Date object
            const dateObj = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
            if (!isNaN(dateObj.getTime())) {
              displayDate = dateObj.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
              });
            } else {
              displayDate = groupedSchedule[dateKey].display;
            }
          } else {
            displayDate = groupedSchedule[dateKey].display;
          }
          
          return (
            <Box key={dateKey}>
              {/* Only show date header in "View All" mode (when viewing by date, header is shown above) */}
              {viewAll && (
                <Text size="lg" fw={600} mb="md">
                  {displayDate}
                </Text>
              )}
              <Stack gap={0}>
                {groupedSchedule[dateKey].items
                  .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
                  .map((item, index) => {
                    const scheduleCardItem = adaptScheduleItemForCard(item);
                    // Create a queue-like item from the schedule item for poster/type info
                    const queueCardItem = adaptScheduleItemToQueueCard(item);
                    
                    // Get episode title if available
                    const episodeTitle = item.season !== null && item.episode !== null
                      ? episodeTitleMap.get(`${item.content_id}-${item.season}-${item.episode}`)
                      : null;
                    
                    return (
                      <ScheduleCard
                        key={item.id}
                        scheduleItem={scheduleCardItem}
                        queueItem={queueCardItem}
                        rowNumber={index + 1}
                        season={item.season}
                        episode={item.episode}
                        episodeTitle={episodeTitle || null}
                      />
                    );
                  })}
              </Stack>
            </Box>
          );
        })}
    </Stack>
  );
}


