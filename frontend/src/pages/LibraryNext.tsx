import { useState, useMemo, useRef, useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Loader, Center } from '@mantine/core';
import { Plus } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { captureApiError } from '../lib/posthog';
import { PageHeader } from '../components/layout/PageHeader';
import { PageContainer } from '../components/layout/PageContainer';
import { LibraryDetailModal } from '../components/library/LibraryDetailModal';
import { LibraryFilterControls, type LibraryStatusFilter } from '../components/library/LibraryFilterControls';
import { LibraryWall } from '../components/library/LibraryWall';
import { LibraryTabs, type LibraryTab } from '../components/library/LibraryTabs';
import { CollectionsView } from '../components/library/CollectionsView';
import { CollectionDetail } from '../components/library/CollectionDetail';
import { NewListModal } from '../components/library/NewListModal';
import { AddToListModal } from '../components/library/AddToListModal';
import { PosterSizeControl } from '../components/library/PosterSizeControl';
import { useCollections, itemKey, type CollectionItem } from '../hooks/useCollections';
import { usePosterSize } from '../hooks/usePosterSize';
import { getLibrary, removeFromLibrary, updateLibraryItem, checkLibrary } from '../api/library';
import { addToQueue } from '../api/content';
import { libraryItemToUI } from '../utils/library.utils';
import type {
  LibraryItemUI,
  LibraryFilterType,
  LibrarySortOption,
} from '../types/library.types';

/**
 * PROTOTYPE of the redesigned Library (Apple album-grid + Collections), served at
 * /library-next. Reuses the production data layer + detail modal; the live /library
 * page is untouched. Collections run on a local seeded store (useCollections).
 */
