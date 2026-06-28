import { useState, useMemo, useRef, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Loader, Center } from '@mantine/core';
import { Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { captureApiError } from '../lib/posthog';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { LibraryFilters } from '../components/library/LibraryFilters';
import { LibraryCard } from '../components/library/LibraryCard';
import { LibraryDetailModal } from '../components/library/LibraryDetailModal';
import { getLibrary, removeFromLibrary, updateLibraryItem, checkLibrary } from '../api/library';
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

  // Deep-link: open a specific content's detail when navigated with ?open=<content_id>
  // (used by Home widgets like "Up next"). Fetched directly so it resolves regardless of
  // the current list filter or pagination.
  const openContentId = useMemo(
    () => new URLSearchParams(window.location.search).get('open'),
    []
  );
  const [openApplied, setOpenApplied] = useState(false);
  const { data: openCheck } = useQuery({
    queryKey: ['library', 'open', openContentId],
    queryFn: () => checkLibrary(openContentId!),
    enabled: !!openContentId,
    staleTime: 60_000,
  });
  // Open the detail modal once the deep-linked item resolves (adjust-state-during-render).
  if (!openApplied && openCheck?.library_item) {
    setOpenApplied(true);
    setSelectedItem(libraryItemToUI(openCheck.library_item));
    setIsModalOpen(true);
  }

  // Fetch library items with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingLibrary,
  } = useInfiniteQuery({
    queryKey: ['library', filterStatus !== 'all' ? filterStatus : undefined, filterType !== 'all' ? filterType : undefined],
    queryFn: ({ pageParam = 1 }) => getLibrary(
      filterStatus !== 'all' ? filterStatus : undefined,
      filterType !== 'all' ? filterType : undefined,
      undefined,
      pageParam as number,
    ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.has_next ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });

  const totalItems = data?.pages[0]?.pagination.total_items ?? 0;

  // Infinite scroll sentinel
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Convert API items to UI format
  const libraryItemsUI: LibraryItemUI[] = useMemo(() => {
    return (data?.pages.flatMap(p => p.items) ?? []).map(libraryItemToUI);
  }, [data]);

  // Remove from library mutation
  const removeMutation = useMutation({
    mutationFn: removeFromLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      toast.success('Removed from library');
    },
    onError: (error: Error) => {
      captureApiError(error, { operation: 'removeFromLibrary' });
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
      await queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });

      // Sync modal with saved values directly from mutation variables
      if (selectedItem && selectedItem.id === variables.id) {
        setSelectedItem(prev => prev ? { ...prev, ...variables.updates } : prev);
      }

      toast.success('Library updated');
    },
    onError: (error: Error) => {
      captureApiError(error, { operation: 'updateLibraryItem' });
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
      captureApiError(error, { operation: 'addToQueue' });
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
    setLocation('/browse');
  };

  if (isLoadingLibrary) {
    return (
      <Center className="min-h-screen">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <>
      <PageContainer>
        {/* Header */}
        <PageHeader
          title="Library"
          subtitle={`${totalItems} ${totalItems === 1 ? 'title' : 'titles'} tracked`}
          actions={
            <>
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
            </>
          }
        />

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

        {/* Library Grid - Responsive Poster Grid */}
        {filteredLibrary.length > 0 ? (
          <>
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
            <div ref={loadMoreRef} className="mt-6 flex justify-center">
              {isFetchingNextPage && <Loader size="sm" />}
            </div>
          </>
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
      </PageContainer>

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
    </>
  );
}

