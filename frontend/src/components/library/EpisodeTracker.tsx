import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Loader, Text, Tabs  } from '@mantine/core';
import { ListVideo, Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { LibraryItemUI } from '../../types/library.types';
import { getEpisodesByContentId } from '../../api/content';
import { getEpisodeStatuses, markEpisode, markSeason, markAllEpisodes } from '../../api/library';
import { EpisodeDetailModal } from './EpisodeDetailModal';

interface EpisodeTrackerProps {
  libraryItem: LibraryItemUI;
  onEpisodeUpdate?: (season: number, episode: number, watched: boolean) => void;
}

// Season Tabs Component
interface SeasonTabsProps {
  seasons: number;
  activeSeason: number;
  onSeasonChange: (season: number) => void;
}

function SeasonTabs({ seasons, activeSeason, onSeasonChange }: SeasonTabsProps) {
  return (
    <div className="pb-4">
      <Tabs
        value={activeSeason.toString()}
        onChange={(val) => onSeasonChange(parseInt(val || '1'))}
        variant="pills"
        classNames={{
          list: 'gap-2',
          tab: 'border border-gray-300 font-medium data-[active]:bg-gray-900 data-[active]:text-white data-[active]:border-gray-900 hover:bg-gray-100 transition-colors',
        }}
        styles={{
          tab: {
            borderRadius: 0,
          },
        }}
      >
        <Tabs.List>
          {Array.from({ length: seasons }, (_, i) => i + 1).map((season) => (
            <Tabs.Tab
              key={season}
              value={season.toString()}
            >
              Season {season}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
    </div>
    // <div className="border-b border-gray-200 overflow-x-auto">
    //   <div className="flex gap-2 min-w-max">
    //     {Array.from({ length: seasons }, (_, i) => i + 1).map((season) => (
    //       <button
    //         key={season}
    //         onClick={() => onSeasonChange(season)}
    //         className={`
    //           px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0
    //           ${activeSeason === season
    //             ? 'bg-blue-600 text-blue-100'
    //             : 'border-transparent text-gray-100 hover:text-blue-700'
    //           }
    //         `}
    //       >
    //         Season {season}
    //       </button>
    //     ))}
    //   </div>
    // </div>
  );
}

// Episode List Component
interface EpisodeListProps {
  episodes: Array<{
    episode_number: number;
    title: string | null;
    overview: string | null;
    air_date: string | null;
  }>;
  watchedEpisodes: Set<string>;
  onToggleWatched: (season: number, episode: number, event: React.MouseEvent) => void;
  season: number;
  isLoading: boolean;
  onViewDetails?: (episode: {
    episode_number: number;
    title: string | null;
    overview: string | null;
    air_date: string | null;
    season: number;
  }) => void;
}

function EpisodeList({ episodes, watchedEpisodes, onToggleWatched, season, isLoading, onViewDetails }: EpisodeListProps) {
  return (
    <ul className="divide-y divide-gray-200 border border-gray-200 overflow-hidden">
      {episodes.map((episode) => {
        const episodeKey = `s${season}e${episode.episode_number}`;
        const isWatched = watchedEpisodes.has(episodeKey);
        const episodeTitle = episode.title || `Episode ${episode.episode_number}`;
        
        return (
          <li
            key={episode.episode_number}
            className={`
              group relative flex items-center gap-4 p-3 md:p-4 transition-colors  hover:bg-gray-50
              ${isWatched ? 'bg-gray-50/50' : 'bg-white'}
            `}
          >
            {/* Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onToggleWatched(season, episode.episode_number, e);
              }}
              onMouseDown={(e) => {
                // Prevent focus to avoid scroll jumps
                e.preventDefault();
              }}
              type="button"
              tabIndex={-1}
              className={`
                flex-shrink-0 w-8 h-8 md:w-10 md:h-10 border border-gray-300 flex items-center justify-center transition-all duration-200 focus:outline-none
                ${isWatched ? 'bg-green-600' : 'bg-white hover:bg-gray-50'}
              `}
              aria-label={`Mark ${episodeTitle} as ${isWatched ? 'unwatched' : 'watched'}`}
              aria-pressed={isWatched}
              disabled={isLoading}
            >
              {isWatched && (
                <Check size={20} strokeWidth={2} className="text-white" />
              )}
            </button>

            {/* Content */}
            <button
              onClick={() => {
                if (onViewDetails) {
                  onViewDetails({
                    episode_number: episode.episode_number,
                    title: episode.title,
                    overview: episode.overview,
                    air_date: episode.air_date,
                    season: season,
                  });
                }
              }}
              className="flex-1 flex items-center justify-between text-left group-hover:cursor-pointer bg-white min-w-0"
              disabled={!onViewDetails}
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-sm md:text-base font-medium text-gray-900 transition-colors truncate">
                  {episodeTitle}
                </span>
                <span className="text-[10px] md:text-xs font-medium text-gray-500">
                  Episode {episode.episode_number}
                </span>
              </div>

              {onViewDetails && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 group-hover:text-gray-600 px-2 hidden md:block">
                  <Info size={18} />
                  <span className="sr-only">View details</span>
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function EpisodeTracker({
  libraryItem,
}: EpisodeTrackerProps) {
  const queryClient = useQueryClient();
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState<{
    episode_number: number;
    title: string | null;
    overview: string | null;
    air_date: string | null;
    season: number;
  } | null>(null);
  const [episodeModalOpen, setEpisodeModalOpen] = useState(false);

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

  // Create a map of episode statuses for quick lookup - memoized to prevent recalculation
  const episodeStatusMap = useMemo(() => {
    const map = new Map<string, 'watched' | 'unwatched' | 'skipped'>();
    episodeStatuses.forEach((status) => {
      const key = `s${status.season}e${status.episode}`;
      map.set(key, status.status);
    });
    return map;
  }, [episodeStatuses]);

  // Create watched episodes set for EpisodeList
  const watchedEpisodesSet = new Set<string>();
  episodeStatuses.forEach((status) => {
    if (status.status === 'watched') {
      const key = `s${status.season}e${status.episode}`;
      watchedEpisodesSet.add(key);
    }
  });

  // Mark episode mutation with optimistic updates
  const markEpisodeMutation = useMutation({
    mutationFn: ({ season, episode, watched }: { season: number; episode: number; watched: boolean }) => {
      return markEpisode(libraryItem.contentId, {
        season,
        episode,
        status: watched ? 'watched' : 'unwatched',
      });
    },
    // Optimistically update the cache before the mutation
    onMutate: async ({ season, episode, watched }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['episode-statuses', libraryItem.contentId] });
      
      // Snapshot the previous value for rollback
      const previousStatuses = queryClient.getQueryData<Array<{
        season: number;
        episode: number;
        status: 'watched' | 'unwatched' | 'skipped';
      }>>(['episode-statuses', libraryItem.contentId]);
      
      // Optimistically update the cache
      queryClient.setQueryData(
        ['episode-statuses', libraryItem.contentId],
        (old: Array<{ season: number; episode: number; status: 'watched' | 'unwatched' | 'skipped' }> = []) => {
          const existing = old.find(s => s.season === season && s.episode === episode);
          
          if (existing) {
            // Update existing status
            return old.map(s =>
              s.season === season && s.episode === episode
                ? { ...s, status: watched ? 'watched' : 'unwatched' }
                : s
            );
          } else {
            // Add new status
            return [...old, { season, episode, status: watched ? 'watched' : 'unwatched' }];
          }
        }
      );
      
      return { previousStatuses };
    },
    onError: (error: Error, _variables, context) => {
      // Rollback on error
      if (context?.previousStatuses) {
        queryClient.setQueryData(
          ['episode-statuses', libraryItem.contentId],
          context.previousStatuses
        );
      }
      toast.error(error?.message || 'Failed to update episode status');
    },
    onSuccess: () => {
      // Don't invalidate queries or call callbacks that might cause parent re-renders
      // The optimistic update already shows the correct state
      // Only update stats in the background without causing re-renders
      // queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      // onEpisodeUpdate(selectedSeason, episodes.length, true);
    },
  });

  // Mark season mutation with optimistic updates
  const markSeasonMutation = useMutation({
    mutationFn: (watched: boolean) => {
      return markSeason(libraryItem.contentId, {
        season: selectedSeason,
        status: watched ? 'watched' : 'unwatched',
      });
    },
    onMutate: async (watched) => {
      await queryClient.cancelQueries({ queryKey: ['episode-statuses', libraryItem.contentId] });
      
      const previousStatuses = queryClient.getQueryData<Array<{
        season: number;
        episode: number;
        status: 'watched' | 'unwatched' | 'skipped';
      }>>(['episode-statuses', libraryItem.contentId]);
      
      // Optimistically update all episodes in the season
      queryClient.setQueryData(
        ['episode-statuses', libraryItem.contentId],
        (old: Array<{ season: number; episode: number; status: 'watched' | 'unwatched' | 'skipped' }> = []) => {
          // Get all episodes for this season from the episodes data
          const currentSeasonEpisodes = episodes.filter(ep => ep.season === selectedSeason);
          const episodeNumbers = currentSeasonEpisodes.map(ep => ep.episode_number);
          
          // Remove existing statuses for this season and add new ones
          const updated = old.filter(s => !(s.season === selectedSeason && episodeNumbers.includes(s.episode)));
          const newStatuses = episodeNumbers.map(epNum => ({
            season: selectedSeason,
            episode: epNum,
            status: (watched ? 'watched' : 'unwatched') as 'watched' | 'unwatched',
          }));
          
          return [...updated, ...newStatuses];
        }
      );
      
      return { previousStatuses };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousStatuses) {
        queryClient.setQueryData(
          ['episode-statuses', libraryItem.contentId],
          context.previousStatuses
        );
      }
      toast.error(error?.message || 'Failed to update season');
    },
    onSuccess: (_, watched) => {
      // Don't invalidate library query to prevent parent re-renders
      // Optimistic update already shows correct state
      // queryClient.invalidateQueries({ queryKey: ['library'] });
      // queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success(`Season ${selectedSeason} marked as ${watched ? 'watched' : 'unwatched'}`);
    },
  });

  // Mark all episodes mutation with optimistic updates
  const markAllMutation = useMutation({
    mutationFn: (watched: boolean) => {
      return markAllEpisodes(libraryItem.contentId, {
        status: watched ? 'watched' : 'unwatched',
      });
    },
    onMutate: async (watched) => {
      await queryClient.cancelQueries({ queryKey: ['episode-statuses', libraryItem.contentId] });
      
      const previousStatuses = queryClient.getQueryData<Array<{
        season: number;
        episode: number;
        status: 'watched' | 'unwatched' | 'skipped';
      }>>(['episode-statuses', libraryItem.contentId]);
      
      // Optimistically update all episodes across all seasons
      queryClient.setQueryData(
        ['episode-statuses', libraryItem.contentId],
        (old: Array<{ season: number; episode: number; status: 'watched' | 'unwatched' | 'skipped' }> = []) => {
          // Get all unique season/episode combinations from episodes data
          const allEpisodes = episodes;
          const episodeKeys = new Set(
            allEpisodes.map(ep => `${ep.season}-${ep.episode_number}`)
          );
          
          // Remove all existing statuses and add new ones for all episodes
          const updated = old.filter(s => !episodeKeys.has(`${s.season}-${s.episode}`));
          const newStatuses = allEpisodes.map(ep => ({
            season: ep.season,
            episode: ep.episode_number,
            status: (watched ? 'watched' : 'unwatched') as 'watched' | 'unwatched',
          }));
          
          return [...updated, ...newStatuses];
        }
      );
      
      return { previousStatuses };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousStatuses) {
        queryClient.setQueryData(
          ['episode-statuses', libraryItem.contentId],
          context.previousStatuses
        );
      }
      toast.error(error?.message || 'Failed to update episodes');
    },
    onSuccess: (_, watched) => {
      // Don't invalidate library query to prevent parent re-renders
      // Optimistic update already shows correct state
      // queryClient.invalidateQueries({ queryKey: ['library'] });
      // queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success(`All episodes marked as ${watched ? 'watched' : 'unwatched'}`);
    },
  });

  const handleToggleWatched = (season: number, episode: number, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const key = `s${season}e${episode}`;
    const isWatched = episodeStatusMap.get(key) === 'watched';
    
    // Simply mutate - optimistic updates handle the UI update without causing re-renders
    markEpisodeMutation.mutate({ season, episode, watched: !isWatched });
  };

  const handleMarkSeasonWatched = () => {
    markSeasonMutation.mutate(true);
  };

  const handleMarkSeasonUnwatched = () => {
    markSeasonMutation.mutate(false);
  };

  const handleMarkAllWatched = () => {
    markAllMutation.mutate(true);
  };

  // Filter episodes for selected season and sort by episode number - memoized
  const seasonEpisodes = useMemo(() => {
    return episodes
      .filter((ep) => ep.season === selectedSeason)
      .sort((a, b) => a.episode_number - b.episode_number);
  }, [episodes, selectedSeason]);

  // Memoize watched count to prevent recalculation on every render
  const watchedCount = useMemo(() => {
    return seasonEpisodes.filter((ep) => {
      const key = `s${selectedSeason}e${ep.episode_number}`;
      return episodeStatusMap.get(key) === 'watched';
    }).length;
  }, [seasonEpisodes, selectedSeason, episodeStatusMap]);

  const totalCount = useMemo(() => seasonEpisodes.length, [seasonEpisodes]);
  
  const progress = useMemo(() => {
    return totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0;
  }, [watchedCount, totalCount]);

  if (isLoadingEpisodes) {
    return (
      <div className="bg-white">
        <div className="flex justify-center items-center p-8">
          <Loader size="sm" />
        </div>
      </div>
    );
  }

  if (seasonEpisodes.length === 0) {
    return (
      <div className="bg-white">
        <div className="p-6 md:p-8">
          <Text size="sm" c="dimmed">
            No episodes found for Season {selectedSeason}
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white w-full">
      {/* Header */}
      {/* <div className="w-full flex items-center p-4 md:p-4 border-b border-gray-200"> */}
      <div className="w-full flex items-center p-4 md:p-4">
        <div className="flex items-center gap-3">
          <ListVideo size={18} className="text-gray-600" />
          <span className="font-medium text-gray-900">Episode tracker</span>
        </div>
      </div>

      {/* Content - Always Visible */}
      <div className="p-6 md:p-8 space-y-6 w-full">
          {/* Season Tabs */}
          {seasons > 1 && (
            <SeasonTabs
              seasons={seasons}
              activeSeason={selectedSeason}
              onSeasonChange={setSelectedSeason}
            />
          )}

          {/* Bulk Actions */}
          {/* mark entire show as watched */}
          <button
            onClick={handleMarkAllWatched}
            disabled={markAllMutation.isPending}
            className="w-full bg-gray-900 border-r-0 hover:bg-gray-800 py-3 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <span className="text-white font-medium text-sm flex items-center gap-2">
              Mark Entire Show as Watched
            </span>
          </button>

          {/* Unwatched buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              color="dark"
              className="font-medium border-gray-300 hover:bg-gray-50"
              styles={{
                root: {
                  borderRadius: 0,
                },
              }}
              onClick={handleMarkSeasonWatched}
              loading={markSeasonMutation.isPending}
            >
              Mark Season {selectedSeason} as Watched
            </Button>
            <Button
              variant="outline"
              color="dark"
              className="font-medium border-gray-300 hover:bg-gray-50"
              styles={{
                root: {
                  borderRadius: 0,
                },
              }}
              onClick={handleMarkSeasonUnwatched}
              loading={markSeasonMutation.isPending}
            >
              Mark Season as Unwatched
            </Button>
          </div>

          {/* Season Progress - Fixed height to prevent layout shifts */}
          <div 
            className="bg-gray-50 border border-gray-200 p-6" 
            style={{ 
              height: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div className="flex justify-between items-end mb-3" style={{ minHeight: '48px', height: '48px' }}>
              <div style={{ minWidth: '120px', flexShrink: 0 }}>
                <div className="text-xs font-medium text-gray-500 mb-1">
                  Season {selectedSeason}
                </div>
                <div 
                  className="text-xl md:text-2xl font-semibold text-gray-900" 
                  style={{ 
                    height: '32px', 
                    lineHeight: '32px',
                    display: 'flex',
                    alignItems: 'flex-end'
                  }}
                >
                  {watchedCount}/{totalCount} episodes
                </div>
              </div>
              <div 
                className="text-2xl font-semibold text-gray-900" 
                style={{ 
                  minWidth: '60px', 
                  textAlign: 'right',
                  height: '32px',
                  lineHeight: '32px'
                }}
              >
                {progress}%
              </div>
            </div>
            <div className="w-full bg-gray-200 h-2 overflow-hidden" style={{ height: '8px', flexShrink: 0 }}>
              <div
                className="bg-gray-900 h-full transition-all duration-500 ease-out"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          {/* Episode List */}
          <EpisodeList
            episodes={seasonEpisodes}
            watchedEpisodes={watchedEpisodesSet}
            onToggleWatched={handleToggleWatched}
            season={selectedSeason}
            isLoading={markEpisodeMutation.isPending}
            onViewDetails={(episode) => {
              setSelectedEpisode({
                episode_number: episode.episode_number,
                title: episode.title,
                overview: episode.overview,
                air_date: episode.air_date,
                season: episode.season,
              });
              setEpisodeModalOpen(true);
            }}
          />
      </div>

      {/* Episode Detail Modal */}
      <EpisodeDetailModal
        opened={episodeModalOpen}
        onClose={() => {
          setEpisodeModalOpen(false);
          setSelectedEpisode(null);
        }}
        episode={selectedEpisode}
      />
    </div>
  );
}
