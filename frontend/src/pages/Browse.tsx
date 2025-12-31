import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Text, Modal } from '@mantine/core';
import { useLocation } from 'wouter';
import { Search as SearchIcon, ArrowLeft, TrendingUp, Sparkles, Award, Calendar, Tv, Clock, Plus, ListPlus } from 'lucide-react';
import { toast } from 'sonner';
import { NetworkGrid } from '../components/browse/NetworkGrid';
import { ContentCarousel } from '../components/browse/ContentCarousel';
import { SectionHeader } from '../components/browse/SectionHeader';
import { NetworkSearch, type SearchFilters } from '../components/browse/NetworkSearch';
import { getNetworkContent } from '../api/networks';
import { addToLibrary } from '../api/library';
import { addToQueue } from '../api/content';
import { getContentByTmdbId } from '../api/content';

export function Browse() {
  const [, setLocation] = useLocation();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState<SearchFilters | null>(null);
  const queryClient = useQueryClient();

  // Check for network query parameter on initial mount (for direct links/bookmarks)
  useEffect(() => {
    const searchParams = window.location.search;
    const params = new URLSearchParams(searchParams);
    const networkId = params.get('network');
    
    console.log('Initial mount - Network ID from URL:', networkId);
    
    if (networkId) {
      console.log('Setting initial network ID to:', networkId);
      setSelectedNetworkId(networkId);
    }
  }, []); // Only run on mount

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
      const content = await getContentByTmdbId(tmdbId, 'tv');
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
      const content = await getContentByTmdbId(tmdbId, 'tv');
      return addToQueue(content.id);
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
    window.history.pushState({}, '', `/?network=${networkId}`);
  };

  const handleBackToNetworks = () => {
    // Clear the network selection
    setSelectedNetworkId(null);
    // Update URL
    window.history.pushState({}, '', '/');
  };

  const handleContentClick = async (item: any) => {
    setSelectedContent(item);
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
  const getNewReleasesDateRange = () => {
    const currentYear = new Date().getFullYear();
    const twoYearsAgo = currentYear - 2;
    return `${twoYearsAgo}-${currentYear}`;
  };

  // Apply search and filters to content
  const applySearchFilters = (content: any[], filters: SearchFilters) => {
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
  const organizeSections = (content: any[]) => {
    const ITEMS_PER_SECTION = 12;
    
    // Helper to ensure exactly 12 items (or less if not available)
    const ensureCount = (items: any[], count: number = ITEMS_PER_SECTION) => {
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
    
    const shows80s = getDecadeShows(1980, 1989);
    const shows90s = getDecadeShows(1990, 1999);
    const shows2000s = getDecadeShows(2000, 2009);
    const shows2010s = getDecadeShows(2010, 2019);
    
    return {
      popular: ensureCount(sortedByPopularity),
      recent: ensureCount(recentShows),
      highRated: ensureCount(highRated),
      decades: {
        '80s': ensureCount(shows80s),
        '90s': ensureCount(shows90s),
        '2000s': ensureCount(shows2000s),
        '2010s': ensureCount(shows2010s),
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
      '80s': sections.decades['80s'].length,
      '90s': sections.decades['90s'].length,
      '2000s': sections.decades['2000s'].length,
      '2010s': sections.decades['2010s'].length,
      all: sections.all.length,
    });

    return (
      <div className="min-h-screen bg-gray-50">
        <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
          {/* Back button and network header */}
          <div className="mb-8">
            <Button
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
              onClick={handleBackToNetworks}
              className="mb-6"
            >
              Back to Home
            </Button>

            <div className="flex items-center gap-4 mb-2">
              {networkContent.network.logo_url && (
                <img
                  src={networkContent.network.logo_url}
                  alt={networkContent.network.name}
                  className="h-16 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="text-3xl font-black uppercase tracking-wider">
                  {networkContent.network.name}
                </h1>
                <p className="text-sm text-gray-600 font-mono">
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
                <Text className="font-mono text-sm text-gray-600">
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
                    {item.poster_url ? (
                      <img 
                        src={item.poster_url}
                        alt={item.title}
                        className="w-full h-auto object-cover border-2 border-gray-900 group-hover:border-4 transition-all"
                        loading="lazy"
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
                    icon={<TrendingUp size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/popular`)}
                  />
                  <ContentCarousel
                    items={sections.popular}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* New Releases Section */}
              {sections.recent.length > 0 && (
                <section>
                  <SectionHeader 
                    title={`New Releases (${getNewReleasesDateRange()})`}
                    icon={<Sparkles size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/new`)}
                  />
                  <ContentCarousel
                    items={sections.recent}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Highly Rated Section */}
              {sections.highRated.length > 0 && (
                <section>
                  <SectionHeader 
                    title="Highly Rated" 
                    icon={<Award size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/rated`)}
                  />
                  <ContentCarousel
                    items={sections.highRated}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* Decades Sections */}
              {sections.decades['80s'].length > 0 && (
                <section>
                  <SectionHeader 
                    title="Classic 80s" 
                    icon={<Clock size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/80s`)}
                  />
                  <ContentCarousel
                    items={sections.decades['80s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['90s'].length > 0 && (
                <section>
                  <SectionHeader 
                    title="The 90s" 
                    icon={<Clock size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/90s`)}
                  />
                  <ContentCarousel
                    items={sections.decades['90s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['2000s'].length > 0 && (
                <section>
                  <SectionHeader 
                    title="The 2000s" 
                    icon={<Clock size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/2000s`)}
                  />
                  <ContentCarousel
                    items={sections.decades['2000s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {sections.decades['2010s'].length > 0 && (
                <section>
                  <SectionHeader 
                    title="The 2010s" 
                    icon={<Clock size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/2010s`)}
                  />
                  <ContentCarousel
                    items={sections.decades['2010s']}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}

              {/* All Shows Section - Now as scrollable carousel */}
              {sections.all.length > 0 && (
                <section>
                  <SectionHeader 
                    title="All Shows" 
                    icon={<Tv size={20} strokeWidth={2.5} />}
                    onSeeAll={() => setLocation(`/browse/network/${selectedNetworkId}/all`)}
                  />
                  <ContentCarousel
                    items={sections.all}
                    onItemClick={handleContentClick}
                  />
                </section>
              )}
            </div>
          )}
        </Container>

        {/* Content detail modal */}
        <Modal
          opened={contentModalOpen}
          onClose={() => setContentModalOpen(false)}
          title={selectedContent?.title}
          size="lg"
        >
          {selectedContent && (
            <div>
              {selectedContent.poster_url && (
                <img
                  src={selectedContent.poster_url}
                  alt={selectedContent.title}
                  className="w-40 h-60 mb-4 border-2 border-gray-900"
                />
              )}
              <p className="mb-4">{selectedContent.overview}</p>
              <div className="flex flex-col gap-2">
                <Button
                  className="bg-black text-white border-2 border-black font-black uppercase hover:bg-gray-900"
                  fullWidth
                  onClick={handleAddToLibrary}
                  leftSection={<Plus size={16} />}
                  loading={addToLibraryMutation.isPending}
                >
                  Add to Library
                </Button>
                <Button
                  variant="outline"
                  className="border-2 border-black font-black uppercase hover:bg-gray-100"
                  fullWidth
                  onClick={handleAddToQueue}
                  leftSection={<ListPlus size={16} />}
                  loading={addToQueueMutation.isPending}
                >
                  Add to Lineup
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  // Show main browse page with networks
  return (
    <div className="min-h-screen bg-gray-50">
      <Container size="xl" className="py-4 md:py-8 px-2 md:px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black uppercase tracking-wider mb-2">
            Discover Content
          </h1>
          <p className="text-gray-600 font-mono text-sm">
            Browse shows by network or search for specific content
          </p>
        </div>

        {/* Network Grid */}
        <NetworkGrid 
          onNetworkClick={handleNetworkClick}
          onSeeAllNetworks={() => setLocation('/networks')}
          limit={12}
          enableDragDrop={true}
        />

        {/* Coming Soon Section */}
        <div className="mt-12 bg-white border-2 border-gray-900 p-8">
          <div className="text-center mb-6">
            <Calendar size={48} strokeWidth={2} className="mx-auto mb-4 text-gray-700" />
            <Text size="xl" fw={700} className="mb-2">
              More Discovery Features Coming Soon
            </Text>
            <Text c="dimmed" className="mb-6">
              We're working on trending content, theme filters, and more!
            </Text>
          </div>

          {/* Temporary Search Link */}
          <div className="text-center">
            <Button
              size="md"
              className="bg-black text-white border-2 border-black font-black uppercase tracking-wider"
              radius="xs"
              leftSection={<SearchIcon size={16} />}
              onClick={() => setLocation('/search')}
            >
              Search for Content
            </Button>
          </div>
        </div>
      </Container>
    </div>
  );
}

