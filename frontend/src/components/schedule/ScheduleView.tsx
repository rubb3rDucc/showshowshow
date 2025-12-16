import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Text,
  Stack,
  Box,
  Loader,
  Center,
  Alert,
} from '@mantine/core';
import { IconAlertCircle, IconCalendar } from '@tabler/icons-react';
import { toast } from 'sonner';
import { getSchedule, clearScheduleForDate } from '../../api/schedule';
import type { ScheduleItem } from '../../types/api';
import { ScheduleCard } from './ScheduleCard';
import { adaptScheduleItemForCard, adaptScheduleItemToQueueCard } from './scheduleCardAdapters';
import { ScheduleHeader } from './ScheduleHeader';

export function ScheduleView() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [viewAll, setViewAll] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const queryClient = useQueryClient();

  // Get user's timezone info
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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
    
    return formatted;
  };

  // Handle date change from header component
  const handleDateChange = (date: Date | null) => {
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
  };

  // Handle clear day action
  const handleClearDay = () => {
    if (!selectedDate) return;
    clearMutation.mutate();
  };

  const dateStr = viewAll ? undefined : formatDate(selectedDate);

  // Fetch schedule (filtered or all)
  const { data: schedule, isLoading, error } = useQuery({
    queryKey: ['schedule', dateStr || 'all'],
    queryFn: () => getSchedule(dateStr),
    retry: 1,
    staleTime: 30000, // Cache for 30 seconds
  });

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
      {/* Schedule Header - Only show when viewing by date */}
      {!viewAll && (
        <ScheduleHeader
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onClearDay={handleClearDay}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
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
          
          const dailyItems = groupedSchedule[dateKey].items
            .sort((a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime());
          
          return (
            <Box key={dateKey}>
              {/* Only show date header in "View All" mode (when viewing by date, header is shown above) */}
              {viewAll && (
                <Text size="lg" fw={600} mb="md">
                  {displayDate}
                </Text>
              )}
              
              {/* Table Header - Hidden on Mobile */}
              {dailyItems.length > 0 && (
                <div className="hidden md:block bg-black text-white border-2 border-black font-mono mb-0">
                  <div className="grid grid-cols-12 py-3">
                    <div className="col-span-1 border-r-2 border-white flex items-center justify-center">
                      <span className="text-xs lg:text-sm font-black uppercase tracking-widest">
                        NO.
                      </span>
                    </div>
                    <div className="col-span-2 border-r-2 border-white flex items-center justify-center">
                      <span className="text-xs lg:text-sm font-black uppercase tracking-widest">
                        IMG
                      </span>
                    </div>
                    <div className="col-span-3 border-r-2 border-white flex items-center justify-center">
                      <span className="text-xs lg:text-sm font-black uppercase tracking-widest">
                        TIME
                      </span>
                    </div>
                    <div className="col-span-5 border-r-2 border-white flex items-center justify-center">
                      <span className="text-xs lg:text-sm font-black uppercase tracking-widest">
                        TITLE
                      </span>
                    </div>
                    <div className="col-span-1 flex items-center justify-center">
                      <span className="text-xs lg:text-sm font-black uppercase tracking-widest">
                        DUR
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <Stack gap={0}>
                {dailyItems.map((item, index) => {
                  const scheduleCardItem = adaptScheduleItemForCard(item);
                  // Create a queue-like item from the schedule item for poster/type info
                  const queueCardItem = adaptScheduleItemToQueueCard(item);
                  
                  return (
                    <ScheduleCard
                      key={item.id}
                      scheduleItem={scheduleCardItem}
                      queueItem={queueCardItem}
                      rowNumber={index + 1}
                      season={item.season}
                      episode={item.episode}
                      episodeTitle={item.episode_title || null}
                    />
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      
      {/* Timezone Info */}
      <div className="mt-8 md:mt-12 text-center border-t-2 border-black pt-6 md:pt-8 font-mono">
        <Text size="xs" className="font-black uppercase tracking-widest">
          TIMEZONE: {userTimezone}
        </Text>
      </div>
    </Stack>
  );
}


