import { Box, Group, Text, Button, Stack } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import { useState } from 'react';
import type { ScheduleItemWithType } from './types';
import { getItemPosition } from './utils';
import { QuietDesign } from '../../../styles/quiet-design-system';

interface ScheduleBlockProps {
  item: ScheduleItemWithType;
  episodeTitle?: string | null;
  onDelete: (id: string) => void;
  watched?: boolean;
}

export function ScheduleBlock({ item, episodeTitle, onDelete, watched = false }: ScheduleBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const position = getItemPosition(item);
  const isShow = item.season !== null && item.episode !== null;

  // Build display title without episode name (only show/movie title + episode number)
  let displayTitle: string;
  if (isShow) {
    const seasonEpisode = `S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')}`;
    displayTitle = `${item.title} - ${seasonEpisode}`;
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

  const timeRange = `${startTimeStr} - ${endTimeStr}`;
  const durationStr = `${item.duration || 0} min`;

  return (
    <Box
      style={{
        position: 'absolute',
        top: position.top,
        left: '1px',
        right: '8px',
        height: position.height,
        marginBottom: '8px',
        backgroundColor: QuietDesign.colors.white,
        border: `2px solid ${QuietDesign.colors.gray[300]}`,
        borderRadius: QuietDesign.borders.radius.card,
        padding: position.duration <= 15 ? '8px 12px' : '12px 14px',
        cursor: 'default',
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        pointerEvents: 'auto',
        minHeight: position.duration <= 15 ? '40px' : '60px',
        boxSizing: 'border-box',
        opacity: watched ? QuietDesign.colors.watched.opacity : 1,
        filter: watched ? QuietDesign.colors.watched.filter : 'none',
        transition: `opacity ${QuietDesign.transitions.normal}, filter ${QuietDesign.transitions.normal}`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        // Compact view for short items - essential info only
        <Group
          justify="space-between"
          wrap="nowrap"
          gap="xs"
          data-block-content
          style={{ width: '100%' }}
        >
          <Text
            size="xs"
            fw={500}
            style={{
              color: QuietDesign.colors.gray[900],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
            data-block-content
          >
            {displayTitle}
          </Text>
          <Text
            size="xs"
            style={{
              color: QuietDesign.colors.gray[500],
              whiteSpace: 'nowrap',
            }}
            data-block-content
          >
            {startTimeStr}
          </Text>
          {isHovered && (
            <Button
              size="xs"
              variant="subtle"
              style={{
                padding: '2px 4px',
                minWidth: 'auto',
                height: '18px',
                color: QuietDesign.colors.gray[400],
              }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              <IconX size={12} />
            </Button>
          )}
        </Group>
      ) : (
        // Expanded view for longer items
        <Stack gap={4} data-block-content style={{ width: '100%' }}>
          <Group
            justify="space-between"
            wrap="nowrap"
            gap="xs"
            data-block-content
          >
            <Text
              size="sm"
              fw={500}
              style={{
                color: QuietDesign.colors.gray[900],
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
              data-block-content
            >
              {displayTitle}
            </Text>
            {isHovered && (
              <Button
                size="xs"
                variant="subtle"
                style={{
                  padding: '4px 4px',
                  minWidth: 'auto',
                  height: '18px',
                  color: QuietDesign.colors.gray[400],
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                <IconX size={12} />
              </Button>
            )}
          </Group>
          <Text
            size="xs"
            style={{ color: QuietDesign.colors.gray[500] }}
            data-block-content
          >
            {timeRange} • {durationStr}
          </Text>
        </Stack>
      )}
    </Box>
  );
}
