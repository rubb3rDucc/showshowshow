import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Text,
  Stack,
  Group,
  Badge,
  Image,
  Box,
  Button,
  Loader,
  Center,
  Alert,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconClock, IconCheck, IconAlertCircle, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import { getSchedule, clearSchedule } from '../../api/schedule';
import type { ScheduleItem } from '../../types/api';

export function ScheduleView() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewAll, setViewAll] = useState(false);
  const queryClient = useQueryClient();

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

  // Clear schedule mutation
  const clearMutation = useMutation({
    mutationFn: clearSchedule,
    onSuccess: (data) => {
      toast.success(data.message || 'Schedule cleared successfully!');
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to clear schedule');
    },
  });

  // Group schedule by date
  const groupedSchedule = schedule?.reduce((acc, item) => {
    const date = new Date(item.scheduled_time).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(item);
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

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
      {/* Date Picker and Controls */}
      <Group justify="space-between" align="center">
        <DatePickerInput
          value={selectedDate}
          onChange={(date) => {
            console.log('Date picked:', date, typeof date, date?.constructor?.name);
            console.log('Date details:', date && {
              getDate: (date as any).getDate?.(),
              getMonth: (date as any).getMonth?.(),
              getFullYear: (date as any).getFullYear?.(),
              toString: date.toString(),
            });
            setSelectedDate(date as Date | null);
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
            disabled={!schedule || schedule.length === 0}
          >
            Clear Schedule
          </Button>
        </Group>
      </Group>

      {/* Debug Info */}
      <Text size="xs" c="dimmed">
        {viewAll ? 'Viewing: All dates' : `Viewing: ${dateStr || 'Unknown date'}`} | Found: {schedule?.length || 0} items
      </Text>

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
      {groupedSchedule && Object.keys(groupedSchedule).map((date) => (
        <Box key={date}>
          <Text size="lg" fw={600} mb="md">
            {date}
          </Text>
          <Stack gap="md">
            {groupedSchedule[date]
              .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
              .map((item) => (
                <ScheduleItemCard key={item.id} item={item} />
              ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

// Individual schedule item card
function ScheduleItemCard({ item }: { item: ScheduleItem }) {
  const scheduledTime = new Date(item.scheduled_time);
  const timeStr = scheduledTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isShow = item.season !== null && item.episode !== null;
  const displayTitle = isShow
    ? `${item.title} - S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`
    : item.title;

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <Group wrap="nowrap" align="flex-start">
        {/* Poster */}
        {item.poster_url && (
          <Image
            src={item.poster_url}
            width={60}
            height={90}
            radius="sm"
            alt={item.title}
            fit="cover"
          />
        )}

        {/* Content Info */}
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group justify="space-between" align="flex-start">
            <Text fw={600} size="md">
              {displayTitle}
            </Text>
            {item.watched && (
              <Badge color="green" leftSection={<IconCheck size={12} />}>
                Watched
              </Badge>
            )}
          </Group>

          <Group gap="md">
            <Group gap="xs">
              <IconClock size={16} />
              <Text size="sm" c="dimmed">
                {timeStr}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {item.duration} min
            </Text>
            <Badge variant="light" size="sm">
              {item.content_type === 'show' ? 'TV Show' : 'Movie'}
            </Badge>
          </Group>
        </Stack>
      </Group>
    </Card>
  );
}

