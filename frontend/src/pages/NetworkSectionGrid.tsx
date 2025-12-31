import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Modal } from '@mantine/core';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Plus, ListPlus } from 'lucide-react';
import { useState } from 'react';
import { getNetworkContent } from '../api/networks';
import { addToLibrary } from '../api/library';
import { addToQueue, getContentByTmdbId } from '../api/content';

export function NetworkSectionGrid() {
  const [, setLocation] = useLocation();
  const params = useParams<{ networkId: string; section: string }>();
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [contentModalOpen, setContentModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const { networkId, section } = params;

  // Fetch network content
  const { data: networkContent, isLoading } = useQuery({
    queryKey: ['network-content', networkId],
    queryFn: () => getNetworkContent(networkId!, 1),
    enabled: !!networkId,
  });

  // Mutation for adding to library
  const addToLibraryMutation = useMutation({
    mutationFn: async (tmdbId: number) => {
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

  const handleContentClick = (item: any) => {
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

  // Filter and sort content based on section
  const getFilteredContent = () => {
    if (!networkContent?.content) return [];

    const content = networkContent.content;

    switch (section) {
      case 'popular': {
        return [...content].sort((a, b) => 
          (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count)
        );
      }
      
      case 'new': {
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        return content
          .filter(item => item.first_air_date && new Date(item.first_air_date) >= twoYearsAgo)
          .sort((a, b) => new Date(b.first_air_date).getTime() - new Date(a.first_air_date).getTime());
      }
      
      case 'rated': {
        return content
          .filter(item => item.vote_average >= 7.5 && item.vote_count > 100)
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
        return content
          .filter(item => {
            if (!item.first_air_date) return false;
            const year = new Date(item.first_air_date).getFullYear();
            return year >= startYear && year <= endYear;
          })
          .sort((a, b) => (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count));
      }
      
      case 'all':
      default: {
        return [...content].sort((a, b) => 
          (b.vote_average * b.vote_count) - (a.vote_average * a.vote_count)
        );
      }
    }
  };

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

  const filteredContent = getFilteredContent();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Center py={60}>
          <Loader size="lg" />
        </Center>
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
            onClick={() => setLocation('/')}
            className="mb-6"
          >
            Back to Network
          </Button>

          <div className="flex items-center gap-4 mb-2">
            {networkContent?.network.logo_url && (
              <img
                src={networkContent.network.logo_url}
                alt={networkContent.network.name}
                className="h-16 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider">
                {getSectionTitle()}
              </h1>
              <p className="text-sm text-gray-600 font-mono">
                {filteredContent.length} shows
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        {filteredContent.length > 0 ? (
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
        ) : (
          <div className="bg-white border-2 border-gray-900 p-12 text-center">
            <p className="font-bold text-gray-600">No shows found in this section</p>
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
                className="w-full h-auto mb-4 border-2 border-gray-900"
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

