import {
  Card,
  Text,
  Stack,
  Group,
  Button,
  Loader,
  Center,
  Alert,
  Collapse,
  Box,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconChevronDown, IconChevronUp, IconAlertCircle } from '@tabler/icons-react';
import { PendingItemsSummary } from './calendar/PendingItemsSummary';
import { ScheduleTimeline } from './calendar/ScheduleTimeline';
import { ScheduleModal } from './calendar/ScheduleModal';
import { useScheduleCalendar } from './calendar/hooks/useScheduleCalendar';
import type { QueueBuilderCalendarProps } from './calendar/types';

export function QueueBuilderCalendar({ expanded = true, onToggle }: QueueBuilderCalendarProps) {
  const {
    // State
    selectedDate,
    setSelectedDate,
    selectedTimeSlot,
    scheduleModalOpened,
    selectedQueueItem,
    setSelectedQueueItem,
    selectedEpisodes,
    pendingItems,
    hoveredTime,
    
    // Data
    queue,
    episodes,
    episodesBySeason,
    episodeTitleMap,
    
    // Loading states
    scheduleLoading,
    queueLoading,
    episodesLoading,
    isScheduling,
    isBatchSaving,
    
    // Computed
    getAllScheduledItems,
    isEmpty,
    
    // Handlers
    handleTimelineClick,
    handleTimelineMouseMove,
    handleTimelineMouseLeave,
    handleEpisodeToggle,
    isEpisodeSelected,
    addToPending,
    handleScheduleItem,
    handleSaveAll,
    handleRemovePending,
    resetModalSelection,
    onDeleteItem,
    onModalClose,
    schedulingMode,
    setSchedulingMode,
  } = useScheduleCalendar(expanded);

  const isLoading = scheduleLoading || queueLoading;
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { saved, pending } = getAllScheduledItems();

  const content = (
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
                    // Parse string date (YYYY-MM-DD format) - add time to avoid timezone issues
                    dateObj = new Date(dateValue + 'T00:00:00');
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
                
                // Create date at midnight in local timezone to preserve the calendar date selected
                if (dateObj) {
                  const localDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
                  setSelectedDate(localDate);
                } else {
                  setSelectedDate(null);
                }
              }}
              leftSection={<IconCalendar size={16} />}
              style={{ flex: 1 }}
            />
            <Text size="sm" c="dimmed" mt="xl">
              Timezone: {userTimezone}
            </Text>
          </Group>

          {/* Empty Queue State */}
          {isEmpty && (
            <Alert icon={<IconAlertCircle size={16} />} title="Empty Queue" color="yellow">
              Add items to your queue from the search page to schedule them.
            </Alert>
          )}

          {/* Pending Items Summary */}
          <PendingItemsSummary
            pendingItems={pendingItems}
            onSaveAll={handleSaveAll}
            onRemove={handleRemovePending}
            isLoading={isBatchSaving}
          />

          {/* Calendar Timeline */}
          <ScheduleTimeline
            selectedDate={selectedDate}
            pendingItemsCount={pendingItems.size}
            isEmpty={isEmpty}
            savedItems={saved}
            pendingItems={pending}
            hoveredTime={hoveredTime}
            episodeTitleMap={episodeTitleMap}
            onTimelineClick={handleTimelineClick}
            onTimelineMouseMove={handleTimelineMouseMove}
            onTimelineMouseLeave={handleTimelineMouseLeave}
            onDeleteItem={onDeleteItem}
          />
        </>
      )}
    </Stack>
  );

  // If onToggle is provided, render with collapsible wrapper
  if (onToggle !== undefined) {
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
            {content}
          </Collapse>
        </Card>
      </>
    );
  }

  // Otherwise, render without collapsible wrapper
  return (
    <>
      <Box style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {content}
      </Box>

      {/* Schedule Item Modal */}
      <ScheduleModal
        opened={scheduleModalOpened}
        onClose={onModalClose}
        selectedTimeSlot={selectedTimeSlot}
        selectedQueueItem={selectedQueueItem}
        selectedDate={selectedDate}
        queue={queue}
        episodes={episodes}
        episodesBySeason={episodesBySeason}
        episodesLoading={episodesLoading}
        selectedEpisodes={selectedEpisodes}
        onEpisodeToggle={handleEpisodeToggle}
        isEpisodeSelected={isEpisodeSelected}
        onQueueItemSelect={setSelectedQueueItem}
        onAddToPending={() => {
          if (selectedQueueItem) {
            addToPending(selectedQueueItem);
          }
        }}
        onScheduleNow={() => {
          if (selectedQueueItem) {
            handleScheduleItem(selectedQueueItem);
          }
        }}
        onResetSelection={resetModalSelection}
        isScheduling={isScheduling}
        schedulingMode={schedulingMode}
        onSchedulingModeChange={setSchedulingMode}
      />
    </>
  );
}