export function LibraryNext() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [tab, setTab] = useState<LibraryTab>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<LibraryStatusFilter>('all');
  const [filterType, setFilterType] = useState<LibraryFilterType>('all');
  const [sortBy, setSortBy] = useState<LibrarySortOption>('recently_added');
  // Independent, separately-remembered poster size per surface.
  const wallSize = usePosterSize('wall');
  const listsSize = usePosterSize('lists');
  const listDetailSize = usePosterSize('list-detail');
  const [selectedItem, setSelectedItem] = useState<LibraryItemUI | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Collections (Lists tab)
  const collectionsApi = useCollections();
  const [openListId, setOpenListId] = useState<string | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);
  const [addToListOpen, setAddToListOpen] = useState(false);

  // Deep-link: open a specific content's detail when navigated with ?open=<content_id>.
  const openContentId = useMemo(() => new URLSearchParams(window.location.search).get('open'), []);
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

  // Fetch library items with infinite scroll (no status param — tabs filter client-side).
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingLibrary,
  } = useInfiniteQuery({
    queryKey: ['library', filterType !== 'all' ? filterType : undefined],
    queryFn: ({ pageParam = 1 }) =>
      getLibrary(undefined, filterType !== 'all' ? filterType : undefined, undefined, pageParam as number),
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

  const libraryItemsUI: LibraryItemUI[] = useMemo(
    () => (data?.pages.flatMap((p) => p.items) ?? []).map(libraryItemToUI),
    [data]
  );

  // Snapshot library content for list entries + a lookup so a list item that IS
  // in the library opens the detail modal (vs. routing to the content page).
  const librarySnapshots = useMemo<CollectionItem[]>(
    () =>
      libraryItemsUI
        .filter((i) => i.content.tmdbId != null)
        .map((i) => ({
          tmdbId: i.content.tmdbId as number,
          type: i.content.contentType === 'show' ? 'tv' : 'movie',
          title: i.content.title,
          posterUrl: i.content.posterUrl,
        })),
    [libraryItemsUI]
  );

  const libraryByKey = useMemo(() => {
    const map = new Map<string, LibraryItemUI>();
    for (const item of libraryItemsUI) {
      if (item.content.tmdbId == null) continue;
      const type = item.content.contentType === 'show' ? 'tv' : 'movie';
      map.set(itemKey({ tmdbId: item.content.tmdbId, type }), item);
    }
    return map;
  }, [libraryItemsUI]);

  // Seed example lists once real library data is available (no-op if lists exist).
  const { seedIfEmpty } = collectionsApi;
  useEffect(() => {
    if (librarySnapshots.length > 0) seedIfEmpty(librarySnapshots);
  }, [librarySnapshots, seedIfEmpty]);

  // Mutations (copied from the live Library page)
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

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LibraryItemUI> }) =>
      updateLibraryItem(id, {
        status: updates.status,
        score: updates.score,
        notes: updates.notes,
        current_season: updates.currentSeason,
        current_episode: updates.currentEpisode,
      }),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
      if (selectedItem && selectedItem.id === variables.id) {
        setSelectedItem((prev) => (prev ? { ...prev, ...variables.updates } : prev));
      }
      toast.success('Library updated');
    },
    onError: (error: Error) => {
      captureApiError(error, { operation: 'updateLibraryItem' });
      toast.error(error?.message || 'Failed to update library');
    },
  });

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

  // Searched, status/type-filtered, sorted items for the single library wall.
  const filteredLibrary = useMemo(() => {
    const filtered = libraryItemsUI.filter((item) => {
      const matchesSearch = item.content.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
      const matchesType = filterType === 'all' || item.content.contentType === filterType;
      return matchesSearch && matchesStatus && matchesType;
    });
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'alphabetical':
          return a.content.title.localeCompare(b.content.title);
        case 'recently_updated':
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        case 'last_watched':
          return (b.lastWatchedAt?.getTime() || 0) - (a.lastWatchedAt?.getTime() || 0);
        case 'score':
          return (b.score || 0) - (a.score || 0);
        case 'progress':
          return (b.progress?.percentage || 0) - (a.progress?.percentage || 0);
        case 'recently_added':
        default:
          return b.addedAt.getTime() - a.addedAt.getTime();
      }
    });
  }, [libraryItemsUI, searchQuery, filterStatus, filterType, sortBy]);

  const counts = useMemo(
    () => ({
      library: totalItems,
      lists: collectionsApi.collections.length,
    }),
    [totalItems, collectionsApi.collections]
  );

  // Handlers
  const handleViewDetails = (item: LibraryItemUI) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };
  const handleSave = (updates: Partial<LibraryItemUI>) => {
    const itemId = updates.id || selectedItem?.id;
    if (!itemId) return;
    updateMutation.mutate({ id: itemId, updates });
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };
  const handleAddToQueue = (item: LibraryItemUI) => addToQueueMutation.mutate({ content_id: item.contentId });
  const handleRemove = (id: string) => {
    if (confirm('Are you sure you want to remove this from your library?')) removeMutation.mutate(id);
  };

  // Collection helpers
  const openList = openListId ? collectionsApi.collections.find((c) => c.id === openListId) ?? null : null;

  // Open a list entry: in-library → existing detail modal; otherwise → content page.
  const handleOpenListItem = (item: CollectionItem) => {
    const libItem = libraryByKey.get(itemKey(item));
    if (libItem) {
      handleViewDetails(libItem);
    } else {
      setLocation(`/content/${item.type}/${item.tmdbId}`);
    }
  };

  if (isLoadingLibrary) {
    return (
      <Center className="min-h-screen">
        <Loader size="lg" />
      </Center>
    );
  }

  // When a list is open, hide the Library header + tabs so the list is the focus.
  const inListDetail = tab === 'lists' && !!openList;

  return (
    <>
      <PageContainer>
        {!inListDetail && (
        <>
        <PageHeader
          title="Library"
          subtitle={`${totalItems} ${totalItems === 1 ? 'title' : 'titles'}`}
          actions={
            tab === 'lists' ? (
              <Button
                size="sm"
                className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80 font-semibold"
                radius="md"
                leftSection={<Plus size={16} />}
                onClick={() => setNewListOpen(true)}
              >
                New list
              </Button>
            ) : (
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
                  className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80 font-semibold"
                  radius="md"
                  leftSection={<Plus size={16} />}
                  onClick={() => setLocation('/browse')}
                >
                  Add Media
                </Button>
              </>
            )
          }
        />

        <LibraryTabs
          value={tab}
          onChange={(t) => {
            setTab(t);
            if (t !== 'lists') setOpenListId(null);
          }}
          counts={counts}
          right={
            tab === 'library' ? (
              <LibraryFilterControls
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterStatus={filterStatus}
                onFilterStatusChange={setFilterStatus}
                filterType={filterType}
                onFilterTypeChange={setFilterType}
                sortBy={sortBy}
                onSortChange={setSortBy}
                trailing={<PosterSizeControl value={wallSize.size} onChange={wallSize.setSize} />}
              />
            ) : undefined
          }
        />
        </>
        )}

        {tab === 'lists' ? (
          openList ? (
            <CollectionDetail
              collection={openList}
              items={openList.items}
              onBack={() => setOpenListId(null)}
              onOpenItem={handleOpenListItem}
              onRemoveItem={(key) => collectionsApi.removeItem(openList.id, key)}
              onReorder={(keys) => collectionsApi.reorderItems(openList.id, keys)}
              onToggleRanked={(ranked) => collectionsApi.setRanked(openList.id, ranked)}
              onRename={(name) => collectionsApi.renameList(openList.id, name)}
              onSetDescription={(desc) => collectionsApi.setDescription(openList.id, desc)}
              onDelete={() => {
                collectionsApi.deleteList(openList.id);
                setOpenListId(null);
              }}
              onAddTitles={() => setAddToListOpen(true)}
              size={listDetailSize.size}
              onSizeChange={listDetailSize.setSize}
            />
          ) : (
            <CollectionsView
              collections={collectionsApi.collections}
              size={listsSize.size}
              onSizeChange={listsSize.setSize}
              onOpen={setOpenListId}
              onNew={() => setNewListOpen(true)}
            />
          )
        ) : (
          <>
            {filteredLibrary.length > 0 ? (
              <>
                <LibraryWall items={filteredLibrary} onOpen={handleViewDetails} size={wallSize.size} />
                <div ref={loadMoreRef} className="mt-6 flex justify-center">
                  {isFetchingNextPage && <Loader size="sm" />}
                </div>
              </>
            ) : (
              <div className="bg-[rgb(var(--color-bg-surface))] rounded-lg p-12 text-center border border-[rgb(var(--color-border-default))]">
                <h3 className="text-base font-semibold text-[rgb(var(--color-text-primary))] mb-2">
                  {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                    ? 'No matching titles'
                    : 'Your library is empty'}
                </h3>
                <p className="text-sm text-[rgb(var(--color-text-secondary))] mb-6">
                  {searchQuery || filterStatus !== 'all' || filterType !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Add shows and movies to start tracking'}
                </p>
                <Button
                  className="bg-[rgb(var(--color-accent))] text-white hover:opacity-80 font-semibold"
                  radius="md"
                  leftSection={<Plus size={16} />}
                  onClick={() => setLocation('/browse')}
                >
                  Add Media
                </Button>
              </div>
            )}
          </>
        )}
      </PageContainer>

      {/* Detail modal (reused as-is from the live page) */}
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

      <NewListModal
        opened={newListOpen}
        onClose={() => setNewListOpen(false)}
        onCreate={(name, ranked, description) => {
          const list = collectionsApi.createList(name, ranked, description);
          setOpenListId(list.id);
        }}
      />

      {openList && (
        <AddToListModal
          opened={addToListOpen}
          onClose={() => setAddToListOpen(false)}
          listName={openList.name}
          libraryItems={libraryItemsUI}
          existingKeys={openList.items.map(itemKey)}
          onAdd={(items) => collectionsApi.addItems(openList.id, items)}
        />
      )}
    </>
  );
}
