import { Box, Group, Text, Button } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
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
  const timeStr = startTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Box
      style={{
        position: 'absolute',
        top: position.top,
        left: '8px',
        right: '8px',
        height: position.height,
        marginBottom: '8px',
        paddingBottom: '4px',
        backgroundColor: item.type === 'saved' ? '#4A90E2' : '#FFD700',
        border: `1px solid ${item.type === 'saved' ? '#2563EB' : '#F59E0B'}`,
        borderRadius: '2px',
        padding: position.duration <= 15 ? '8px 12px' : '12px 14px',
        cursor: 'default',
        zIndex: 2,
        // boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        // margin: '6px 0px 7px 5px',
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
            <Text
              size="xs"
              fw={600}
              c="white"
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
            <Text size="xs" c="white" opacity={0.9} style={{ whiteSpace: 'nowrap' }} data-block-content>
               {timeStr} - {item.duration || '?'} min
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
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
        <>
          <Group 
            justify="space-between" 
            wrap="nowrap" 
            gap="xs"
            data-block-content
          >
            {/* media title */}
            <Text
              size="xs"
              fw={600}
              c="white"
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
            {/* delete button */}
            <Button
              size="xs"
              variant="subtle"
              color="red"
              style={{
                padding: '4px 4px',
                minWidth: 'auto',
                height: '18px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <IconX size={12} />
            </Button>
          </Group>
          <Text size="xs" c="white" opacity={0.9} data-block-content>
            {timeStr} - {item.duration || '?'} min
          </Text>
        </>
      )}
    </Box>
  );
}

