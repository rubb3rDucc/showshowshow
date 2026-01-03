import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Modal,
  Button,
  Stack,
  Select,
  Checkbox,
  Group,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { toast } from 'sonner';
import { generateScheduleFromQueue } from '../../api/schedule';
import type { GenerateScheduleRequest } from '../../types/api';

interface GenerateScheduleModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateScheduleModal({ opened, onClose, onSuccess }: GenerateScheduleModalProps) {
  const queryClient = useQueryClient();
  const today = new Date();

  const [scheduleDate, setScheduleDate] = useState<Date | null>(today);
  const [startTimeBlock, setStartTimeBlock] = useState('20:00'); // Prime time default
  const [duration, setDuration] = useState('180'); // 3 hours in minutes
  const [rotationType, setRotationType] = useState<'round_robin' | 'random' | 'round_robin_double'>('round_robin');

  // Network-style time slots
  const timeBlocks = [
    { value: '06:00', label: 'Early Morning (6:00 AM)' },
    { value: '09:00', label: 'Morning (9:00 AM)' },
    { value: '12:00', label: 'Midday (12:00 PM)' },
    { value: '15:00', label: 'Afternoon (3:00 PM)' },
    { value: '17:00', label: 'Early Evening (5:00 PM)' },
    { value: '20:00', label: 'Prime Time (8:00 PM)' },
    { value: '23:00', label: 'Late Night (11:00 PM)' },
  ];

  // Get user's timezone info
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || 'Local';

