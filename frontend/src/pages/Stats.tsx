import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container, Loader, Center, Text, Button } from '@mantine/core';
import { useLocation } from 'wouter';
import { LibraryStats } from '../components/library/LibraryStats';
import { ProgressBar } from '../components/stats/ProgressBar';
import { ActivityItem } from '../components/stats/ActivityItem';
import { InsightsCard } from '../components/stats/InsightsCard';
import { getLibrary, getLibraryStats, getDetailedStats } from '../api/library';
import { libraryItemToUI, libraryStatsToUI } from '../utils/library.utils';

export function Stats() {
  const [, setLocation] = useLocation();

  // Fetch library items
  const { data: libraryItems = [], isLoading: isLoadingLibrary } = useQuery({
    queryKey: ['library'],
    queryFn: () => getLibrary(),
  });

  // Fetch library stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['library', 'stats'],
    queryFn: getLibraryStats,
  });

  // Fetch detailed stats
  const { data: detailedStats, isLoading: isLoadingDetailed } = useQuery({
    queryKey: ['library', 'stats', 'detailed'],
    queryFn: getDetailedStats,
  });

  // Convert API items to UI format
  const libraryItemsUI = useMemo(() => {
    return libraryItems.map(libraryItemToUI);
  }, [libraryItems]);

  // Calculate stats from filtered data
  const calculatedStats = useMemo(() => {
    if (stats) {
      return libraryStatsToUI(stats);
    }
    // Fallback to calculating from current library items
    return {
      totalItems: libraryItemsUI.length,
      watching: libraryItemsUI.filter((i) => i.status === 'watching').length,
      completed: libraryItemsUI.filter((i) => i.status === 'completed').length,
      dropped: libraryItemsUI.filter((i) => i.status === 'dropped').length,
      planToWatch: libraryItemsUI.filter((i) => i.status === 'plan_to_watch').length,
      totalShows: libraryItemsUI.filter((i) => i.content.contentType === 'show').length,
      totalMovies: libraryItemsUI.filter((i) => i.content.contentType === 'movie').length,
      totalEpisodesWatched: libraryItemsUI.reduce(
        (sum, item) => sum + (item.progress?.episodesWatched || 0),
        0
      ),
    };
  }, [stats, libraryItemsUI]);

  if (isLoadingLibrary || isLoadingStats || isLoadingDetailed) {
    return (
      <Center className="min-h-screen">
        <Loader size="lg" />
      </Center>
    );
  }

  const showsInProgress = detailedStats?.shows_in_progress || [];
  const recentActivity = detailedStats?.recent_activity || [];
  const insights = detailedStats?.insights;

  return (
    <div className="min-h-screen bg-gray-50">
      <Container size="xl" className="py-4 md:py-8 lg:py-12 px-2 md:px-4">
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <Button
            size="sm"
            variant="subtle"
            className="text-gray-600 hover:text-gray-900"
            onClick={() => setLocation('/library')}
          >
            ← Back to Library
          </Button>
        </div>

        {/* Stats Dashboard */}
        <LibraryStats stats={calculatedStats} alwaysExpanded={true} />

        {/* Shows in Progress */}
        {showsInProgress.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
                PROGRESS
              </div>
              <h2 className="text-xl font-black uppercase tracking-wider">
                Shows in Progress
              </h2>
            </div>
            <div className="space-y-3">
              {showsInProgress.map((show) => (
                <ProgressBar
                  key={show.id}
                  title={show.title}
                  posterUrl={show.poster_url}
                  episodesWatched={show.episodes_watched}
                  totalEpisodes={show.total_episodes}
                  percentage={show.percentage}
                />
              ))}
            </div>
          </div>
        )}

        {/* Viewing Insights */}
        {insights && (
          <div className="mt-8">
            <InsightsCard
              completionRate={insights.completion_rate}
              totalWatchTimeHours={insights.total_watch_time_hours}
              totalEpisodesWatched={insights.total_episodes_watched}
            />
          </div>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-gray-900 text-white px-2 py-1 text-[10px] font-black tracking-widest">
                ACTIVITY
              </div>
              <h2 className="text-xl font-black uppercase tracking-wider">
                📅 Recent Activity
              </h2>
            </div>
            <div className="bg-white border-2 border-gray-900 p-4">
              {recentActivity.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  title={activity.title}
                  posterUrl={activity.poster_url}
                  contentType={activity.content_type}
                  status={activity.status}
                  timestamp={activity.last_watched_at || activity.completed_at}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {showsInProgress.length === 0 && recentActivity.length === 0 && (
          <div className="mt-8 bg-white border-2 border-gray-900 p-8 text-center">
            <div className="text-4xl mb-4">📊</div>
            <Text size="xl" fw={700} className="mb-2">
              Start Watching to See Stats
            </Text>
            <Text c="dimmed" className="mb-4">
              Add shows to your library and start watching to see progress tracking and activity!
            </Text>
            <Button
              size="md"
              className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
              onClick={() => setLocation('/library')}
            >
              Go to Library
            </Button>
          </div>
        )}
      </Container>
    </div>
  );
}

