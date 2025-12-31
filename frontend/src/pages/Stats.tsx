import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Container, Loader, Center, Text, Button } from '@mantine/core';
import { useLocation } from 'wouter';
import { LibraryStats } from '../components/library/LibraryStats';
import { getLibrary, getLibraryStats } from '../api/library';
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

  if (isLoadingLibrary || isLoadingStats) {
    return (
      <Center className="min-h-screen">
        <Loader size="lg" />
      </Center>
    );
  }

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

        {/* Progress Bars Section - Coming Soon */}
        <div className="mt-8 bg-white border-2 border-gray-900 p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <Text size="xl" fw={700} className="mb-2">
            More Stats Coming Soon
          </Text>
          <Text c="dimmed">
            We're working on progress bars, viewing insights, recent activity, and achievements!
          </Text>
        </div>
      </Container>
    </div>
  );
}

