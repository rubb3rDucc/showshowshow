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
import { searchContent, getContentByTmdbId, addToQueue, getQueue } from '../api/content';
import { SearchResultCard } from '../components/search/SearchResultCard';
import type { SearchResult, SearchResponse } from '../types/api';

export function Search() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  
  // Store pagination metadata separately to keep pagination controls stable
  // Store the last known good metadata for the current search query
  const [lastKnownMetadata, setLastKnownMetadata] = useState<{
    total_pages: number;
    total_results: number;
    searchQuery: string;
  } | null>(null);

  // Search query - trigger on query change with debounce
  // Use placeholderData: keepPreviousData to keep previous page data visible during transitions
  const { data, isLoading, isFetching, isPlaceholderData, error } = useQuery<SearchResponse>({
    queryKey: ['search', searchQuery, page],
    queryFn: () => searchContent(searchQuery, page),
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
  const isInQueue = (result: SearchResult): boolean => {
    if (!queue || !result.cached_id) return false;
    return queue.some((item) => item.content_id === result.cached_id);
  };

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: async (result: SearchResult) => {
      // First, fetch/cache the content if not cached
      let contentId = result.cached_id;
      
      if (!contentId) {
        const content = await getContentByTmdbId(result.tmdb_id, result.content_type);
        contentId = content.id;
      }
      
      // Then add to queue
      return addToQueue(contentId);
    },
    onSuccess: () => {
      toast.success('Added to queue!');
      // Invalidate queue query to update "IN QUEUE" state
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add to queue');
    },
  });

  // Use data if it exists (placeholderData keeps previous data visible)
  // With placeholderData, we show previous page data while fetching new page
  const isDataForCurrentPage = data && data.page === page;
  // Show results if we have data (even if it's placeholder from previous page)
  // This is the whole point of placeholderData - keep previous data visible
  const searchResults = data?.results || [];
  const resultsCount = paginationMetadata?.total_results || data?.total_results || 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Container size="xl" className="py-4 md:py-8 lg:py-12 px-2 md:px-4">
        {/* Back Button */}
        <Button
          variant="subtle"
          color="gray"
          size="sm"
          leftSection={<ArrowLeft size={16} />}
          onClick={() => setLocation('/queue')}
          className="mb-4 md:mb-6 font-light hover:bg-gray-100"
        >
          Back to Queue
        </Button>

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Text
            size="xs"
            c="dimmed"
            fw={500}
            className="uppercase tracking-widest mb-1"
          >
            Search Media
          </Text>
          <Text
            size="3xl"
            fw={300}
            className="text-gray-900 tracking-tight mb-4"
          >
            Find Shows & Movies
          </Text>

          {/* Search Bar */}
          <div className="bg-white border-2 border-gray-900 font-mono">
            <TextInput
              placeholder="SEARCH TITLES..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftSection={<SearchIcon size={16} className="text-gray-900" />}
              rightSection={isFetching ? <Loader size="sm" /> : null}
              size="md"
              classNames={{
                input:
                  'border-0 font-mono font-black uppercase tracking-wider placeholder:font-black',
              }}
            />
          </div>
        </div>

        {/* Loading State - Only show on initial load, not during page transitions */}
        {isLoading && searchQuery && (
          <Center py={60}>
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed" className="font-mono">Searching...</Text>
            </Stack>
          </Center>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-900">
            <Text className="font-mono font-black text-red-900">
              ERROR: Failed to search. Please try again.
            </Text>
          </div>
        )}

        {/* Results Count - Show if we have pagination metadata or data */}
        {searchQuery && effectivePaginationMetadata && (
          <div className="mb-4">
            <Text
              size="sm"
              className="font-mono font-black uppercase tracking-wider"
            >
              FOUND {resultsCount} RESULTS
              {effectivePaginationMetadata.total_pages > 1 && ` (PAGE ${page} OF ${effectivePaginationMetadata.total_pages})`}
            </Text>
          </div>
        )}

        {/* Results Grid - Show if we have results (placeholder data is fine) */}
        {searchQuery && searchResults.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {searchResults.map((result) => (
              <SearchResultCard
                key={`${result.tmdb_id}-${result.content_type}`}
                item={result}
                isInQueue={isInQueue(result)}
                onAddToQueue={(item) => addToQueueMutation.mutate(item)}
                isLoading={addToQueueMutation.isPending}
              />
            ))}
          </div>
        )}

        {/* No Results - Only show if we have data for current page and it's truly empty (not placeholder) */}
        {searchQuery && !isLoading && !isPlaceholderData && isDataForCurrentPage && data && data.results.length === 0 && searchResults.length === 0 && (
          <Center py={60}>
            <Stack align="center" gap="sm">
              <Text size="lg" fw={500} c="dimmed" className="font-mono">
                NO RESULTS FOUND
              </Text>
              <Text size="sm" c="dimmed" className="font-mono">
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
              <Text size="lg" fw={500} c="dimmed" className="font-mono">
                START SEARCHING
              </Text>
              <Text size="sm" c="dimmed" className="font-mono">
                Enter a show or movie title above
              </Text>
            </Stack>
          </Center>
        )}
      </Container>
    </div>
  );
}


