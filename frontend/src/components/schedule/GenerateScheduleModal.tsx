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
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { TimeInput } from '@mantine/dates';
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
  const [rotationType, setRotationType] = useState<'round_robin' | 'random'>('round_robin');
  const [includeReruns, setIncludeReruns] = useState(false);

  const generateMutation = useMutation({
    mutationFn: (params: GenerateScheduleRequest) => generateScheduleFromQueue(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      toast.success(data.message || `Schedule generated! ${data.schedule?.length || 0} items created.`);
      onClose();
      // Small delay before navigation to ensure state updates
      setTimeout(() => {
        onSuccess();
      }, 100);
    },
    onError: (error: Error) => {
      console.error('Schedule generation error:', error);
      toast.error(error.message || 'Failed to generate schedule');
    },
  });

  const handleGenerate = () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }

    // Format dates as YYYY-MM-DD (using local date to preserve the calendar date selected)
    const formatDate = (date: Date | null): string => {
      if (!date) return '';
      
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
      
      console.log('Formatting date for schedule generation:', { input: date, output: formatted });
      
      return formatted;
    };

    const params: GenerateScheduleRequest = {
      start_date: formatDate(startDate),
      end_date: formatDate(endDate),
      start_time: startTime,
      end_time: endTime,
      rotation_type: rotationType,
      include_reruns: includeReruns,
    };

    console.log('Generating schedule with params:', params);
    generateMutation.mutate(params);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Generate Schedule"
      size="md"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
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
        <TimeInput
          label="Start Time"
          value={startTime}
          onChange={(e) => setStartTime(e.currentTarget.value)}
          required
        />

        <TimeInput
          label="End Time"
          value={endTime}
          onChange={(e) => setEndTime(e.currentTarget.value)}
          required
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
          <Button variant="subtle" onClick={onClose}>
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

