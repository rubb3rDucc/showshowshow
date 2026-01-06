import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Text, Loader, Center } from '@mantine/core';
import { Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { LibraryFilters } from '../components/library/LibraryFilters';
import { LibraryCard } from '../components/library/LibraryCard';
import { LibraryDetailModal } from '../components/library/LibraryDetailModal';
import { getLibrary, removeFromLibrary, updateLibraryItem } from '../api/library';
import { addToQueue } from '../api/content';
import { libraryItemToUI } from '../utils/library.utils';
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
    onSuccess: async (_, variables) => {
      // Invalidate and refetch library data
      await queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });

      // Update selectedItem with fresh data if modal is open
      if (selectedItem && selectedItem.id === variables.id) {
        const freshLibrary = queryClient.getQueryData<typeof libraryItems>(['library', filterStatus !== 'all' ? filterStatus : undefined, filterType !== 'all' ? filterType : undefined]);
        const freshItem = freshLibrary?.find(item => libraryItemToUI(item).id === variables.id);
        if (freshItem) {
          setSelectedItem(libraryItemToUI(freshItem));
        }
      }

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
    addToQueueMutation.mutate({ content_id: item.contentId });
  };

  const handleRemove = (id: string) => {
    if (confirm('Are you sure you want to remove this from your library?')) {
      removeMutation.mutate(id);
    }
  };

  const handleNavigateToSearch = () => {
    setLocation('/');
  };

  if (isLoadingLibrary) {
    return (
      <Center className="min-h-screen">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))] pb-20">
      <Container size="xl" className="py-6 md:py-10 lg:py-12 px-4 md:px-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[rgb(var(--color-text-primary))]">My Library</h1>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="subtle"
              className="text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] font-semibold"
              onClick={() => setLocation('/stats')}
            >
              View Stats
            </Button>
            <Button
              size="sm"
              className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80 font-semibold shadow-sm hover:shadow-lg"
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={handleNavigateToSearch}
            >
              Add Media
            </Button>
          </div>
        </div>

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
        <div className="mb-6">
          <Text
            size="sm"
            className="text-[rgb(var(--color-text-secondary))] font-semibold"
          >
            {filteredLibrary.length} {filteredLibrary.length === 1 ? 'title' : 'titles'}
          </Text>
        </div>

        {/* Library Grid - Responsive Poster Grid */}
        {filteredLibrary.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
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
          <div className="bg-[rgb(var(--color-bg-surface))] rounded-lg p-12 text-center border border-[rgb(var(--color-border-default))] shadow-sm dark:shadow-gray-950/50">
              <div className="text-6xl mb-4"></div>
            <h3 className="text-xl font-semibold text-[rgb(var(--color-text-primary))] mb-2">
              No items found
            </h3>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">
              {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Start building your library'}
            </p>
            <Button
              size="md"
              className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80 font-semibold shadow-sm hover:shadow-lg"
              radius="md"
              leftSection={<Plus size={16} />}
              onClick={handleNavigateToSearch}
            >
              Add Media
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

