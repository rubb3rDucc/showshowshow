import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Text } from '@mantine/core';
import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { NetworkGrid } from '../components/browse/NetworkGrid';
import { ContentCarousel } from '../components/browse/ContentCarousel';
import { SectionHeader } from '../components/browse/SectionHeader';
import { NetworkSearch, type SearchFilters } from '../components/browse/NetworkSearch';
import { ContentDetailModal } from '../components/browse/ContentDetailModal';
import { getNetworkContent, type NetworkContent } from '../api/networks';
import { addToLibrary } from '../api/library';
import { addToQueue } from '../api/content';
import { getContentByTmdbId } from '../api/content';

type NetworkContentItem = NetworkContent['content'][number];

export function Browse() {
  const [, setLocation] = useLocation();
  // Initialize from URL params
  const searchParams = new URLSearchParams(window.location.search);
  const initialNetworkId = searchParams.get('network');
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(initialNetworkId);
  const [selectedContent, setSelectedContent] = useState<NetworkContentItem | null>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);
  const queryClient = useQueryClient();

  // Fetch network content when a network is selected
  // Fetch multiple pages to ensure we have at least 12 items per section
  const { data: networkContent, isLoading: isLoadingNetwork } = useQuery({
    queryKey: ['network-content', selectedNetworkId],
    queryFn: async () => {
      if (!selectedNetworkId) return null;

      // Fetch first page to get total_pages info
      const firstPage = await getNetworkContent(selectedNetworkId, 1);

      // Determine how many pages to fetch (max 3, or less if not available)
      const pagesToFetch = Math.min(3, firstPage.total_pages);

      // Fetch additional pages in parallel if needed
      const additionalPages = [];
      for (let i = 2; i <= pagesToFetch; i++) {
        additionalPages.push(getNetworkContent(selectedNetworkId, i));
      }

      const fetchedAdditionalPages = await Promise.all(additionalPages);
      const pages = [firstPage, ...fetchedAdditionalPages];

      // Combine all content from all pages
      const allContent = pages.flatMap(page => page.content);

      // Remove duplicates by tmdb_id
      const uniqueContent = Array.from(
        new Map(allContent.map(item => [item.tmdb_id, item])).values()
      );

      console.log(`Fetched ${pagesToFetch} pages with ${uniqueContent.length} unique shows for ${firstPage.network.name}`);

      // Return in the same format as a single page response
      return {
        network: firstPage.network,
        content: uniqueContent,
        page: 1,
        total_pages: firstPage.total_pages,
        total_results: firstPage.total_results,
      };
    },
    enabled: !!selectedNetworkId,
  });

  // Mutation for adding to library
  const addToLibraryMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      // First fetch the content details to get the content_id
      // Network content is always TV shows, so specify type='tv'
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
      // Network content is always TV shows, so specify type='tv'
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

  const handleNetworkClick = (networkId: string) => {
    console.log('handleNetworkClick called with:', networkId);
    // Directly set the network ID and update URL
    setSelectedNetworkId(networkId);
    // Update URL for sharing/bookmarking
    window.history.pushState({}, '', `/browse?network=${networkId}`);
  };

  const handleBackToNetworks = () => {
    // Clear the network selection
    setSelectedNetworkId(null);
    // Update URL
    window.history.pushState({}, '', '/browse');
  };

  const handleContentClick = (item: NetworkContentItem) => {
    const normalizedItem = {
      ...item,
      content_type: 'show' as const, // Network content is always TV shows
      backdrop_url: null,
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

  // Get date range for new releases
  // const getNewReleasesDateRange = () => {
  //   const currentYear = new Date().getFullYear();
  //   const twoYearsAgo = currentYear - 2;
  //   return `${twoYearsAgo}-${currentYear}`;
  // };

  // Apply search and filters to content
  const applySearchFilters = (content: NetworkContentItem[], filters: SearchFilters) => {
    let filtered = [...content];

    // Text search
    if (filters.query) {
      const query = filters.query.toLowerCase();
      filtered = filtered.filter(item =>
        item.title?.toLowerCase().includes(query) ||
        item.overview?.toLowerCase().includes(query)
      );
    }

    // Decade filter
    if (filters.decade) {
      const decadeMap: Record<string, [number, number]> = {
        '1970s': [1970, 1979],
        '1980s': [1980, 1989],
        '1990s': [1990, 1999],
        '2000s': [2000, 2009],
        '2010s': [2010, 2019],
        '2020s': [2020, 2029],
      };
      const [startYear, endYear] = decadeMap[filters.decade] || [0, 0];
      filtered = filtered.filter(item => {
        if (!item.first_air_date) return false;
        const year = new Date(item.first_air_date).getFullYear();
        return year >= startYear && year <= endYear;
      });
    }

    // Rating filter
    if (filters.minRating) {
      filtered = filtered.filter(item => item.vote_average >= filters.minRating!);
    }

    // Sort
    switch (filters.sortBy) {
      case 'popularity':
        filtered.sort((a, b) => (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count));
        break;
      case 'rating':
        filtered.sort((a, b) => b.vote_average - a.vote_average);
        break;
      case 'recent':
        filtered.sort((a, b) => {
          const dateA = a.first_air_date ? new Date(a.first_air_date).getTime() : 0;
          const dateB = b.first_air_date ? new Date(b.first_air_date).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'alphabetical':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }

    return filtered;
  };

  // Organize content into sections (Apple Music style)
  // Ensures exactly 12 items per section (or less if not available)
  const organizeSections = (content: NetworkContentItem[]) => {
    const ITEMS_PER_SECTION = 12;

    // Helper to ensure exactly 12 items (or less if not available)
    const ensureCount = (items: NetworkContentItem[], count: number = ITEMS_PER_SECTION) => {
      return items.slice(0, count);
    };

    // Sort by popularity (vote_average * vote_count)
    const sortedByPopularity = [...content].sort((a, b) =>
      (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count)
    );

    // Get recent shows (from last 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const recentShows = content
      .filter(item => item.first_air_date && new Date(item.first_air_date) >= twoYearsAgo)
      .sort((a, b) => new Date(b.first_air_date).getTime() - new Date(a.first_air_date).getTime());

    // Get high-rated shows
    const highRated = content
      .filter(item => item.vote_average >= 7.5 && item.vote_count > 100)
      .sort((a, b) => b.vote_average - a.vote_average);

    // Filter by decades
    const getDecadeShows = (startYear: number, endYear: number) => {
      return content
        .filter(item => {
          if (!item.first_air_date) return false;
          const year = new Date(item.first_air_date).getFullYear();
          return year >= startYear && year <= endYear;
        })
        .sort((a, b) => (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count));
    };

    const shows70s = getDecadeShows(1970, 1979);
    const shows80s = getDecadeShows(1980, 1989);
    const shows90s = getDecadeShows(1990, 1999);
    const shows2000s = getDecadeShows(2000, 2009);
    const shows2010s = getDecadeShows(2010, 2019);
    const shows2020s = getDecadeShows(2020, 2029);

    return {
      popular: ensureCount(sortedByPopularity),
      recent: ensureCount(recentShows),
      highRated: ensureCount(highRated),
      decades: {
        '70s': ensureCount(shows70s),
        '80s': ensureCount(shows80s),
        '90s': ensureCount(shows90s),
        '2000s': ensureCount(shows2000s),
        '2010s': ensureCount(shows2010s),
        '2020s': ensureCount(shows2020s),
      },
      all: ensureCount(sortedByPopularity),
      fullList: content,
    };
  };

  // Filtered content based on search
  const filteredContent = useMemo(() => {
    if (!networkContent?.content || !searchFilters) return null;
    return applySearchFilters(networkContent.content, searchFilters);
  }, [networkContent, searchFilters]);

  const handleSearch = (_query: string, filters: SearchFilters) => {
    setSearchFilters(filters);
  };

  const handleClearSearch = () => {
    setSearchFilters(null);
  };

  // Show network detail view (Apple Music style)
  if (selectedNetworkId && networkContent) {
    const sections = organizeSections(networkContent.content || []);

    // Log section sizes for debugging
    console.log('Section sizes:', {
      total: networkContent.content?.length || 0,
      popular: sections.popular.length,
      recent: sections.recent.length,
      highRated: sections.highRated.length,
      '70s': sections.decades['70s'].length,
      '80s': sections.decades['80s'].length,
      '90s': sections.decades['90s'].length,
      '2000s': sections.decades['2000s'].length,
      '2010s': sections.decades['2010s'].length,
      '2020s': sections.decades['2020s'].length,
      all: sections.all.length,
    });

    return (
      <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
        <Container size="xl" className="py-4 md:py-8 px-2 md:px-4"> 
          {/* Back button and network header */}
          <div className="mb-8">
            <Button
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              onClick={handleBackToNetworks}
              className="mb-6"
            >
              Back to Networks
            </Button>

            <div className="flex items-center gap-4 mb-2">
              {networkContent.network.logo_url && (
                <img
                  src={networkContent.network.logo_url}
                  alt={networkContent.network.name}
                  className="max-h-8 sm:max-h-10 md:max-h-12 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {networkContent.network.name}
                </h1>
                <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {networkContent.total_results} shows available
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <NetworkSearch onSearch={handleSearch} onClear={handleClearSearch} />

          {/* Search Results */}
          {searchFilters && filteredContent && (
            <div className="mb-8">
              <div className="mb-4">
                <Text className="text-sm text-[rgb(var(--color-text-secondary))]">
                  {filteredContent.length} results
                  {searchFilters.query && ` for "${searchFilters.query}"`}
                </Text>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredContent.map((item) => (
                  <div
                    key={item.id}
                    className="cursor-pointer group"
                    onClick={() => handleContentClick(item)}
                  >
                    <div
                      className="relative aspect-[2/3] overflow-hidden rounded-lg
                                 bg-gray-100
                                 shadow-sm hover:shadow-xl
                                 transition-all duration-300 ease-out
                                 hover:-translate-y-1
                                 border-2"
                      style={{
                        borderColor: 'rgba(107, 114, 128, 0.3)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.6)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.3)';
                      }}
                    >
                    {item.poster_url ? (
                      <img
                        src={item.poster_url}
                        alt={item.title}
                        className="w-full h-full object-cover
                                   transition-transform duration-500 ease-out
                                   group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <span className="text-xs font-semibold text-gray-400 text-center px-2">
                          NO IMAGE
                        </span>
                      </div>
                    )}
                    </div>
                    <p className="mt-2 text-sm font-semibold truncate group-hover:text-gray-700 transition-colors">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoadingNetwork ? (
            <Center py={60}>
              <Loader size="lg" />
            </Center>
          ) : !searchFilters && (
            <div className="space-y-8">
              {/* Popular Section */}
              {sections.popular.length > 0 && (
                <section>
                  <SectionHeader
                    title="Popular"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/popular`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.popular}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* New Releases Section
              {sections.recent.length > 0 && (
                <section>
                  <SectionHeader
                    title={`New Releases (${getNewReleasesDateRange()})`}
                    icon={<Sparkles size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/new`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.recent}
                    onItemClick={handleContentClick}
                  />
                </section>
              )} */}

              {/* Highly Rated Section */}
              {sections.highRated.length > 0 && (
                <section>
                  <SectionHeader
                    title="Highly Rated"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/rated`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.highRated}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Decades Sections */}

              {sections.decades['2020s'].length > 0 && (
                <section>
                  <SectionHeader
                    title="The 2020s"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/2020s`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.decades['2020s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['2010s'].length > 0 && (
                <section>
                  <SectionHeader
                    title="The 2010s"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/2010s`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.decades['2010s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['2000s'].length > 0 && (
                <section>
                  <SectionHeader
                    title="The 2000s"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/2000s`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.decades['2000s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['90s'].length > 0 && (
                <section>
                  <SectionHeader
                    title="The 90s"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/90s`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.decades['90s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['80s'].length > 0 && (
                <section>
                  <SectionHeader
                    title="The 80s"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/80s`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.decades['80s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['70s'].length > 0 && (
                <section>
                  <SectionHeader
                    title="The 70s"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/70s`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.decades['70s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* All Shows Section - Now as scrollable carousel */}
              {sections.all.length > 0 && (
                <section>
                  <SectionHeader
                    title="All Shows"
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/all`)}
                  />
                  <ContentCarousel<NetworkContentItem>
                    items={sections.all}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}
            </div>
          )}
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

  // Show main browse page with networks
  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
      <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Discover Content
          </h1>
          <p className="text-[rgb(var(--color-text-secondary))] text-sm">
            Browse shows by network or search for specific content
          </p>
        </div>

        {/* Network Grid */}
        <NetworkGrid
          onNetworkClick={handleNetworkClick}
          onSeeAllNetworks={() => setLocation('/networks')}
          limit={12}
          // enableDragDrop={false}
        />

        <div className="text-center">
          <Button
            size="md"
            className="bg-teal-600 hover:bg-teal-700 text-white border-0 font-semibold tracking-tight"
            radius="xs"
            onClick={() => setLocation('/search')}
          >
            Search for Content
          </Button>
        </div>

        {/* Coming Soon Section */}
        {/* <div className="mt-12 bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm p-8"> */}
        {/* <div className="text-center mb-6">
            {/* <Calendar size={48} strokeWidth={2} className="mx-auto mb-4 text-gray-700" />
            <Text size="xl" fw={700} className="mb-2">
              More Discovery Features Coming Soon
            </Text>
            <Text c="dimmed" className="mb-6">
              We're working on trending content, theme filters, and more!
            </Text> */}
        {/* </div> */}
        {/* Temporary Search Link */}



        {/* </div> */}
      </Container>
    </div>
  );
}

