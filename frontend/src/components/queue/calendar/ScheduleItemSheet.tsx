import { Drawer, Stack, Text, Button, Divider } from '@mantine/core';
import { Trash2 } from 'lucide-react';
import type { ScheduleItemWithType } from './types';
import { QuietDesign } from '../../../styles/quiet-design-system';

interface ScheduleItemSheetProps {
  opened: boolean;
  onClose: () => void;
  item: ScheduleItemWithType | null;
  onDelete: () => void;
}

export function ScheduleItemSheet({ opened, onClose, item, onDelete }: ScheduleItemSheetProps) {
  if (!item) return null;

  const isShow = item.season !== null && item.episode !== null;
  const startTime = new Date(item.scheduled_time);
  const endTime = new Date(startTime.getTime() + (item.duration || 0) * 60 * 1000);

  const startTimeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const endTimeStr = endTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const timeRange = `${startTimeStr} - ${endTimeStr}`;
  const durationStr = `${item.duration || 0} min`;

  let displayTitle = item.title;
  if (isShow) {
    const seasonEpisode = `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`;
    displayTitle = `${item.title} - ${seasonEpisode}`;
  }

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="50vh"
      withCloseButton={false}
      styles={{
        content: {
          borderTopLeftRadius: QuietDesign.borders.radius.card,
          borderTopRightRadius: QuietDesign.borders.radius.card,
          maxHeight: '50vh',
        },
      }}
    >
      <Stack p="md" gap="md">
        <Text fw={600} size="lg" style={{ color: QuietDesign.colors.gray[900] }}>
          {displayTitle}
        </Text>
        <Text size="sm" style={{ color: QuietDesign.colors.gray[500] }}>
          {timeRange} • {durationStr}
        </Text>
        <Divider />
        <Button
          variant="subtle"
          color="red"
          leftSection={<Trash2 size={18} />}
          onClick={() => {
            onDelete();
            onClose();
          }}
          fullWidth
          styles={{
            root: {
              height: '44px',
            },
          }}
        >
          Remove from schedule
        </Button>
      </Stack>
    </Drawer>
  );
}
