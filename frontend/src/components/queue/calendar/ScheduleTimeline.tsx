import { Card, Group, Text, Badge, ScrollArea, Box } from '@mantine/core';
import { TimeLabels } from './TimeLabels';
import { TimelineGrid } from './TimelineGrid';
import { ScheduleBlock } from './ScheduleBlock';
import type { ScheduleItemWithType, PendingScheduleItem, HoveredTime } from './types';
import type { ScheduleItem } from '../../../types/api';
import { toDate } from './utils';

interface ScheduleTimelineProps {
  selectedDate: Date | null;
  pendingItemsCount: number;
  isEmpty: boolean;
  savedItems: ScheduleItem[];
  pendingItems: PendingScheduleItem[];
  hoveredTime: HoveredTime | null;
  episodeTitleMap: Map<string, string>;
  onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTimelineMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onTimelineMouseLeave: () => void;
  onDeleteItem: (id: string, type: 'saved' | 'pending') => void;
}

export function ScheduleTimeline({
  selectedDate,
  pendingItemsCount,
  isEmpty,
  savedItems,
  pendingItems,
  hoveredTime,
  episodeTitleMap,
  onTimelineClick,
  onTimelineMouseMove,
  onTimelineMouseLeave,
  onDeleteItem,
}: ScheduleTimelineProps) {
  const allItems: ScheduleItemWithType[] = [
    ...savedItems.map(item => ({ ...item, type: 'saved' as const })),
    ...pendingItems.map(item => ({ ...item, type: 'pending' as const })),
  ];

  return (
    <Card withBorder p="md">
      <Group justify="space-between" mb="md">
        <Text fw={600}>
          Timeline - {toDate(selectedDate)?.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }) || 'Select a date'}
        </Text>
        {pendingItemsCount > 0 && (
          <Badge color="yellow" variant="light">
            {pendingItemsCount} pending
          </Badge>
        )}
      </Group>

      <ScrollArea h={600}>
        <Box
          style={{
            position: 'relative',
            minHeight: '2880px',
            paddingTop: '12px',
            border: '1px solid #e0e0e0',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
            cursor: isEmpty ? 'not-allowed' : 'pointer',
          }}
          onClick={onTimelineClick}
          onMouseMove={onTimelineMouseMove}
          onMouseLeave={onTimelineMouseLeave}
        >
          <TimeLabels />
          <TimelineGrid />

          {/* Scheduled items as blocks */}
          <Box
            style={{
              position: 'absolute',
              left: '80px',
              top: '12px',
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {allItems.map((item) => {
              // Get episode title if available
              const episodeTitle = item.season !== null && item.episode !== null
                ? episodeTitleMap.get(`${item.content_id}-${item.season}-${item.episode}`)
                : null;
              
              return (
                <ScheduleBlock
                  key={item.id}
                  item={item}
                  episodeTitle={episodeTitle}
                  onDelete={(id) => onDeleteItem(id, item.type)}
                />
              );
            })}
          </Box>

          {/* Hover indicator line and duration info */}
          {hoveredTime && !isEmpty && (
            <>
              <Box
                style={{
                  position: 'absolute',
                  top: `${12 + ((hoveredTime.hour * 60 + hoveredTime.minute) * 2)}px`,
                  left: '80px',
                  right: 0,
                  height: '2px',
                  backgroundColor: '#4A90E2',
                  pointerEvents: 'none',
                  zIndex: 5,
                  boxShadow: '0 0 4px rgba(74, 144, 226, 0.5)',
                }}
              />
              <Box
                style={{
                  position: 'fixed',
                  top: `${hoveredTime.mouseY}px`,
                  left: `${hoveredTime.mouseX + 15}px`,
                  backgroundColor: 'rgba(0,0,0,0.9)',
                  color: 'white',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  pointerEvents: 'none',
                  zIndex: 1000,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  minWidth: '180px',
                  transform: 'translateY(-50%)',
                }}
              >
                <Text size="sm" fw={600} mb={4}>
                  {hoveredTime.time.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })}
                </Text>
                <Text size="xs" c="dimmed">
                  {hoveredTime.availableDuration >= 60
                    ? `${Math.floor(hoveredTime.availableDuration / 60)}h ${hoveredTime.availableDuration % 60}m available`
                    : `${hoveredTime.availableDuration}m available`}
                </Text>
                {/* <Text size="xs" c="blue" mt={4} style={{ fontStyle: 'italic' }}>
                  Click to schedule
                </Text> */}
              </Box>
            </>
          )}

          {/* Click hint */}
          {!isEmpty && !hoveredTime && (
            <Box
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            >
              <Text size="xs">Hover to see available time • Click to schedule</Text>
            </Box>
          )}
        </Box>
      </ScrollArea>
    </Card>
  );
}