  const generateMutation = useMutation({
    mutationFn: (params: GenerateScheduleRequest) => generateScheduleFromQueue(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      
      if (data.skippedItems && data.skippedItems.length > 0) {
        // Group skipped items by content for succinct display
        const skippedGrouped = data.skippedItems.reduce((acc, item) => {
          const key = item.content_title || item.content_id;
          if (!acc[key]) {
            acc[key] = {
              title: item.content_title || 'Unknown',
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {} as Record<string, { title: string; count: number }>);
        
        // Group successfully scheduled items by content
        const scheduledGrouped = (data.schedule || []).reduce((acc, item) => {
          const key = item.title || item.content_id;
          if (!acc[key]) {
            acc[key] = {
              title: item.title || 'Unknown',
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {} as Record<string, { title: string; count: number }>);
        
        // Build succinct messages
        const skippedList = Object.values(skippedGrouped)
          .map(group => `${group.title}${group.count > 1 ? ` (${group.count})` : ''}`)
          .join(', ');
        
        const scheduledList = Object.values(scheduledGrouped)
          .map(group => `${group.title}${group.count > 1 ? ` (${group.count})` : ''}`)
          .join(', ');
        
        const scheduledCount = data.schedule?.length || 0;
        const skippedCount = data.skippedItems.length;
        
        // Build description with both scheduled and skipped items
        let description = '';
        if (scheduledCount > 0) {
          description = `✅ Scheduled (${scheduledCount}): ${scheduledList}`;
          if (skippedCount > 0) {
            description += `\n❌ Skipped (${skippedCount}): ${skippedList}`;
          }
        } else {
          description = `❌ Skipped (${skippedCount}): ${skippedList}`;
        }
        description += '\n💡 Clear existing items or choose a different time range';
        
        const conflictMessage = scheduledCount > 0 
          ? `Schedule generated: ${scheduledCount} scheduled, ${skippedCount} skipped`
          : `${skippedCount} item${skippedCount !== 1 ? 's' : ''} could not be scheduled`;
        
        // Show warning toast with manual dismiss option
        toast.warning(conflictMessage, {
          duration: Infinity, // Don't auto-dismiss - user must manually close
          description: description,
          dismissible: true, // Explicitly enable close button
        });
      } else {
        // Show success if everything scheduled
        toast.success(data.message || `Schedule generated! ${data.schedule?.length || 0} items created.`);
        onClose();
        // Stay on current page to show what was scheduled
      }
    },
    onError: (error: Error) => {
      console.error('Schedule generation error:', error);
      toast.error(error.message || 'Failed to generate schedule');
    },
  });
  
  const handleClose = () => {
    onClose();
  };

  const handleGenerate = () => {
    if (!scheduleDate) {
      toast.error('Please select a date');
      return;
    }

    // Calculate end time based on start time + duration
    const [startHour, startMinute] = startTimeBlock.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = startMinutes + Number(duration);
    const endHour = Math.floor(endMinutes / 60) % 24;
    const endMinute = endMinutes % 60;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;

    // Format dates as YYYY-MM-DD (using local date to preserve the calendar date selected)
    const formatDate = (date: Date | null | string): string => {
      if (!date) return '';
      
      // If already a string in YYYY-MM-DD format, return it directly
      if (typeof date === 'string') {
        // Validate format
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Otherwise parse it
        const dateObj = new Date(date + 'T12:00:00'); // Add noon to avoid timezone issues
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // Convert to Date if needed
      const dateObj = date instanceof Date ? date : new Date(date);
      
      if (isNaN(dateObj.getTime())) {
        console.error('Invalid date:', date);
        return '';
      }
      
      // Extract the local calendar date components
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const formatted = `${year}-${month}-${day}`;
      
      return formatted;
    };

    const formattedDate = formatDate(scheduleDate);

    console.log('Schedule generation params:', {
      scheduleDate,
      formattedDate,
      startTime: startTimeBlock,
      endTime,
      duration,
    });

    // Get user's timezone offset (e.g., "-05:00" for EST, "+00:00" for UTC)
    const getTimezoneOffset = (): string => {
      const date = new Date();
      const offsetMinutes = -date.getTimezoneOffset(); // Negative because we want offset from UTC
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
      const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
      return `${sign}${hours}:${minutes}`;
    };

    const params: GenerateScheduleRequest = {
      start_date: formattedDate,
      end_date: formattedDate, // Same date for single-day scheduling
      start_time: startTimeBlock,
      end_time: endTime,
      timezone_offset: getTimezoneOffset(), // Send user's current timezone
      rotation_type: rotationType as 'round_robin' | 'random',
    };

    console.log('Generating schedule with params:', params);
    generateMutation.mutate(params);
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Generate Schedule"
      size="md"
      closeOnClickOutside={true}
      styles={{
        title: {
          fontSize: '20px',
          fontWeight: 500,
          color: '#111827',
        },
      }}
    >
      <Stack gap="lg">
        {/* Timezone info */}
        <Text size="sm" c="dimmed" fw={300}>
          All times are in your timezone: <strong style={{ fontWeight: 500 }}>{userTimezone}</strong> ({timezoneAbbr})
        </Text>

        {/* Date */}
        <DatePickerInput
          label="Date"
          placeholder="Pick a date"
          value={scheduleDate}
          onChange={(date) => {
            setScheduleDate(date as Date | null);
          }}
          required
          styles={{
            label: { fontSize: '14px', fontWeight: 500, color: '#111827', marginBottom: '6px' },
          }}
        />

        {/* Time Block */}
        <Stack gap="sm">
          <Text size="sm" fw={500} c="#111827">
            Time Block
          </Text>
          <Select
            label="Start time"
            value={startTimeBlock}
            onChange={(value) => setStartTimeBlock(value || '20:00')}
            data={timeBlocks}
            required
            styles={{
              label: { fontSize: '14px', fontWeight: 400, color: '#6b7280', marginBottom: '4px' },
            }}
          />

          <Select
            label="How much time do you want to dedicate?"
            value={duration}
            onChange={(value) => setDuration(value || '180')}
            data={[
              { value: '30', label: '30 minutes' },
              { value: '60', label: '1 hour' },
              { value: '90', label: '1.5 hours' },
              { value: '120', label: '2 hours' },
              { value: '150', label: '2.5 hours' },
              { value: '180', label: '3 hours' },
            ]}
            required
            styles={{
              label: { fontSize: '14px', fontWeight: 400, color: '#6b7280', marginBottom: '4px' },
            }}
          />
        </Stack>

        {/* Options */}
        <Stack gap="sm">
          <Text size="sm" fw={500} c="#111827">
            Options
          </Text>

          <Select
            label="Show rotation"
            description="How many episodes to schedule from each show before moving to the next"
            value={rotationType}
            onChange={(value) => setRotationType(value as 'round_robin' | 'random' | 'round_robin_double')}
            data={[
              { value: 'round_robin', label: 'One episode per show' },
              { value: 'round_robin_double', label: 'Two episodes per show' },
              { value: 'random', label: 'Random mix' },
            ]}
            styles={{
              label: { fontSize: '14px', fontWeight: 400, color: '#6b7280', marginBottom: '4px' },
              description: { fontSize: '12px', color: '#9ca3af', marginTop: '2px' },
            }}
          />
        </Stack>

        {/* Actions */}
        <Group justify="flex-end" mt="md" gap="sm">
          <Button
            variant="subtle"
            color="gray"
            onClick={handleClose}
            styles={{
              root: { fontWeight: 400 },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            loading={generateMutation.isPending}
            styles={{
              root: {
                backgroundColor: '#646cff',
                fontWeight: 400,
                '&:hover': {
                  backgroundColor: '#525aef',
                },
              },
            }}
          >
            Generate Schedule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
