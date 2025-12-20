import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Collapse, Loader, Text } from '@mantine/core';
import { Check, ChevronDown, ChevronUp, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { LibraryItemUI } from '../../types/library.types';
import { getEpisodesByContentId } from '../../api/content';
import { getEpisodeStatuses, markEpisode, markSeason, markAllEpisodes } from '../../api/library';

interface EpisodeTrackerProps {
  libraryItem: LibraryItemUI;
  onEpisodeUpdate: (season: number, episode: number, watched: boolean) => void;
}

export function EpisodeTracker({
  libraryItem,
  onEpisodeUpdate,
}: EpisodeTrackerProps) {
  const queryClient = useQueryClient();
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [expandedEpisode, setExpandedEpisode] = useState<string | null>(null);
  const [isEpisodeListExpanded, setIsEpisodeListExpanded] = useState(false);

  const seasons = libraryItem.content.numberOfSeasons || 1;

  // Fetch episodes for selected season
  const { data: episodes = [], isLoading: isLoadingEpisodes } = useQuery({
    queryKey: ['episodes', libraryItem.contentId, selectedSeason],
    queryFn: () => getEpisodesByContentId(libraryItem.contentId, selectedSeason),
    enabled: libraryItem.content.contentType === 'show',
  });

  // Fetch episode statuses
  const { data: episodeStatuses = [] } = useQuery({
    queryKey: ['episode-statuses', libraryItem.contentId],
    queryFn: () => getEpisodeStatuses(libraryItem.contentId),
    enabled: libraryItem.content.contentType === 'show',
  });

  // Create a map of episode statuses for quick lookup
  const episodeStatusMap = new Map<string, 'watched' | 'unwatched' | 'skipped'>();
  episodeStatuses.forEach((status) => {
    const key = `s${status.season}e${status.episode}`;
    episodeStatusMap.set(key, status.status);
  });

  // Mark episode mutation
  const markEpisodeMutation = useMutation({
    mutationFn: ({ season, episode, watched }: { season: number; episode: number; watched: boolean }) => {
      return markEpisode(libraryItem.contentId, {
        season,
        episode,
        status: watched ? 'watched' : 'unwatched',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['episode-statuses', libraryItem.contentId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      onEpisodeUpdate(selectedSeason, episodes.length, true);
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to update episode status');
    },
  });

  // Mark season mutation
  const markSeasonMutation = useMutation({
    mutationFn: (watched: boolean) => {
      return markSeason(libraryItem.contentId, {
        season: selectedSeason,
        status: watched ? 'watched' : 'unwatched',
      });
    },
    onSuccess: (_, watched) => {
      queryClient.invalidateQueries({ queryKey: ['episode-statuses', libraryItem.contentId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success(`Season ${selectedSeason} marked as ${watched ? 'watched' : 'unwatched'}`);
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to update season');
    },
  });

  // Mark all episodes mutation
  const markAllMutation = useMutation({
    mutationFn: (watched: boolean) => {
      return markAllEpisodes(libraryItem.contentId, {
        status: watched ? 'watched' : 'unwatched',
      });
    },
    onSuccess: (_, watched) => {
      queryClient.invalidateQueries({ queryKey: ['episode-statuses', libraryItem.contentId] });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success(`All episodes marked as ${watched ? 'watched' : 'unwatched'}`);
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to update episodes');
    },
  });

  const getEpisodeKey = (season: number, episode: number) =>
    `s${season}e${episode}`;

  const isEpisodeWatched = (season: number, episode: number): boolean => {
    const key = getEpisodeKey(season, episode);
    const status = episodeStatusMap.get(key);
    return status === 'watched';
  };

  const handleMarkAllWatched = () => {
    markAllMutation.mutate(true);
  };

  const handleMarkSeasonWatched = () => {
    markSeasonMutation.mutate(true);
  };

  const handleMarkSeasonUnwatched = () => {
    markSeasonMutation.mutate(false);
  };

  const handleEpisodeToggle = (season: number, episode: number) => {
    const watched = isEpisodeWatched(season, episode);
    markEpisodeMutation.mutate({ season, episode, watched: !watched });
  };

  // Filter episodes for selected season
  const seasonEpisodes = episodes.filter((ep) => ep.season === selectedSeason);

  const watchedCount = seasonEpisodes.filter((ep) =>
    isEpisodeWatched(selectedSeason, ep.episode_number)
  ).length;
  const totalCount = seasonEpisodes.length;
  const progressPercentage = totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;

  if (isLoadingEpisodes) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader size="sm" />
      </div>
    );
  }

  if (seasonEpisodes.length === 0) {
    return (
      <div className="bg-white border-2 border-gray-900 p-4">
        <Text size="sm" c="dimmed">
          No episodes found for Season {selectedSeason}
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Complete Button */}
      <Button
        fullWidth
        size="sm"
        className="bg-green-500 text-white border-2 border-green-500 font-black uppercase tracking-wider"
        radius="xs"
        leftSection={<CheckCheck size={16} strokeWidth={3} />}
        onClick={handleMarkAllWatched}
        loading={markAllMutation.isPending}
      >
        MARK ENTIRE SHOW AS WATCHED
      </Button>

      {/* Season Selector & Actions Row */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {Array.from(
            {
              length: seasons,
            },
            (_, i) => i + 1,
          ).map((season) => (
            <button
              key={season}
              onClick={() => setSelectedSeason(season)}
              className={`
                px-4 py-2 border-2 border-gray-900 font-mono font-black uppercase text-xs
                ${selectedSeason === season ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}
              `}
            >
              {`S${season}`}
            </button>
          ))}
        </div>

        {/* Season Bulk Actions */}
        <div className="flex gap-2">
          <Button
            size="xs"
            className="flex-1 bg-blue-500 text-white border-2 border-blue-500 font-black uppercase tracking-wider text-[10px]"
            radius="xs"
            onClick={handleMarkSeasonWatched}
            loading={markSeasonMutation.isPending}
          >
            {`MARK S${selectedSeason} WATCHED`}
          </Button>
          <Button
            size="xs"
            className="flex-1 bg-gray-500 text-white border-2 border-gray-500 font-black uppercase tracking-wider text-[10px]"
            radius="xs"
            onClick={handleMarkSeasonUnwatched}
            loading={markSeasonMutation.isPending}
          >
            MARK UNWATCHED
          </Button>
        </div>
      </div>

      {/* Progress Summary */}
      <div className="bg-blue-200 border-2 border-gray-900 p-3 flex justify-between items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-wider opacity-70">
            SEASON {selectedSeason}
          </div>
          <div className="text-lg font-black">
            {watchedCount}/{totalCount} EPISODES
          </div>
        </div>
        <div className="text-2xl font-black">{progressPercentage}%</div>
      </div>

      {/* Collapsible Episode List */}
      <div className="bg-white border-2 border-gray-900">
        {/* Episode List Header */}
        <button
          onClick={() => setIsEpisodeListExpanded(!isEpisodeListExpanded)}
          className="w-full flex items-center justify-between p-3 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
              EP
            </div>
            <span className="text-xs font-black uppercase tracking-wider">
              Episode List ({watchedCount}/{totalCount})
            </span>
          </div>
          {isEpisodeListExpanded ? (
            <ChevronUp size={16} strokeWidth={3} />
          ) : (
            <ChevronDown size={16} strokeWidth={3} />
          )}
        </button>

        {/* Collapsible Episode Grid */}
        <Collapse in={isEpisodeListExpanded}>
          <div className="p-4 space-y-2">
            {seasonEpisodes.map((ep) => {
              const episodeKey = getEpisodeKey(selectedSeason, ep.episode_number);
              const isExpanded = expandedEpisode === episodeKey;
              const watched = isEpisodeWatched(selectedSeason, ep.episode_number);
              return (
                <div key={ep.episode_number} className="border-2 border-gray-900">
                  {/* Episode Header - Clickable */}
                  <button
                    onClick={() =>
                      setExpandedEpisode(isExpanded ? null : episodeKey)
                    }
                    className="w-full flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    {/* Watch Status Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEpisodeToggle(selectedSeason, ep.episode_number);
                      }}
                      className={`
                        w-8 h-8 border-2 border-gray-900 font-mono font-black
                        flex items-center justify-center text-xs flex-shrink-0
                        ${watched ? 'bg-green-500 text-white' : 'bg-white text-gray-900'}
                        hover:opacity-80 transition-opacity
                      `}
                      disabled={markEpisodeMutation.isPending}
                    >
                      {watched ? (
                        <Check size={16} strokeWidth={3} />
                      ) : (
                        ep.episode_number
                      )}
                    </button>

                    {/* Episode Title */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-xs font-black uppercase truncate">
                        {ep.title || `Episode ${ep.episode_number}`}
                      </div>
                    </div>

                    {/* Dropdown Indicator */}
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp size={14} strokeWidth={3} />
                      ) : (
                        <ChevronDown size={14} strokeWidth={3} />
                      )}
                    </div>
                  </button>

                  {/* Episode Description Section */}
                  <Collapse in={isExpanded}>
                    <div className="p-3 bg-white border-t-2 border-gray-900">
                      <div className="text-[10px] font-black uppercase tracking-wider opacity-70 mb-1">
                        DESCRIPTION
                      </div>
                      <p className="text-xs leading-relaxed opacity-80">
                        {ep.overview || 'No description available.'}
                      </p>
                      {ep.air_date && (
                        <div className="text-[10px] text-gray-500 mt-2">
                          Air Date: {new Date(ep.air_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </Collapse>
                </div>
              );
            })}
          </div>
        </Collapse>
      </div>
    </div>
  );
}
