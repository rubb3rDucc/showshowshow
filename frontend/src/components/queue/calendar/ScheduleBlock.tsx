import { Box, Group, Text, Button, Stack } from '@mantine/core';
import { IconX, IconGripVertical, IconPlayerPlay, IconArrowRight } from '@tabler/icons-react';
import type { ScheduleItemWithType } from './types';
import { getItemPosition } from './utils';

interface ScheduleBlockProps {
  item: ScheduleItemWithType;
  episodeTitle?: string | null;
  onDelete: (id: string) => void;
}

export function ScheduleBlock({ item, episodeTitle, onDelete }: ScheduleBlockProps) {
  const position = getItemPosition(item);
  const isShow = item.season !== null && item.episode !== null;
  
  // Build display title with episode title if available
  let displayTitle: string;
  if (isShow) {
    const seasonEpisode = `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`;
    if (episodeTitle) {
      displayTitle = `${item.title} - ${seasonEpisode} - ${episodeTitle}`;
    } else {
      displayTitle = `${item.title} - ${seasonEpisode}`;
    }
  } else {
    displayTitle = item.title;
  }

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
  
  const timeRange = `[${startTimeStr} - ${endTimeStr}]`;
  const durationStr = `[${item.duration || 0}min]`;

  return (
    <Box
      style={{
        position: 'absolute',
        top: position.top,
        left: '1px',
        right: '8px',
        height: position.height,
        marginBottom: '8px',
        backgroundColor: '#1A1B1E',
        borderRadius: '8px',
        padding: position.duration <= 15 ? '8px 12px' : '12px 14px',
        cursor: 'default',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pointerEvents: 'auto',
        minHeight: position.duration <= 15 ? '40px' : '60px',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('[data-block-content]')) {
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('button') && !target.closest('[data-block-content]')) {
          return;
        }
        e.stopPropagation();
      }}
    >
      {position.duration <= 15 ? (
        <Group 
          justify="space-between" 
          wrap="nowrap" 
          gap="xs"
          data-block-content
          style={{ width: '100%' }}
        >
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <IconGripVertical 
              size={14} 
              style={{ color: '#C1C2C5', flexShrink: 0 }} 
              data-block-content
            />
            <Text
              size="xs"
              fw={500}
              c="#E9ECEF"
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              data-block-content
            >
              {displayTitle}
            </Text>
            <Text size="xs" c="#ADB5BD" style={{ whiteSpace: 'nowrap' }} data-block-content>
              {timeRange} {durationStr}
            </Text>
          </Group>
          <Button
            size="xs"
            variant="subtle"
            color="red"
            style={{
              padding: '2px 4px',
              minWidth: 'auto',
              height: '18px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <IconX size={12} />
          </Button>
        </Group>
      ) : (
        <Stack gap={4} data-block-content style={{ width: '100%' }}>
          <Group 
            justify="space-between" 
            wrap="nowrap" 
            gap="xs"
            data-block-content
          >
            <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              {/* <IconGripVertical 
                size={14} 
                style={{ color: '#C1C2C5', flexShrink: 0 }} 
                data-block-content
              /> */}

              <IconArrowRight
                size={14} 
                style={{ color: '#C1C2C5', flexShrink: 0 }} 
                data-block-content
              
              />

              <Text
                size="sm"
                fw={500}
                c="#E9ECEF"
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                data-block-content
              >
                {displayTitle}
              </Text>
            </Group>
            <Button
              size="xs"
              variant="filled"
              color="red"
              style={{
                padding: '4px 4px',
                minWidth: 'auto',
                height: '18px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <IconX size={12} />
            </Button>
          </Group>
          <Text size="xs" c="#ADB5BD" data-block-content>
            {timeRange} {durationStr}
          </Text>
        </Stack>
      )}
    </Box>
  );
}

