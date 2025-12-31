import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Text, Modal } from '@mantine/core';
import { useLocation } from 'wouter';
import { Search as SearchIcon, ArrowLeft, TrendingUp, Sparkles, Award, Calendar, Tv, Clock, Plus, ListPlus } from 'lucide-react';
import { NetworkGrid } from '../components/browse/NetworkGrid';
import { ContentCarousel } from '../components/browse/ContentCarousel';
import { SectionHeader } from '../components/browse/SectionHeader';
import { getNetworkContent } from '../api/networks';
import { addToLibrary } from '../api/library';
import { addToQueue } from '../api/content';
import { getContentByTmdbId } from '../api/content';

export function Browse() {
  const [, setLocation] = useLocation();
  const [selectedNetworkId, setSelectedNetworkId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch network content when a network is selected
  const { data: networkContent, isLoading: isLoadingNetwork } = useQuery({
    queryKey: ['network-content', selectedNetworkId],
    queryFn: () => getNetworkContent(selectedNetworkId!, 1),
    enabled: !!selectedNetworkId,
  });

  // Mutation for adding to library
  const addToLibraryMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      // First fetch the content details to get the content_id
      const content = await getContentByTmdbId(tmdbId);
      return addToLibrary({
        content_id: content.id,
        status: 'plan_to_watch' as const,
      });
    },
    onSuccess: () => {
      console.log('Added to library');
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setContentModalOpen(false);
    },
    onError: (error: Error) => {
      console.error('Failed to add to library:', error.message);
    },
  });

  // Mutation for adding to queue
  const addToQueueMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
      const content = await getContentByTmdbId(tmdbId);
      return addToQueue(content.id);
    },
    onSuccess: () => {
      console.log('Added to lineup');
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      setContentModalOpen(false);
    },
    onError: (error: Error) => {
      console.error('Failed to add to lineup:', error.message);
    },
  });

  const handleNetworkClick = (networkId: string) => {
    setSelectedNetworkId(networkId);
  };

  const handleBackToNetworks = () => {
    setSelectedNetworkId(null);
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

  // Organize content into sections (Apple Music style)
  const organizeSections = (content: any[]) => {
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
      popular: sortedByPopularity.slice(0, 12),
      recent: recentShows.slice(0, 12),
      highRated: highRated.slice(0, 12),
      decades: {
        '80s': shows80s.slice(0, 12),
        '90s': shows90s.slice(0, 12),
        '2000s': shows2000s.slice(0, 12),
        '2010s': shows2010s.slice(0, 12),
      },
      all: sortedByPopularity.slice(0, 12), // Show top 12 for "All Shows" carousel
      fullList: content, // Keep full list for future use
    };
  };

  // Show network detail view (Apple Music style)
  if (selectedNetworkId && networkContent) {
    const sections = organizeSections(networkContent.content || []);

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
              Back to Networks
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

          {isLoadingNetwork ? (
            <Center py={60}>
              <Loader size="lg" />
            </Center>
          ) : (
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
                    title="90s Favorites" 
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
                    title="2000s Era" 
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
                    title="2010s Hits" 
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
        <NetworkGrid onNetworkClick={handleNetworkClick} />

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

