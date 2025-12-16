import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Image,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  Collapse,
  ActionIcon,
  Box,
  ScrollArea,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconGripVertical,
  IconTrash,
  IconChevronDown,
  IconChevronUp,
  IconMovie,
  IconDeviceTv,
} from '@tabler/icons-react';
import { getEpisodes } from '../../api/content';
import type { QueueItem, Episode } from '../../types/api';

interface QueueItemCardProps {
  item: QueueItem;
  onRemove: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
}

export function QueueItemCard({ item, onRemove, isDragging, dragHandleProps }: QueueItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isShow = item.content_type === 'show';

  // Fetch episodes only when expanded and it's a show
  const { data: episodes, isLoading: episodesLoading } = useQuery({
    queryKey: ['episodes', item.tmdb_id],
    queryFn: () => getEpisodes(item.tmdb_id!),
    enabled: expanded && isShow && !!item.tmdb_id,
  });

  const episodeCount = episodes?.length || 0;
  const groupedEpisodes = episodes?.reduce((acc, ep) => {
    if (!acc[ep.season]) {
      acc[ep.season] = [];
    }
    acc[ep.season].push(ep);
    return acc;
  }, {} as Record<number, typeof episodes>);

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <Group wrap="nowrap" align="flex-start">
        {/* Drag Handle */}
        <Box style={{ cursor: 'grab' }} {...dragHandleProps}>
          <IconGripVertical size={20} color="gray" />
        </Box>

        {/* Poster */}
        <Box style={{ flexShrink: 0 }}>
          {item.poster_url ? (
            <Image
              src={item.poster_url}
              width={60}
              height={90}
              radius="sm"
              alt={item.title}
              fit="cover"
            />
          ) : (
            <Box
              style={{
                width: 60,
                height: 90,
                backgroundColor: '#f0f0f0',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isShow ? <IconDeviceTv size={24} /> : <IconMovie size={24} />}
            </Box>
          )}
        </Box>

        {/* Content Info */}
        <Stack gap="xs" style={{ flex: 1 }}>
          <Text fw={600} size="lg">
            {item.title}
          </Text>

          <Group gap="xs">
            <Badge variant="light" size="sm">
              {isShow ? 'TV Show' : 'Movie'}
            </Badge>
            {isShow && episodeCount > 0 && (
              <Badge variant="light" color="blue" size="sm">
                {episodeCount} episodes
              </Badge>
            )}
          </Group>

          <Group gap="xs">
            {isShow && (
              <Button
                variant="subtle"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                rightSection={
                  expanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />
                }
                style={{ pointerEvents: 'auto' }}
              >
                {expanded ? 'Hide Episodes' : 'View Episodes'}
              </Button>
            )}
          </Group>
        </Stack>

        {/* Actions */}
        <ActionIcon
          color="red"
          variant="subtle"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          title="Remove from queue"
          style={{ pointerEvents: 'auto' }}
        >
          <IconTrash size={18} />
        </ActionIcon>
      </Group>

      {/* Episodes Accordion */}
      {isShow && (
        <Collapse in={expanded} mt="md">
          {episodesLoading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : episodes && episodes.length > 0 ? (
            <ScrollArea h={300}>
              <Stack gap="md">
                {groupedEpisodes &&
                  Object.keys(groupedEpisodes)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((seasonNum) => {
                      const seasonEpisodes = groupedEpisodes[Number(seasonNum)];
                      return (
                        <Box key={seasonNum}>
                          <Text fw={600} size="sm" mb="xs">
                            Season {seasonNum} ({seasonEpisodes.length} episodes)
                          </Text>
                          <Stack gap="xs">
                            {seasonEpisodes.map((ep) => (
                              <Card key={ep.id} padding="xs" withBorder>
                                <Group justify="space-between" wrap="nowrap">
                                  <Text size="sm" fw={500}>
                                    {ep.episode_number}. {ep.title}
                                  </Text>
                                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                                    {ep.duration} min
                                  </Text>
                                </Group>
                                {ep.overview && (
                                  <Text size="xs" c="dimmed" lineClamp={2} mt={4}>
                                    {ep.overview}
                                  </Text>
                                )}
                              </Card>
                            ))}
                          </Stack>
                        </Box>
                      );
                    })}
              </Stack>
            </ScrollArea>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No episodes available
            </Text>
          )}
        </Collapse>
      )}
    </Card>
  );
}
