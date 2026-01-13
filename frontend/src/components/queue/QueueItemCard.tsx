import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Group,
  Text,
  ActionIcon,
  Collapse,
  Button,
  Stack,
  Box,
  Loader,
  Center,
  Select,
} from '@mantine/core';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import { getEpisodes, getEpisodesByContentId, getContentByTmdbId } from '../../api/content';
import type { QueueItem } from '../../types/api';

interface QueueItemCardProps {
  item: QueueItem;
  onRemove: (id: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  openEpisodeDescriptionId?: string | null;
  onToggleEpisodeDescription?: (id: string) => void;
}

export function QueueItemCard({
  item,
  onRemove,
  isDragging,
  openEpisodeDescriptionId,
  onToggleEpisodeDescription,
}: QueueItemCardProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showMovieDescription, setShowMovieDescription] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const isShow = item.content_type === 'show';
  const isMovie = item.content_type === 'movie';

  // Build season list from content metadata - no API call needed
  const totalSeasons = item.number_of_seasons || item.content?.number_of_seasons || 0;
  const seasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);

  // Fetch episodes only for the selected season (on-demand)
  // Backend may update content metadata, so invalidate queue cache on success
  const { data: episodes, isLoading: episodesLoading, isSuccess: episodesFetched } = useQuery({
    queryKey: ['episodes', item.content_id || item.tmdb_id, selectedSeason],
    queryFn: () => {
      if (item.content_id && selectedSeason) {
        return getEpisodesByContentId(item.content_id, selectedSeason);
      } else if (item.tmdb_id && selectedSeason) {
        return getEpisodes(item.tmdb_id, selectedSeason);
      }
      throw new Error('No content ID or season available');
    },
    enabled: expanded && isShow && !!selectedSeason && !!(item.content_id || item.tmdb_id),
    staleTime: 1000 * 60 * 30, // 30 minutes - episode data rarely changes
  });

  // Invalidate queue cache when episodes are fetched (backend may have updated metadata)
  useEffect(() => {
    if (episodesFetched) {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    }
  }, [episodesFetched, queryClient]);

  // Fetch movie content details only when description is expanded
  // Movie content also rarely changes, use longer staleTime
  const { data: movieContent, isLoading: movieContentLoading } = useQuery({
    queryKey: ['content', item.tmdb_id, 'movie'],
    queryFn: () => getContentByTmdbId(item.tmdb_id!, 'movie'),
    enabled: showMovieDescription && isMovie && !!item.tmdb_id,
    staleTime: 1000 * 60 * 30, // 30 minutes - movie details rarely change
  });

  const handleEpisodeClick = (episodeId: string) => {
    if (onToggleEpisodeDescription) {
      onToggleEpisodeDescription(episodeId);
    }
  };

  // Episodes for the selected season (fetched on-demand)
  const selectedSeasonEpisodes = episodes || [];

  // Calculate total duration estimate from metadata
  const totalEpisodes = item.number_of_episodes || item.content?.number_of_episodes || 0;
  const defaultDuration = item.content?.default_duration || 30;
  const totalDuration = isShow ? totalEpisodes * defaultDuration : (item.content?.default_duration || 0);
  const hours = Math.floor(totalDuration / 60);
  const minutes = totalDuration % 60;

  return (
    <Box
      style={{
        backgroundColor: 'rgb(var(--color-bg-surface))',
        borderBottom: '1px solid #e5e7eb',
        paddingTop: '16px',
        paddingBottom: '16px',
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      <Stack gap="xs">
        <Group wrap="nowrap" align="flex-start" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
          {/* Poster */}
          <Box
            style={{
              position: 'relative',
              width: '40px',
              height: '60px',
              flexShrink: 0,
              borderRadius: '4px',
              overflow: 'hidden',
              backgroundColor: '#f3f4f6',
            }}
          >
            {item.poster_url ? (
              <img
                src={item.poster_url}
                alt={item.title || ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Box
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f3f4f6',
                }}
              >
                <Text size="xs" c="dimmed">
                  {isShow ? 'SERIES' : 'Movie'}
                </Text>
              </Box>
            )}
          </Box>

          {/* Content Info */}
          <Box style={{ flex: 1, minWidth: 0 }}>
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <Box style={{ minWidth: 0 }}>
                <Text
                  fw={400}
                  size="base"
                  style={{
                    lineHeight: 1.25,
                    marginBottom: '4px',
                    color: '#111827',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.title || 'Unknown'}
                </Text>
                <Group gap="xs" wrap="wrap">
                  <Text size="xs" c="dimmed" fw={300}>
                    {isMovie ? 'Movie' : 'TV Show'}
                  </Text>
                  {isShow && episodes && episodes.length > 0 && (
                    <>
                      <Text size="xs" c="dimmed">
                        •
                      </Text>
                      <Text size="xs" c="dimmed" fw={300}>
                        {episodes.length} episodes
                      </Text>
                    </>
                  )}
                  {totalDuration > 0 && (
                    <>
                      <Text size="xs" c="dimmed">
                        •
                      </Text>
                      <Text size="xs" c="dimmed" fw={300}>
                        {hours > 0 ? `${hours}h ` : ''}{minutes}m
                      </Text>
                    </>
                  )}
                </Group>
              </Box>

              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                aria-label="Remove from queue"
                size="sm"
                style={{
                  pointerEvents: 'auto',
                }}
              >
                <X size={14} strokeWidth={1.5} />
              </ActionIcon>
            </Group>

            {/* TV Show Episodes Button */}
            {isShow && (
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                style={{
                  marginTop: '8px',
                  color: '#6b7280',
                  fontWeight: 300,
                  padding: '2px 8px',
                }}
                rightSection={
                  expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? 'Hide' : 'View'} Episodes
              </Button>
            )}

            {/* Movie Description Button */}
            {isMovie && !!item.tmdb_id && (
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                style={{
                  marginTop: '8px',
                  color: '#6b7280',
                  fontWeight: 300,
                  padding: '2px 8px',
                }}
                rightSection={
                  showMovieDescription ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMovieDescription(!showMovieDescription);
                }}
              >
                {showMovieDescription ? 'Hide' : 'View'} Description
              </Button>
            )}
          </Box>
        </Group>

        {/* Movie Description */}
        {isMovie && (
          <Collapse in={showMovieDescription}>
            <Box style={{ paddingLeft: '16px', paddingRight: '16px', paddingBottom: '8px', paddingTop: '4px' }}>
              {movieContentLoading ? (
                <Center py="md">
                  <Loader size="sm" />
                </Center>
              ) : (
                <Text size="xs" c="dimmed" style={{ fontWeight: 300, lineHeight: 1.6 }}>
                  {movieContent?.overview || item.content?.overview || 'No description available.'}
                </Text>
              )}
            </Box>
          </Collapse>
        )}

        {/* Episodes List */}
        {isShow && (
          <Collapse in={expanded}>
            <Box style={{ marginTop: '8px', paddingLeft: '16px', paddingRight: '16px' }}>
              {seasons.length > 0 ? (
                <Stack gap="sm">
                  {/* Season Selector */}
                  <Select
                    placeholder="Select a season"
                    value={selectedSeason?.toString() || null}
                    onChange={(value) => setSelectedSeason(value ? Number(value) : null)}
                    data={seasons.map((s) => ({
                      value: s.toString(),
                      label: `Season ${s}`,
                    }))}
                    styles={{
                      input: { fontSize: '14px', fontWeight: 400 },
                    }}
                  />

                  {/* Loading state for episodes */}
                  {selectedSeason && episodesLoading && (
                    <Center py="md">
                      <Loader size="sm" />
                    </Center>
                  )}

                  {selectedSeason && !episodesLoading && selectedSeasonEpisodes.length > 0 && (
                    <Text size="xs" c="dimmed" style={{ fontWeight: 300, marginTop: '-4px', paddingLeft: '2px' }}>
                      Click episodes to view details
                    </Text>
                  )}

                  {/* Episodes for selected season */}
                  {selectedSeason && !episodesLoading && selectedSeasonEpisodes.length > 0 && (
                    <Stack gap={0}>
                      {selectedSeasonEpisodes.map((ep) => {
                        const isEpisodeDescriptionOpen = openEpisodeDescriptionId === ep.id;
                        return (
                          <Box key={ep.id}>
                        <Box
                          component="button"
                          onClick={() => handleEpisodeClick(ep.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            paddingTop: '8px',
                            paddingBottom: '8px',
                            paddingLeft: '8px',
                            paddingRight: '8px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Group justify="space-between" wrap="nowrap">
                            <Text
                              size="sm"
                              style={{
                                flex: 1,
                                fontWeight: 300,
                                color: '#374151',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {ep.season}.{ep.episode_number} {ep.title}
                            </Text>
                            <Group gap="xs" style={{ flexShrink: 0 }}>
                              <Text size="xs" c="dimmed" style={{ fontWeight: 300 }}>
                                {ep.duration || 0}m
                              </Text>
                              <ChevronDown
                                size={12}
                                style={{
                                  color: '#9ca3af',
                                  transition: 'transform 0.2s',
                                  transform: isEpisodeDescriptionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                }}
                              />
                            </Group>
                          </Group>
                        </Box>

                        {/* Episode Description */}
                        <Collapse in={isEpisodeDescriptionOpen}>
                          <Box style={{ paddingLeft: '8px', paddingBottom: '12px', paddingTop: '4px' }}>
                            <Text
                              size="xs"
                              c="dimmed"
                              style={{ fontWeight: 300, lineHeight: 1.6 }}
                            >
                              {ep.overview || 'No description available.'}
                            </Text>
                          </Box>
                        </Collapse>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </Stack>
          ) : (
            <Text size="xs" c="dimmed" ta="center" py="sm">
              No episodes available
            </Text>
          )}
            </Box>
          </Collapse>
        )}
      </Stack>
    </Box>
  );
}
