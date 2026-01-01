import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Text } from '@mantine/core';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { useState, useMemo, useReducer, useEffect } from 'react';
import { toast } from 'sonner';
import { getNetworkContent, type NetworkContent } from '../api/networks';
import { addToLibrary } from '../api/library';
import { addToQueue, getContentByTmdbId } from '../api/content';
import { LazyImage } from '../components/browse/LazyImage';
import { ContentDetailModal } from '../components/browse/ContentDetailModal';

interface Content {
  id: number;
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  backdrop_url?: string | null;
  overview: string;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  content_type?: 'show' | 'movie';
}

type AccumulatedContentAction =
  | { type: 'ADD_PAGE'; page: number; content: Content[] }
  | { type: 'RESET' };

function accumulatedContentReducer(
  state: Map<number, Content[]>,
  action: AccumulatedContentAction
): Map<number, Content[]> {
  switch (action.type) {
    case 'ADD_PAGE': {
      const newState = new Map(state);
      newState.set(action.page, action.content);
      return newState;
    }
    case 'RESET': {
      return new Map();
    }
    default:
      return state;
  }
}

export function NetworkSectionGrid() {
  const [, setLocation] = useLocation();
  const params = useParams<{ networkId: string; section: string }>();
  const [selectedContent, setSelectedContent] = useState<{
    id: number;
    tmdb_id: number;
    title: string;
    poster_url: string | null;
    backdrop_url: string | null;
    overview: string;
    first_air_date?: string;
    release_date?: string;
    vote_average?: number;
    content_type: 'show' | 'movie';
  } | null>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { networkId, section } = params;
  
  // Reset currentPage and accumulated pages when networkId changes
  // Using useMemo to derive state from networkId instead of useEffect
  const [currentPage, setCurrentPage] = useState(1);
  const [accumulatedPages, dispatch] = useReducer(accumulatedContentReducer, new Map());
  const [lastNetworkId, setLastNetworkId] = useState(networkId);
  
  // Reset state when network changes (derived state pattern)
  if (networkId !== lastNetworkId) {
    setLastNetworkId(networkId);
    setCurrentPage(1);
    dispatch({ type: 'RESET' });
  }

  console.log('NetworkSectionGrid params:', { networkId, section, fullParams: params });

  // Use regular query with manual pagination - workaround for React Query v5 issue
  // Hooks must be called before any early returns
  const {
    data,
    isLoading,
    error,
    isFetching,
  } = useQuery<NetworkContent, Error>({
    queryKey: ['network-content', networkId, currentPage],
    queryFn: async () => {
      console.log('Fetching page:', currentPage);
      if (!networkId) throw new Error('Network ID is required');
      const result = await getNetworkContent(networkId, currentPage);
      console.log('Fetched result:', result);
      return result;
    },
    enabled: !!networkId && !!section,
    staleTime: 1000 * 60 * 5,
    retry: 1,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Update accumulated pages when data changes using reducer
  useEffect(() => {
    if (data?.content) {
      // If we're on page 1, reset first
      if (currentPage === 1) {
        dispatch({ type: 'RESET' });
      }
      dispatch({ type: 'ADD_PAGE', page: currentPage, content: data.content });
    }
  }, [data, currentPage]);

  // Derive accumulated content from reducer state
  const accumulatedContent = useMemo(() => {
    const allPages = Array.from(accumulatedPages.values());
    const allContent = allPages.flat();
    // Remove duplicates by id
    const uniqueContent = Array.from(
      new Map(allContent.map(item => [item.id, item])).values()
    );
    return uniqueContent;
  }, [accumulatedPages]);

  const network = data?.network;
  const hasNextPage = data && data.page < data.total_pages;

  const handleLoadMore = () => {
    if (!isFetching && hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Mutation for adding to library
  const addToLibraryMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      // This will automatically cache the content if it doesn't exist
      const content = await getContentByTmdbId(tmdbId, 'tv');
      
      if (!content || !content.id) {
        throw new Error('Failed to fetch or cache content. Please try again.');
      }
      
      return addToLibrary({
        content_id: content.id,
        status: 'plan_to_watch' as const,
      });
    },
    onSuccess: () => {
      toast.success('Added to Library', {
        description: `${selectedContent?.title} has been added to your library`,
      });
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setContentModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to add to library', {
        description: error.message || 'Something went wrong',
      });
    },
  });

  // Mutation for adding to queue
  const addToQueueMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      // This will automatically cache the content if it doesn't exist
      const content = await getContentByTmdbId(tmdbId, 'tv');
      
      if (!content || !content.id) {
        throw new Error('Failed to fetch or cache content. Please try again.');
      }
      
      return addToQueue({ content_id: content.id });
    },
    onSuccess: () => {
      toast.success('Added to Lineup', {
        description: `${selectedContent?.title} is ready to be scheduled`,
      });
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      setContentModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error('Failed to add to lineup', {
        description: error.message || 'Something went wrong',
      });
    },
  });

  const handleContentClick = (item: Content) => {
    const normalizedItem = {
      ...item,
      content_type: 'show' as const, // Network content is always TV shows
      backdrop_url: item.backdrop_url || null,
    };
    setSelectedContent(normalizedItem);
    setContentModalOpen(true);
  };

  const handleAddToLibrary = async () => {
    if (selectedContent?.tmdb_id) {
      addToLibraryMutation.mutate(selectedContent.tmdb_id);
    }
  };

  const handleAddToQueue = async () => {
    if (selectedContent?.tmdb_id) {
      addToQueueMutation.mutate(selectedContent.tmdb_id);
    }
  };

  // Filter and sort content based on section
  const filteredContent = useMemo(() => {
    if (!accumulatedContent.length || !section) return [];

    switch (section) {
      case 'popular': {
        return [...accumulatedContent].sort((a, b) => 
          (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count)
        );
      }
      
      case 'new': {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        return accumulatedContent
          .filter((item: Content) => item.first_air_date && new Date(item.first_air_date) >= twoYearsAgo)
          .sort((a, b) => new Date(b.first_air_date).getTime() - new Date(a.first_air_date).getTime());
      }
      
      case 'rated': {
        return accumulatedContent
          .filter((item: Content) => item.vote_average >= 7.5 && item.vote_count > 100)
          .sort((a, b) => b.vote_average - a.vote_average);
      }
      
      case '80s':
      case '90s':
      case '2000s':
      case '2010s': {
        const decadeMap: Record<string, [number, number]> = {
          '80s': [1980, 1989],
          '90s': [1990, 1999],
          '2000s': [2000, 2009],
          '2010s': [2010, 2019],
        };
        const [startYear, endYear] = decadeMap[section] || [0, 0];
        return accumulatedContent
          .filter((item: Content) => {
            if (!item.first_air_date) return false;
            const year = new Date(item.first_air_date).getFullYear();
            return year >= startYear && year <= endYear;
          })
          .sort((a, b) => (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count));
      }
      
      case 'all':
      default: {
        return [...accumulatedContent].sort((a, b) => 
          (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count)
        );
      }
    }
  }, [accumulatedContent, section]);

  // Early return if required params are missing (after all hooks)
  if (!networkId || !section) {
    console.error('Missing required params:', { networkId, section });

    return (
      <div className="min-h-screen bg-gray-50">
        <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setLocation('/')}
            className="mb-6"
          >
            Back to Browse
          </Button>
          <Center py={60}>
            <Text className="text-gray-600 font-mono">Invalid network or section</Text>
          </Center>
        </Container>
      </div>
    );
  }

  const getSectionTitle = () => {
    const titles: Record<string, string> = {
      'popular': 'Popular',
      'new': 'New Releases',
      'rated': 'Highly Rated',
      '80s': 'Classic 80s',
      '90s': '90s Favorites',
      '2000s': '2000s Era',
      '2010s': '2010s Hits',
      'all': 'All Shows',
    };
    return titles[section || 'all'] || 'Shows';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Center py={60}>
          <Loader size="lg" />
        </Center>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setLocation(`/?network=${networkId}`)}
            className="mb-6"
          >
            Back to Network
          </Button>
          <Center py={60}>
            <div className="bg-red-100 border-2 border-red-900 p-6 text-center">
              <Text className="font-bold text-red-900">
                Failed to load content. Please try again.
              </Text>
              <Text className="text-sm text-red-700 mt-2">
                {error instanceof Error ? error.message : 'Unknown error'}
              </Text>
            </div>
          </Center>
        </Container>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
        {/* Back button and header */}
        <div className="mb-8">
          <Button
            variant="subtle"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => setLocation(`/?network=${networkId}`)}
            className="mb-6"
          >
            Back to Network
          </Button>

          <div className="flex items-center gap-4 mb-2">
            {network?.logo_url && (
              <img
                src={network.logo_url}
                alt={network.name}
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                {getSectionTitle()}
              </h1>
              <p className="text-sm text-gray-600 font-mono">
                {network?.name} • {filteredContent.length} {hasNextPage ? '+' : ''} shows
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        {filteredContent.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredContent.map((item: Content) => (
                <div 
                  key={item.id}
                  className="cursor-pointer group"
                  onClick={() => handleContentClick(item)}
                >
                  {item.poster_url ? (
                    <LazyImage 
                      src={item.poster_url}
                      alt={item.title}
                      className="w-full h-auto object-cover border-2 border-gray-900 group-hover:border-4 transition-all"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-gray-200 border-2 border-gray-900 flex items-center justify-center">
                      <span className="text-xs font-black text-gray-600 text-center px-2">
                        NO IMAGE
                      </span>
                    </div>
                  )}
                  <p className="mt-2 text-sm font-bold truncate group-hover:text-gray-600 transition-colors">
                    {item.title}
                  </p>
                </div>
              ))}
            </div>

            {/* Load more button and status */}
            <div className="py-8">
              <Center className="flex-col gap-4">
                {isFetching && currentPage > 1 ? (
                  // Show loader when fetching additional pages
                  <>
                    <Loader size="md" />
                    <Text className="text-sm text-gray-600 font-mono">
                      Loading more shows...
                    </Text>
                  </>
                ) : hasNextPage ? (
                  // Show button when there are more pages
                  <>
                    <Button
                      onClick={handleLoadMore}
                      size="lg"
                      className="bg-black text-white border-2 border-black font-black uppercase hover:bg-gray-900"
                      disabled={isFetching}
                    >
                      Load More Shows
                    </Button>
                    <Text className="text-sm text-gray-500 font-mono">
                      Showing {filteredContent.length}+ shows in this category
                    </Text>
                  </>
                ) : (
                  // Show completion message
                  <Text className="text-sm text-gray-500 font-mono">
                    That's all {filteredContent.length} shows in this category!
                  </Text>
                )}
              </Center>
            </div>
          </>
        ) : !isLoading ? (
          // Only show "no content" if not loading initial data
          <div className="bg-white border-2 border-gray-900 p-12 text-center">
            <p className="font-bold text-gray-600">No shows found in this section</p>
          </div>
        ) : null}
      </Container>

      {/* Content detail modal */}
      <ContentDetailModal
        content={selectedContent}
        isOpen={contentModalOpen}
        onClose={() => setContentModalOpen(false)}
        onAddToLibrary={handleAddToLibrary}
        onAddToQueue={handleAddToQueue}
        isAddingToLibrary={addToLibraryMutation.isPending}
        isAddingToQueue={addToQueueMutation.isPending}
      />
    </div>
  );
}
