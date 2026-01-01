import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Container, Button, Loader, Center, Text, Tabs, Anchor } from '@mantine/core';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Plus, ListPlus, ExternalLink } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { getPersonDetails, type PersonWithCredits } from '../api/people';
import { addToLibrary } from '../api/library';
import { addToQueue, getContentByTmdbId } from '../api/content';
import { ContentDetailModal } from '../components/browse/ContentDetailModal';

interface ContentItem {
  id: number;
  tmdb_id?: number;
  title: string;
  name?: string;
  poster_url: string | null;
  poster_path?: string | null;
  overview?: string;
  first_air_date?: string;
  release_date?: string;
  media_type?: 'tv' | 'movie';
  content_type?: 'show' | 'movie';
}

export function PersonDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ tmdbId: string }>();
  const [selectedContent, setSelectedContent] = useState<any | null>(null);
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
      
      const contentType = selectedContent.media_type === 'tv' || selectedContent.content_type === 'show' 
        ? 'show' 
        : 'movie';
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
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add to library');
    },
  });

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: async () => {
      if (!selectedContent) throw new Error('No content selected');
      
      const contentType = selectedContent.media_type === 'tv' || selectedContent.content_type === 'show'
        ? 'show' 
        : 'movie';
      const tmdbId = selectedContent.id || selectedContent.tmdb_id;
      
      // Get or cache content (getContentByTmdbId automatically caches if needed)
      const content = await getContentByTmdbId(tmdbId, contentType);
      
      if (!content || !content.id) {
        throw new Error('Failed to fetch or cache content. Please try again.');
      }
      
      return addToQueue({
        content_id: content.id,
        season: contentType === 'show' ? 1 : null,
        episode: contentType === 'show' ? 1 : null,
      });
    },
    onSuccess: () => {
      toast.success('Added to lineup!');
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      setContentModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add to lineup');
    },
  });

  const handleContentClick = (item: ContentItem) => {
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
    const seen = new Set();
    return person.cast.filter((item: ContentItem) => {
      const id = item.id || item.tmdb_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [person?.cast]);

  const deduplicatedCrewByDepartment = useMemo(() => {
    if (!person?.crew_by_department) return {};
    const result: Record<string, ContentItem[]> = {};
    Object.keys(person.crew_by_department).forEach((dept) => {
      const seen = new Set();
      result[dept] = person.crew_by_department[dept].filter((item: ContentItem) => {
        const id = item.id || item.tmdb_id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    });
    return result;
  }, [person?.crew_by_department]);

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
      <Container size="xl" className="py-8">
        {/* Back button */}
        <div className="mb-6">
          <Button
            variant="outline"
            leftSection={<ArrowLeft size={16} />}
            onClick={() => window.history.back()}
            className="border-2 border-gray-900 font-black uppercase hover:bg-gray-100"
          >
            Back
          </Button>
        </div>

        {/* Person Info */}
        <div className="bg-white border-4 border-gray-900 p-6 mb-8">
          <div className="flex gap-6">
            {/* Profile Photo */}
            {person.profile_url && person.profile_url.trim() !== '' && (
              <div className="flex-shrink-0">
                <img
                  src={person.profile_url}
                  alt={person.name}
                  className="w-48 h-64 object-cover border-2 border-gray-900"
                />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-4xl font-black uppercase tracking-wider mb-2">
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
                  {bioText.length > 300 && (
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={() => setShowFullBio(!showFullBio)}
                      className="mt-2 p-0 h-auto font-bold"
                    >
                      {showFullBio ? 'Show less' : 'Read more'}
                    </Button>
                  )}
                  <Anchor
                    href={wikipediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-4 text-sm font-bold inline-flex items-center gap-1"
                  >
                    Wikipedia <ExternalLink size={14} />
                  </Anchor>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filmography */}
        <div className="bg-white border-4 border-gray-900 p-6">
          <h2 className="text-2xl font-black uppercase tracking-wider mb-6">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {deduplicatedCast.map((item: ContentItem) => (
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
                      <p className="mt-2 text-sm font-bold truncate group-hover:text-gray-600 transition-colors">
                        {item.title || item.name}
                      </p>
                    </div>
                  ))}
                </div>
              </Tabs.Panel>
            )}

            {departments.map((dept) => (
              <Tabs.Panel key={dept} value={dept.toLowerCase()}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {deduplicatedCrewByDepartment[dept]?.map((item: ContentItem) => (
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
                      <p className="mt-2 text-sm font-bold truncate group-hover:text-gray-600 transition-colors">
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

