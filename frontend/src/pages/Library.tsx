import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Text, Loader, Center } from '@mantine/core';
import { Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { LibraryStats } from '../components/library/LibraryStats';
import { LibraryFilters } from '../components/library/LibraryFilters';
import { LibraryCard } from '../components/library/LibraryCard';
import { LibraryDetailModal } from '../components/library/LibraryDetailModal';
import { getLibrary, getLibraryStats, removeFromLibrary, updateLibraryItem } from '../api/library';
import { addToQueue } from '../api/content';
import { libraryItemToUI, libraryStatsToUI } from '../utils/library.utils';
import type {
  LibraryItemUI,
  LibraryFilterStatus,
  LibraryFilterType,
  LibrarySortOption,
} from '../types/library.types';

export function Library() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<LibraryFilterStatus>('all');
  const [filterType, setFilterType] = useState<LibraryFilterType>('all');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('recently_added');
  const [selectedItem, setSelectedItem] = useState<LibraryItemUI | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch library items
  const { data: libraryItems = [], isLoading: isLoadingLibrary } = useQuery({
    queryKey: ['library', filterStatus !== 'all' ? filterStatus : undefined, filterType !== 'all' ? filterType : undefined],
    queryFn: () => getLibrary(
      filterStatus !== 'all' ? filterStatus : undefined,
      filterType !== 'all' ? filterType : undefined,
      searchQuery || undefined
    ),
  });

  // Fetch library stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['library', 'stats'],
    queryFn: getLibraryStats,
  });

  // Convert API items to UI format
  const libraryItemsUI: LibraryItemUI[] = useMemo(() => {
    return libraryItems.map(libraryItemToUI);
  }, [libraryItems]);

  // Remove from library mutation
  const removeMutation = useMutation({
    mutationFn: removeFromLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success('Removed from library');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to remove from library');
    },
  });

  // Update library item mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LibraryItemUI> }) => {
      return updateLibraryItem(id, {
        status: updates.status,
        score: updates.score,
        notes: updates.notes,
        current_season: updates.currentSeason,
        current_episode: updates.currentEpisode,
        // Note: cardColor is frontend-only for now, not sent to backend
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success('Library updated');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to update library');
    },
  });

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: addToQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Added to queue');
    },
    onError: (error: Error) => {
      toast.error(error?.message || 'Failed to add to queue');
    },
  });

  // Filter and sort library
  const filteredLibrary = useMemo(() => {
    let filtered = libraryItemsUI.filter((item) => {
      const matchesSearch = item.content.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchesType =
        filterType === 'all' || item.content.contentType === filterType;
      return matchesSearch && matchesStatus && matchesType;
    });

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.content.title.localeCompare(b.content.title);
        case 'recently_updated':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'last_watched': {
          const aTime = a.lastWatchedAt?.getTime() || 0;
          const bTime = b.lastWatchedAt?.getTime() || 0;
          return bTime - aTime;
        }
        case 'score':
          return (b.score || 0) - (a.score || 0);
        case 'progress': {
          const aProgress = a.progress?.percentage || 0;
          const bProgress = b.progress?.percentage || 0;
          return bProgress - aProgress;
        }
        case 'recently_added':
        default:
          return b.addedAt.getTime() - a.addedAt.getTime();
      }
    });

    return filtered;
  }, [libraryItemsUI, searchQuery, filterStatus, filterType, sortBy]);

  // Calculate stats from filtered data (fallback if API stats not available)
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

  const handleViewDetails = (item: LibraryItemUI) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSave = (updates: Partial<LibraryItemUI>) => {
    // Can be called from modal or card
    const itemId = updates.id || selectedItem?.id;
    if (!itemId) return;
    updateMutation.mutate({ id: itemId, updates });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleAddToQueue = (item: LibraryItemUI) => {
    addToQueueMutation.mutate(item.contentId);
  };

  const handleRemove = (id: string) => {
    if (confirm('Are you sure you want to remove this from your library?')) {
      removeMutation.mutate(id);
    }
  };

  const handleNavigateToSearch = () => {
    setLocation('/search');
  };

  if (isLoadingLibrary || isLoadingStats) {
    return (
      <Center className="min-h-screen">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Container size="xl" className="py-4 md:py-8 lg:py-12 px-2 md:px-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 md:mb-8">
          <div>
            <Text
              size="xs"
              c="dimmed"
              fw={500}
              className="uppercase tracking-widest mb-1"
            >
              Your Collection
            </Text>
            <Text size="3xl" fw={300} className="text-gray-900 tracking-tight">
              Library
            </Text>
          </div>
          <Button
            size="sm"
            className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
            radius="xs"
            leftSection={<Plus size={16} />}
            onClick={handleNavigateToSearch}
          >
            ADD MEDIA
          </Button>
        </div>

        {/* Stats Dashboard */}
        <LibraryStats stats={calculatedStats} />

        {/* Filters */}
        <LibraryFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />

        {/* Results Count */}
        <div className="mb-4">
          <Text
            size="sm"
            className="font-mono font-black uppercase tracking-wider"
          >
            {filteredLibrary.length} ITEMS
          </Text>
        </div>

        {/* Library Grid - Responsive */}
        {filteredLibrary.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLibrary.map((item) => (
              <LibraryCard
                key={`${item.id}-${item.status}-${item.score ?? 'null'}-${item.notes ?? 'null'}`}
                item={item}
                onViewDetails={handleViewDetails}
                onChangeStatus={handleViewDetails}
                onAddToQueue={handleAddToQueue}
                onRemove={handleRemove}
                onSave={handleSave}
              />
            ))}
          </div>
        ) : (
          <div className="bg-gray-200 border-2 border-gray-900 p-12 text-center">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-black uppercase tracking-tight mb-2">
              NO ITEMS FOUND
            </h3>
            <p className="text-sm opacity-70 mb-4">
              {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Start building your library'}
            </p>
            <Button
              size="md"
              className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
              radius="xs"
              leftSection={<Plus size={16} />}
              onClick={handleNavigateToSearch}
            >
              ADD MEDIA
            </Button>
          </div>
        )}
      </Container>

      {/* Detail Modal */}
      {selectedItem && (
        <LibraryDetailModal
          key={`modal-${selectedItem.id}-${selectedItem.status}-${selectedItem.score ?? 'null'}-${selectedItem.notes ?? 'null'}`}
          item={selectedItem}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSave}
          onAddToQueue={handleAddToQueue}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}

