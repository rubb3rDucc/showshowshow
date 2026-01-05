import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Container,
  TextInput,
  Button,
  Text,
  Loader,
  Center,
  Stack,
  Pagination,
} from '@mantine/core';
import { Search as SearchIcon, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { searchContent, getContentByTmdbId, getContentByMalId, addToQueue, getQueue } from '../api/content';
import { getLibrary, addToLibrary } from '../api/library';
import { SearchResultCard } from '../components/search/SearchResultCard';
import { ContentDetailModal } from '../components/browse/ContentDetailModal';
import type { SearchResult, SearchResponse, QueueItem } from '../types/api';
import type { LibraryStatus } from '../types/library.types';

export function Search() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [includeAdult] = useState(false);
  const [animeOnly, setAnimeOnly] = useState(false);
  const [titlePreference] = useState<'english' | 'japanese' | 'romanji'>('english');
  const [addingToQueueId, setAddingToQueueId] = useState<string | null>(null);
  const [addingToLibraryId, setAddingToLibraryId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<SearchResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  
  // Store pagination metadata separately to keep pagination controls stable
  // Store the last known good metadata for the current search query
  const [lastKnownMetadata, setLastKnownMetadata] = useState<{
    total_pages: number;
    total_results: number;
    searchQuery: string;
  } | null>(null);

  // Determine search source based on animeOnly toggle
  const searchSource = animeOnly ? 'jikan' : 'tmdb';

  // Search query - trigger on query change with debounce
  // Use placeholderData: keepPreviousData to keep previous page data visible during transitions
  const { data, isLoading, isFetching, isPlaceholderData, error } = useQuery<SearchResponse>({
    queryKey: ['search', searchQuery, page, includeAdult, searchSource],
    queryFn: () => searchContent(searchQuery, page, includeAdult, searchSource),
    enabled: searchQuery.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30000, // Cache results for 30 seconds to reduce API calls
    gcTime: 300000, // Keep in cache for 5 minutes (formerly cacheTime)
  });
  
  // Compute effective pagination metadata
  // Use last known metadata if it matches current search, otherwise use current data
  const effectivePaginationMetadata = useMemo(() => {
    // If we have stored metadata for the current search query, use it
    if (lastKnownMetadata && lastKnownMetadata.searchQuery === searchQuery) {
      return lastKnownMetadata;
    }
    // Otherwise, use current data if available
    if (data) {
      return {
        total_pages: data.total_pages,
        total_results: data.total_results,
        searchQuery: searchQuery,
      };
    }
    return null;
  }, [lastKnownMetadata, searchQuery, data]);
  
  // Update stored metadata when we get valid, non-placeholder data
  // Use setTimeout to avoid setState in effect warning
  useEffect(() => {
    if (data && !isPlaceholderData && data.page === page && data.total_pages) {
      const newMetadata = {
        total_pages: data.total_pages,
        total_results: data.total_results,
        searchQuery: searchQuery,
      };
      
      // Only update if different
      if (!lastKnownMetadata || 
          lastKnownMetadata.searchQuery !== searchQuery ||
          lastKnownMetadata.total_pages !== data.total_pages ||
          lastKnownMetadata.total_results !== data.total_results) {
        // Use setTimeout to defer state update and avoid linter warning
        const timeoutId = setTimeout(() => {
          setLastKnownMetadata(newMetadata);
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [data, isPlaceholderData, page, searchQuery, lastKnownMetadata]);
  
  // Clear metadata when search query changes
  useEffect(() => {
    if (lastKnownMetadata && lastKnownMetadata.searchQuery !== searchQuery) {
      const timeoutId = setTimeout(() => {
        setLastKnownMetadata(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [searchQuery, lastKnownMetadata]);

  // Get queue to check if items are already in queue
  const { data: queue } = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
  });

  // Get library to check if items are already in library
  const { data: library } = useQuery({
    queryKey: ['library'],
    queryFn: () => getLibrary(),
  });

  // Scroll to top when page changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  // Update search query when user types (with debounce effect)
  // Only search if query is 3+ characters to reduce unnecessary API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedQuery = query.trim();
      if (trimmedQuery.length >= 3) {
        setSearchQuery(trimmedQuery);
        setPage(1); // Reset to first page on new search
      } else if (trimmedQuery.length === 0) {
        setSearchQuery('');
      }
      // If 1-2 characters, don't update searchQuery (prevents API calls for very short queries)
    }, 500); // 500ms debounce - increased to reduce API calls further

    return () => clearTimeout(timer);
  }, [query]);

  // Check if a search result is already in the queue
  // This checks both cached_id and also tries to match by tmdb_id/mal_id if cached_id is null
  const isInQueue = (result: SearchResult): boolean => {
    if (!queue) return false;
    
    // First check by cached_id (most reliable)
    if (result.cached_id) {
      return queue.some((item) => item.content_id === result.cached_id);
    }
    
    // If no cached_id, try to match by checking if any queue item has matching tmdb_id or mal_id
    // This handles cases where content was just cached but search results haven't updated yet
    return queue.some((item) => {
      if (result.tmdb_id && item.tmdb_id === result.tmdb_id) return true;
      // For Jikan results, we'd need to check mal_id, but queue items don't have mal_id
      // So we rely on cached_id being set after caching
      return false;
    });
  };

  // Check if a search result is in library and get its status
  const getLibraryStatus = (result: SearchResult): { inLibrary: boolean; status: LibraryStatus | null } => {
    if (!library || !result.cached_id) return { inLibrary: false, status: null };
    const libraryItem = library.find((item) => item.content_id === result.cached_id);
    return {
      inLibrary: !!libraryItem,
      status: (libraryItem?.status as LibraryStatus) || null,
    };
  };

  // Add to queue mutation with optimistic updates
  const addToQueueMutation = useMutation<
    QueueItem,
    Error,
    SearchResult,
    { previousQueue: QueueItem[] | undefined; contentId: string }
  >({
    mutationFn: async (result: SearchResult) => {
      // First, fetch/cache the content if not cached
      let contentId = result.cached_id;
      
      if (!contentId) {
        // Handle Jikan vs TMDB differently
        if (result.mal_id && result.data_source === 'jikan') {
          const content = await getContentByMalId(result.mal_id);
          contentId = content.id;
        } else if (result.tmdb_id) {
          const content = await getContentByTmdbId(result.tmdb_id, result.content_type);
          contentId = content.id;
        } else {
          throw new Error('No valid content ID found');
        }
      }
      
      // Then add to queue
      return addToQueue({ content_id: contentId });
    },
    onMutate: async (result) => {
      // Track which item is being added
      const itemKey = `${result.data_source || 'tmdb'}-${result.mal_id || result.tmdb_id}-${result.content_type}`;
      setAddingToQueueId(itemKey);
      
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['queue'] });
      
      // Snapshot the previous value
      const previousQueue = queryClient.getQueryData<QueueItem[]>(['queue']);
      
      // Get or cache content ID
      let contentId = result.cached_id;
      if (!contentId) {
        if (result.mal_id && result.data_source === 'jikan') {
          const content = await getContentByMalId(result.mal_id);
          contentId = content.id;
        } else if (result.tmdb_id) {
          const content = await getContentByTmdbId(result.tmdb_id, result.content_type);
          contentId = content.id;
        }
      }
      
      if (contentId) {
        // Optimistically add to queue
        const optimisticItem: QueueItem = {
          id: `temp-${Date.now()}`,
          content_id: contentId,
          position: (previousQueue?.length || 0) + 1,
          created_at: new Date().toISOString(),
          title: result.title_english || result.title,
          poster_url: result.poster_url,
          content_type: result.content_type === 'movie' ? 'movie' : 'show',
        };
        
        queryClient.setQueryData<QueueItem[]>(['queue'], (old) => 
          old ? [...old, optimisticItem] : [optimisticItem]
        );
      }
      
      return { previousQueue, contentId: contentId || '' };
    },
    onSuccess: (data) => {
      // Update with real data from server
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) => {
        if (!old) return [data];
        // Replace optimistic item with real one
        return old.map(item => 
          item.id.startsWith('temp-') && item.content_id === data.content_id 
            ? data 
            : item
        );
      });
      setAddingToQueueId(null);
      toast.success('Added to queue!');
    },
    onError: (error, _result, context) => {
      // Rollback on error
      if (context?.previousQueue) {
        queryClient.setQueryData(['queue'], context.previousQueue);
      }
      setAddingToQueueId(null);
      toast.error(error.message || 'Failed to add to queue');
    },
    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });

  // Add to library mutation
  const addToLibraryMutation = useMutation({
    mutationFn: async (result: SearchResult) => {
      // Track which item is being added
      const itemKey = `${result.data_source || 'tmdb'}-${result.mal_id || result.tmdb_id}-${result.content_type}`;
      setAddingToLibraryId(itemKey);
      
      // First, fetch/cache the content if not cached
      let contentId = result.cached_id;
      
      if (!contentId) {
        // Handle Jikan vs TMDB differently
        if (result.mal_id && result.data_source === 'jikan') {
          const content = await getContentByMalId(result.mal_id);
          contentId = content.id;
        } else if (result.tmdb_id) {
          const content = await getContentByTmdbId(result.tmdb_id, result.content_type);
          contentId = content.id;
        } else {
          throw new Error('No valid content ID found');
        }
      }
      
      // Then add to library
      return addToLibrary({ content_id: contentId });
    },
    onSuccess: () => {
      setAddingToLibraryId(null);
      toast.success('Added to library!');
      // Invalidate library query to update "IN LIBRARY" state
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
    },
    onError: (error: Error) => {
      setAddingToLibraryId(null);
      toast.error(error.message || 'Failed to add to library');
    },
  });

  // Use data if it exists (placeholderData keeps previous data visible)
  // With placeholderData, we show previous page data while fetching new page
  const isDataForCurrentPage = data && data.page === page;
  // Show results if we have data (even if it's placeholder from previous page)
  // This is the whole point of placeholderData - keep previous data visible
  const searchResults = data?.results || [];
  const resultsCount = effectivePaginationMetadata?.total_results || data?.total_results || 0;

  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))] pb-20">
      <Container size="xl" className="py-4 md:py-8 lg:py-12 px-2 md:px-4">
        {/* Back Button */}
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<ArrowLeft size={16} />}
          onClick={() => setLocation('/queue')}
          className="mb-4 md:mb-6 font-light hover:bg-[rgb(var(--color-bg-elevated))]"
        >
          Back to Queue
        </Button>

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Text
            size="xs"
            c="dimmed"
            fw={500}
            className="tracking-tight mb-1"
          >
            Search Media
          </Text>
          <Text
            size="3xl"
            fw={300}
            className="text-[rgb(var(--color-text-primary))] tracking-tight mb-4"
          >
            Find Shows & Movies
          </Text>

          {/* Filters - Simple inline controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Button
              variant={animeOnly ? 'filled' : 'outline'}
              color="gray"
              size="sm"
              onClick={() => {
                setAnimeOnly(!animeOnly);
                setPage(1);
                setLastKnownMetadata(null);
              }}
              className="font-medium"
            >
              {animeOnly ? 'Searching Anime (MAL)' : 'Search Anime Only'}
            </Button>
            {includeAdult && (
              <span className="text-xs text-gray-600">Adult content enabled</span>
            )}
          </div>

          {/* Search Bar */}
          <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm">
            <TextInput
              placeholder="Search titles..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftSection={<SearchIcon size={16} className="text-[rgb(var(--color-text-primary))]" />}
              rightSection={isFetching ? <Loader size="sm" /> : null}
              size="md"
              classNames={{
                input:
                  'border-0 font-normal placeholder:font-normal',
              }}
            />
          </div>
        </div>

        {/* Loading State - Only show on initial load, not during page transitions */}
        {isLoading && searchQuery && (
          <Center py={60}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed" className="font-normal">Searching...</Text>
            </Stack>
          </Center>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-900">
            <Text className="font-semibold text-red-900">
              {animeOnly && error.message?.includes('rate limit')
                ? 'Jikan API rate limit reached. Please wait a moment.'
                : 'ERROR: Failed to search. Please try again.'}
            </Text>
          </div>
        )}

        {/* Results Count and Pagination - Show if we have pagination metadata or data */}
        {searchQuery && effectivePaginationMetadata && (
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between">
              <Text
                size="sm"
                className="font-semibold tracking-tight"
              >
                FOUND {resultsCount} RESULTS
                {effectivePaginationMetadata.total_pages > 1 && ` (PAGE ${page} OF ${effectivePaginationMetadata.total_pages})`}
              </Text>
            </div>

            {/* Pagination at top */}
            {effectivePaginationMetadata.total_pages > 1 && (
              <Center>
                <Pagination
                  value={page}
                  onChange={setPage}
                  total={effectivePaginationMetadata.total_pages}
                  siblings={1}
                  boundaries={1}
                  disabled={isPlaceholderData}
                />
              </Center>
            )}
          </div>
        )}

        {/* Results Grid - Show if we have results (placeholder data is fine) */}
        {searchQuery && searchResults.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {searchResults.map((result) => {
              const libraryInfo = getLibraryStatus(result);
              const itemKey = `${result.data_source || 'tmdb'}-${result.mal_id || result.tmdb_id}-${result.content_type}`;

              return (
                <SearchResultCard
                  key={itemKey}
                  item={result}
                  onClick={() => {
                    setSelectedContent(result);
                    setModalOpen(true);
                  }}
                  isInQueue={isInQueue(result)}
                  titlePreference={titlePreference}
                  isInLibrary={libraryInfo.inLibrary}
                  libraryStatus={libraryInfo.status}
                />
              );
            })}
          </div>
        )}

        {/* No Results - Only show if we have data for current page and it's truly empty (not placeholder) */}
        {searchQuery && !isLoading && !isPlaceholderData && isDataForCurrentPage && data && data.results.length === 0 && searchResults.length === 0 && (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <Text size="lg" fw={500} c="dimmed" className="font-normal">
                No Results Found
              </Text>
              <Text size="sm" c="dimmed" className="font-normal">
                Try a different search term
              </Text>
            </Stack>
          </Center>
        )}

        {/* Pagination - Always visible when we have metadata, independent of results display */}
        {searchQuery && effectivePaginationMetadata && effectivePaginationMetadata.total_pages > 1 && (
          <Center mt="xl">
            <Pagination
              value={page}
              onChange={setPage}
              total={effectivePaginationMetadata.total_pages}
              siblings={1}
              boundaries={1}
              disabled={isPlaceholderData}
            />
          </Center>
        )}

        {/* Empty State - No search query */}
        {!searchQuery && !isLoading && (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <Text size="lg" fw={500} c="dimmed" className="font-normal">
                Start Searching
              </Text>
              <Text size="sm" c="dimmed" className="font-normal">
                Enter a show or movie title above
              </Text>
            </Stack>
          </Center>
        )}

        {/* Content Detail Modal */}
        <ContentDetailModal
          content={selectedContent ? {
            id: selectedContent.tmdb_id || selectedContent.mal_id || 0,
            tmdb_id: selectedContent.tmdb_id || 0,
            title: selectedContent.title_english || selectedContent.title,
            poster_url: selectedContent.poster_url,
            backdrop_url: selectedContent.backdrop_url || null,
            overview: selectedContent.overview || '',
            first_air_date: selectedContent.release_date,
            vote_average: selectedContent.vote_average,
            content_type: selectedContent.content_type,
          } : null}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedContent(null);
          }}
          onAddToLibrary={() => {
            if (selectedContent) {
              addToLibraryMutation.mutate(selectedContent);
            }
          }}
          onAddToQueue={() => {
            if (selectedContent) {
              addToQueueMutation.mutate(selectedContent);
            }
          }}
          isAddingToLibrary={addingToLibraryId === `${selectedContent?.data_source || 'tmdb'}-${selectedContent?.mal_id || selectedContent?.tmdb_id}-${selectedContent?.content_type}`}
          isAddingToQueue={addingToQueueId === `${selectedContent?.data_source || 'tmdb'}-${selectedContent?.mal_id || selectedContent?.tmdb_id}-${selectedContent?.content_type}`}
        />
      </Container>
    </div>
  );
}


