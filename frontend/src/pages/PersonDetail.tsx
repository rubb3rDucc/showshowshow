import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Tabs } from '@mantine/core';
import { useParams } from 'wouter';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { getPersonDetails, type PersonFilmographyItem } from '../api/people';
import { addToLibrary } from '../api/library';
import { addToQueue, getContentByTmdbId } from '../api/content';
import { ContentDetailModal } from '../components/browse/ContentDetailModal';

export function PersonDetail() {
  const params = useParams<{ tmdbId: string }>();
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
  const [activeTab, setActiveTab] = useState<string | null>('acting');
  const [showFullBio, setShowFullBio] = useState(false);
  const queryClient = useQueryClient();

  const { tmdbId } = params;

  // Fetch person details
  const { data: person, isLoading, error } = useQuery({
    queryKey: ['person', tmdbId],
    queryFn: () => getPersonDetails(Number(tmdbId)),
    enabled: !!tmdbId,
  });

  // Add to library mutation
  const addToLibraryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContent) throw new Error('No content selected');
      
      const contentType = selectedContent.content_type === 'show' ? 'tv' : 'movie';
      const tmdbId = selectedContent.id || selectedContent.tmdb_id;
      
      // Get or cache content (getContentByTmdbId automatically caches if needed)
      const content = await getContentByTmdbId(tmdbId, contentType);
      
      if (!content || !content.id) {
        throw new Error('Failed to fetch or cache content. Please try again.');
      }
      
      return addToLibrary({
        content_id: content.id,
        status: 'plan_to_watch' as const,
      });
    },
    onSuccess: () => {
      toast.success('Added to library!');
      queryClient.invalidateQueries({ queryKey: ['library'] });
      setContentModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add to library');
    },
  });

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContent) throw new Error('No content selected');
      
      const contentType = selectedContent.content_type === 'show' ? 'tv' : 'movie';
      const tmdbId = selectedContent.id || selectedContent.tmdb_id;
      
      // Get or cache content (getContentByTmdbId automatically caches if needed)
      const content = await getContentByTmdbId(tmdbId, contentType);
      
      if (!content || !content.id) {
        throw new Error('Failed to fetch or cache content. Please try again.');
      }
      
      return addToQueue({
        content_id: content.id,
        season: selectedContent.content_type === 'show' ? 1 : null,
        episode: selectedContent.content_type === 'show' ? 1 : null,
      });
    },
    onSuccess: () => {
      toast.success('Added to lineup!');
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      setContentModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add to lineup');
    },
  });

  const handleContentClick = (item: PersonFilmographyItem) => {
    const normalizedItem = {
      id: item.id,
      tmdb_id: item.tmdb_id || item.id,
      title: item.title || item.name || 'Unknown Title',
      poster_url: item.poster_url || (item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null),
      backdrop_url: null,
      overview: item.overview || '',
      first_air_date: item.first_air_date,
      release_date: item.release_date,
      content_type: (item.media_type === 'tv' || item.content_type === 'show') ? 'show' as const : 'movie' as const,
    };
    setSelectedContent(normalizedItem);
    setContentModalOpen(true);
  };

  const handleAddToLibrary = () => {
    addToLibraryMutation.mutate();
  };

  const handleAddToQueue = () => {
    addToQueueMutation.mutate();
  };

  // Get primary department tabs (must be before conditional returns)
  const departments = person ? Object.keys(person.crew_by_department || {}) : [];
  const hasCast = person?.cast && person.cast.length > 0;
  
  // Determine default tab
  const defaultTab = hasCast ? 'acting' : departments[0]?.toLowerCase() || 'acting';

  // Deduplicate content by TMDB ID (must be before conditional returns)
  const deduplicatedCast = useMemo(() => {
    if (!person?.cast) return [];
    const seen = new Set<number>();
    return person.cast.filter((item: PersonFilmographyItem) => {
      const id = item.id || item.tmdb_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [person]);

  const deduplicatedCrewByDepartment = useMemo(() => {
    if (!person?.crew_by_department) return {};
    const result: Record<string, PersonFilmographyItem[]> = {};
    Object.keys(person.crew_by_department).forEach((dept) => {
      const seen = new Set<number>();
      result[dept] = person.crew_by_department[dept].filter((item: PersonFilmographyItem) => {
        const id = item.id || item.tmdb_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    });
    return result;
  }, [person]);

  // Truncate biography (must be before conditional returns)
  const bioText = person?.biography || '';
  const truncatedBio = bioText.length > 300 ? bioText.substring(0, 300) + '...' : bioText;
  const displayBio = showFullBio ? bioText : truncatedBio;
  const wikipediaUrl = person?.name 
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(person.name.replace(/ /g, '_'))}`
    : '';

  if (isLoading) {
    return (
      <Container size="xl" className="py-8">
        <Center className="h-64">
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" className="py-8">
        <div className="bg-white border-2 border-gray-900 p-12 text-center">
          <p className="font-bold text-red-600 mb-2">Error loading person</p>
          <p className="text-sm text-gray-600">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </p>
        </div>
      </Container>
    );
  }

  if (!person) {
    return (
      <Container size="xl" className="py-8">
        <div className="bg-white border-2 border-gray-900 p-12 text-center">
          <p className="font-bold text-gray-600">Person not found</p>
        </div>
      </Container>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Container size="xl" className="py-4 sm:py-8 px-4 sm:px-6">
        {/* Back button */}
        <div className="mb-4 sm:mb-6">
          <Button
            variant="outline"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => window.history.back()}
            className="border-2 border-gray-900 font-black uppercase hover:bg-gray-100"
            size="sm"
          >
            Back
          </Button>
        </div>

        {/* Person Info */}
        <div className="bg-white border-4 border-gray-900 p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            {/* Profile Photo */}
            {person.profile_url && person.profile_url.trim() !== '' && (
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <img
                  src={person.profile_url}
                  alt={person.name}
                  className="w-32 h-48 sm:w-40 sm:h-56 md:w-48 md:h-64 object-cover border-2 border-gray-900"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider mb-2 break-words">
                {person.name}
              </h1>
              
              {person.known_for_department && (
                <p className="text-sm text-gray-600 font-mono font-bold mb-4">
                  Known for: {person.known_for_department}
                </p>
              )}

              {person.birthday && (
                <p className="text-sm text-gray-600 font-mono mb-2">
                  Born: {person.birthday}
                  {person.place_of_birth && ` in ${person.place_of_birth}`}
                </p>
              )}

              {bioText && (
                <div className="mt-4">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {displayBio}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {bioText.length > 300 && (
                      <Button
                        variant="subtle"
                        size="xs"
                        onClick={() => setShowFullBio(!showFullBio)}
                        className="p-0 h-auto font-bold"
                      >
                        {showFullBio ? 'Show less' : 'Read more'}
                      </Button>
                    )}
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => window.open(wikipediaUrl, '_blank', 'noopener,noreferrer')}
                      className="p-0 h-auto font-bold inline-flex items-center gap-1"
                      leftSection={<ExternalLink size={14} />}
                    >
                      Wikipedia
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filmography */}
        <div className="bg-white border-4 border-gray-900 p-4 sm:p-6">
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider mb-4 sm:mb-6">
            Filmography
          </h2>

          <Tabs value={activeTab || defaultTab} onChange={setActiveTab}>
            <Tabs.List className="border-b-2 border-gray-900 mb-6">
              {hasCast && (
                <Tabs.Tab 
                  value="acting" 
                  className="font-black uppercase text-sm"
                >
                  Acting ({deduplicatedCast.length})
                </Tabs.Tab>
              )}
              {departments.map((dept) => (
                <Tabs.Tab 
                  key={dept}
                  value={dept.toLowerCase()} 
                  className="font-black uppercase text-sm"
                >
                  {dept} ({deduplicatedCrewByDepartment[dept]?.length || 0})
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {hasCast && (
              <Tabs.Panel value="acting">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                  {deduplicatedCast.map((item: PersonFilmographyItem) => (
                    <div 
                      key={`${item.id}-${item.title || item.name}`}
                      className="cursor-pointer group"
                      onClick={() => handleContentClick(item)}
                    >
                      {(item.poster_url && item.poster_url.trim() !== '') || item.poster_path ? (
                        <img 
                          src={item.poster_url && item.poster_url.trim() !== '' ? item.poster_url : `https://image.tmdb.org/t/p/w500${item.poster_path}`}
                          alt={item.title || item.name}
                          className="w-full h-auto object-cover border-2 border-gray-900 group-hover:border-4 transition-all"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-gray-200 border-2 border-gray-900 flex items-center justify-center">
                          <span className="text-xs font-black text-gray-600 text-center px-2">
                            NO IMAGE
                          </span>
                        </div>
                      )}
                      <p className="mt-1 sm:mt-2 text-xs sm:text-sm font-bold truncate group-hover:text-gray-600 transition-colors">
                        {item.title || item.name}
                      </p>
                    </div>
                  ))}
                </div>
              </Tabs.Panel>
            )}

            {departments.map((dept) => (
              <Tabs.Panel key={dept} value={dept.toLowerCase()}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4">
                  {deduplicatedCrewByDepartment[dept]?.map((item: PersonFilmographyItem) => (
                    <div 
                      key={`${item.id}-${item.title || item.name}`}
                      className="cursor-pointer group"
                      onClick={() => handleContentClick(item)}
                    >
                      {(item.poster_url && item.poster_url.trim() !== '') || item.poster_path ? (
                        <img 
                          src={item.poster_url && item.poster_url.trim() !== '' ? item.poster_url : `https://image.tmdb.org/t/p/w500${item.poster_path}`}
                          alt={item.title || item.name}
                          className="w-full h-auto object-cover border-2 border-gray-900 group-hover:border-4 transition-all"
                        />
                      ) : (
                        <div className="w-full aspect-[2/3] bg-gray-200 border-2 border-gray-900 flex items-center justify-center">
                          <span className="text-xs font-black text-gray-600 text-center px-2">
                            NO IMAGE
                          </span>
                        </div>
                      )}
                      <p className="mt-1 sm:mt-2 text-xs sm:text-sm font-bold truncate group-hover:text-gray-600 transition-colors">
                        {item.title || item.name}
                      </p>
                    </div>
                  ))}
                </div>
              </Tabs.Panel>
            ))}
          </Tabs>
        </div>
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

