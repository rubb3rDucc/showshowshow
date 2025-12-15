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
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const [startDate, setStartDate] = useState<Date | null>(today);
  const [endDate, setEndDate] = useState<Date | null>(tomorrow);
  const [startTime, setStartTime] = useState('20:00'); // 8 PM
  const [endTime, setEndTime] = useState('23:00'); // 11 PM (better default)
  const [timeSlotDuration, setTimeSlotDuration] = useState<string>('auto'); // Auto-calculate by default
  const [rotationType, setRotationType] = useState<'round_robin' | 'random'>('round_robin');
  const [includeReruns, setIncludeReruns] = useState(false);

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
        // Small delay before navigation to ensure state updates
        setTimeout(() => {
          onSuccess();
        }, 100);
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
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    // Validate time format (HH:MM in 24-hour format)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime)) {
      toast.error('Invalid start time format. Use HH:MM (e.g., 13:00 for 1 PM)');
      return;
    }
    if (!timeRegex.test(endTime)) {
      toast.error('Invalid end time format. Use HH:MM (e.g., 23:00 for 11 PM)');
      return;
    }

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

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    console.log('Schedule generation dates:', {
      startDate,
      endDate,
      formattedStartDate,
      formattedEndDate,
      startTime,
      endTime,
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
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      start_time: startTime,
      end_time: endTime,
      // Only include time_slot_duration if not 'auto'
      ...(timeSlotDuration !== 'auto' && { time_slot_duration: Number(timeSlotDuration) }),
      timezone_offset: getTimezoneOffset(), // Send user's current timezone
      rotation_type: rotationType,
      include_reruns: includeReruns,
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
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📍</span>
          <span>All times are in your timezone: <strong>{userTimezone}</strong> ({timezoneAbbr})</span>
        </Text>

        <Text size="sm" c="dimmed">
          Create a schedule from your queue. Choose the date range and time slot for your programming block.
        </Text>
        <Text size="xs" c="yellow">
          💡 Tip: A 3-hour block (20:00-23:00) fits ~6-7 episodes
        </Text>

        {/* Date Range */}
        <DatePickerInput
          label="Start Date"
          placeholder="Pick start date"
          value={startDate}
          onChange={(date) => {
            console.log('Start date changed:', date, typeof date, date?.constructor?.name);
            setStartDate(date as Date | null);
          }}
          required
        />

        <DatePickerInput
          label="End Date"
          placeholder="Pick end date"
          value={endDate}
          onChange={(date) => {
            console.log('End date changed:', date, typeof date, date?.constructor?.name);
            setEndDate(date as Date | null);
          }}
          minDate={startDate || undefined}
          required
        />

        {/* Time Slot */}
        <TextInput
          label="Start Time"
          description="24-hour format (e.g., 13:00 for 1 PM, 20:00 for 8 PM)"
          placeholder="HH:MM"
          value={startTime}
          onChange={(e) => setStartTime(e.currentTarget.value)}
          pattern="[0-2][0-9]:[0-5][0-9]"
          required
        />

        <TextInput
          label="End Time"
          description="24-hour format (e.g., 23:00 for 11 PM)"
          placeholder="HH:MM"
          value={endTime}
          onChange={(e) => setEndTime(e.currentTarget.value)}
          pattern="[0-2][0-9]:[0-5][0-9]"
          required
        />

        {/* Time Slot Duration */}
        <Select
          label="Time Slot Duration"
          description="How often to check for new content to schedule"
          value={timeSlotDuration}
          onChange={(value) => setTimeSlotDuration(value || 'auto')}
          data={[
            { value: 'auto', label: '🤖 Auto (recommended) - Calculated from content' },
            { value: '15', label: '15 minutes (anime/short episodes)' },
            { value: '30', label: '30 minutes (standard TV)' },
            { value: '60', label: '60 minutes (hourly blocks)' },
          ]}
        />

        {/* Rotation Type */}
        <Select
          label="Rotation Type"
          description="How to rotate through your shows"
          value={rotationType}
          onChange={(value) => setRotationType(value as 'round_robin' | 'random')}
          data={[
            { value: 'round_robin', label: 'Round Robin - Rotate in order' },
            { value: 'random', label: 'Random - Shuffle randomly' },
          ]}
        />

        {/* Include Reruns */}
        <Checkbox
          label="Include rewatched content"
          description="Include episodes/movies you've already watched"
          checked={includeReruns}
          onChange={(e) => setIncludeReruns(e.currentTarget.checked)}
        />

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            loading={generateMutation.isPending}
          >
            Generate Schedule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}


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
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const [startDate, setStartDate] = useState<Date | null>(today);
  const [endDate, setEndDate] = useState<Date | null>(tomorrow);
  const [startTime, setStartTime] = useState('20:00'); // 8 PM
  const [endTime, setEndTime] = useState('23:00'); // 11 PM (better default)
  const [timeSlotDuration, setTimeSlotDuration] = useState<string>('auto'); // Auto-calculate by default
  const [rotationType, setRotationType] = useState<'round_robin' | 'random'>('round_robin');
  const [includeReruns, setIncludeReruns] = useState(false);

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
        // Small delay before navigation to ensure state updates
        setTimeout(() => {
          onSuccess();
        }, 100);
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
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    // Validate time format (HH:MM in 24-hour format)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(startTime)) {
      toast.error('Invalid start time format. Use HH:MM (e.g., 13:00 for 1 PM)');
      return;
    }
    if (!timeRegex.test(endTime)) {
      toast.error('Invalid end time format. Use HH:MM (e.g., 23:00 for 11 PM)');
      return;
    }

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

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    console.log('Schedule generation dates:', {
      startDate,
      endDate,
      formattedStartDate,
      formattedEndDate,
      startTime,
      endTime,
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
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      start_time: startTime,
      end_time: endTime,
      // Only include time_slot_duration if not 'auto'
      ...(timeSlotDuration !== 'auto' && { time_slot_duration: Number(timeSlotDuration) }),
      timezone_offset: getTimezoneOffset(), // Send user's current timezone
      rotation_type: rotationType,
      include_reruns: includeReruns,
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
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📍</span>
          <span>All times are in your timezone: <strong>{userTimezone}</strong> ({timezoneAbbr})</span>
        </Text>

        <Text size="sm" c="dimmed">
          Create a schedule from your queue. Choose the date range and time slot for your programming block.
        </Text>
        <Text size="xs" c="yellow">
          💡 Tip: A 3-hour block (20:00-23:00) fits ~6-7 episodes
        </Text>

        {/* Date Range */}
        <DatePickerInput
          label="Start Date"
          placeholder="Pick start date"
          value={startDate}
          onChange={(date) => {
            console.log('Start date changed:', date, typeof date, date?.constructor?.name);
            setStartDate(date as Date | null);
          }}
          required
        />

        <DatePickerInput
          label="End Date"
          placeholder="Pick end date"
          value={endDate}
          onChange={(date) => {
            console.log('End date changed:', date, typeof date, date?.constructor?.name);
            setEndDate(date as Date | null);
          }}
          minDate={startDate || undefined}
          required
        />

        {/* Time Slot */}
        <TextInput
          label="Start Time"
          description="24-hour format (e.g., 13:00 for 1 PM, 20:00 for 8 PM)"
          placeholder="HH:MM"
          value={startTime}
          onChange={(e) => setStartTime(e.currentTarget.value)}
          pattern="[0-2][0-9]:[0-5][0-9]"
          required
        />

        <TextInput
          label="End Time"
          description="24-hour format (e.g., 23:00 for 11 PM)"
          placeholder="HH:MM"
          value={endTime}
          onChange={(e) => setEndTime(e.currentTarget.value)}
          pattern="[0-2][0-9]:[0-5][0-9]"
          required
        />

        {/* Time Slot Duration */}
        <Select
          label="Time Slot Duration"
          description="How often to check for new content to schedule"
          value={timeSlotDuration}
          onChange={(value) => setTimeSlotDuration(value || 'auto')}
          data={[
            { value: 'auto', label: '🤖 Auto (recommended) - Calculated from content' },
            { value: '15', label: '15 minutes (anime/short episodes)' },
            { value: '30', label: '30 minutes (standard TV)' },
            { value: '60', label: '60 minutes (hourly blocks)' },
          ]}
        />

        {/* Rotation Type */}
        <Select
          label="Rotation Type"
          description="How to rotate through your shows"
          value={rotationType}
          onChange={(value) => setRotationType(value as 'round_robin' | 'random')}
          data={[
            { value: 'round_robin', label: 'Round Robin - Rotate in order' },
            { value: 'random', label: 'Random - Shuffle randomly' },
          ]}
        />

        {/* Include Reruns */}
        <Checkbox
          label="Include rewatched content"
          description="Include episodes/movies you've already watched"
          checked={includeReruns}
          onChange={(e) => setIncludeReruns(e.currentTarget.checked)}
        />

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            loading={generateMutation.isPending}
          >
            Generate Schedule
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

