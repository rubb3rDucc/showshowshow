import { Modal, Stack, Text, Box, Group, Button, Select, Alert, ScrollArea, Accordion, Checkbox, Center, Loader } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { QueueItem, Episode } from '../../../types/api';
import type { TimeSlot } from './types';
import { toDate } from './utils';

interface ScheduleModalProps {
  opened: boolean;
  onClose: () => void;
  selectedTimeSlot: TimeSlot | null;
  selectedQueueItem: QueueItem | null;
  selectedDate: Date | null;
  queue: QueueItem[] | undefined;
  episodes: Episode[] | undefined;
  episodesBySeason: Record<number, Episode[]>;
  episodesLoading: boolean;
  selectedEpisodes: Map<string, { season: number; episode: number }>;
  onEpisodeToggle: (season: number, episode: number, checked: boolean) => void;
  isEpisodeSelected: (season: number, episode: number) => boolean;
  onQueueItemSelect: (item: QueueItem) => void;
  onAddToPending: () => void;
  onScheduleNow: () => void;
  onResetSelection: () => void;
  isScheduling: boolean;
}

export function ScheduleModal({
  opened,
  onClose,
  selectedTimeSlot,
  selectedQueueItem,
  selectedDate,
  queue,
  episodes,
  episodesBySeason,
  episodesLoading,
  selectedEpisodes,
  onEpisodeToggle,
  isEpisodeSelected,
  onQueueItemSelect,
  onAddToPending,
  onScheduleNow,
  onResetSelection,
  isScheduling,
}: ScheduleModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
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
          marginTop: '20px',
          marginBottom: '20px',
        },
        body: {
          maxHeight: 'calc(90vh - 100px)',
          overflow: 'auto',
        },
      }}
    >
      <Stack gap="md">
        {selectedTimeSlot && selectedQueueItem ? (
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
                                      onEpisodeToggle(
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
              <Button variant="subtle" onClick={onResetSelection}>
                Cancel
              </Button>
              <Button
                variant="light"
                onClick={onAddToPending}
                disabled={
                  !selectedQueueItem ||
                  (selectedQueueItem.content_type === 'show' && selectedEpisodes.size === 0)
                }
              >
                Add to Pending
              </Button>
              <Button
                onClick={onScheduleNow}
                disabled={
                  !selectedQueueItem ||
                  (selectedQueueItem.content_type === 'show' && selectedEpisodes.size === 0)
                }
                loading={isScheduling}
              >
                Schedule Now
              </Button>
            </Group>
          </>
        ) : selectedTimeSlot ? (
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
                    onQueueItemSelect(item);
                  }
                }}
              />
            ) : (
              <Alert icon={<IconAlertCircle size={16} />} title="Empty Queue">
                No items in queue to schedule.
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="subtle" onClick={onResetSelection}>
                Cancel
              </Button>
            </Group>
          </>
        ) : (
          <Alert icon={<IconAlertCircle size={16} />} title="No Time Slot Selected">
            Please select a time slot first.
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

