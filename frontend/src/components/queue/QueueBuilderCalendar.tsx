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
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconChevronDown, IconChevronUp, IconAlertCircle } from '@tabler/icons-react';
import { PendingItemsSummary } from './calendar/PendingItemsSummary';
import { ScheduleTimeline } from './calendar/ScheduleTimeline';
import { ScheduleModal } from './calendar/ScheduleModal';
import { useScheduleCalendar } from './calendar/hooks/useScheduleCalendar';
import type { QueueBuilderCalendarProps } from './calendar/types';

export function QueueBuilderCalendar({ expanded, onToggle }: QueueBuilderCalendarProps) {
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
                      // Handle date picker value - ensure we get the correct date
                      if (value) {
                        // Create date at midnight in local timezone to avoid timezone issues
                        const date = value instanceof Date ? value : new Date(value);
                        const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

                {/* Queue Items Panel */}
                {/* {!isEmpty && queue && (
                  <QueueItemsList queue={queue} onItemClick={onQueueItemClick} />
                )} */}

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
        </Collapse>
      </Card>

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
        onAddToPending={addToPending}
        onScheduleNow={() => selectedQueueItem && handleScheduleItem(selectedQueueItem)}
        onResetSelection={resetModalSelection}
        isScheduling={isScheduling}
        schedulingMode={schedulingMode}
        onSchedulingModeChange={setSchedulingMode}
      />
    </>
  );
}
