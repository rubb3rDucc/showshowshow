import { Modal, Tabs, Button, Loader, Center } from '@mantine/core';
import { X, Plus, ListPlus, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { getContentCredits, type CrewMember } from '../../api/people';

interface ContentDetailModalProps {
  content: {
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
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToLibrary: () => void;
  onAddToQueue: () => void;
  isAddingToLibrary?: boolean;
  isAddingToQueue?: boolean;
}

export function ContentDetailModal({
  content,
  isOpen,
  onClose,
  onAddToLibrary,
  onAddToQueue,
  isAddingToLibrary = false,
  isAddingToQueue = false,
}: ContentDetailModalProps) {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string | null>('cast');

  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ['content-credits', content?.tmdb_id, content?.content_type],
    queryFn: () => getContentCredits(content!.tmdb_id, content!.content_type),
    enabled: isOpen && !!content,
  });

  if (!content) return null;

  const crewByDepartment = credits?.crew.reduce((acc, member) => {
    const dept = member.department || 'Other';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(member);
    return acc;
  }, {} as Record<string, CrewMember[]>) || {};

  const directors = crewByDepartment['Directing']?.filter(m => m.job === 'Director') || [];
  const year = content.first_air_date?.split('-')[0] || content.release_date?.split('-')[0];

  const handlePersonClick = (personId: number) => {
    setLocation(`/people/${personId}`);
    onClose();
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="xl"
      padding={0}
      withCloseButton={false}
      classNames={{
        content: 'border-4 border-gray-900 bg-gray-50 max-w-[95vw] sm:max-w-xl',
        body: 'p-0',
      }}
    >
      {/* Header with actions (desktop) */}
      <div className="bg-black text-white p-3 sm:p-4 flex justify-between items-center border-b-2 border-[rgb(var(--color-border-default))]">
        <h2 className="truncate pr-2 flex-1">
          {content.title}
        </h2>
        {/* Desktop actions in header */}
        <div className="hidden sm:flex gap-2 ml-4">
          <Button
            className="bg-[rgb(var(--color-bg-surface))] text-black border-2 border-white font-semibold hover:bg-[rgb(var(--color-bg-elevated))]"
            onClick={onAddToLibrary}
            leftSection={<Plus size={14} />}
            loading={isAddingToLibrary}
            size="xs"
          >
            Add
          </Button>
          <Button
            variant="outline"
            className="border-2 border-white text-white font-semibold hover:bg-gray-800"
            onClick={onAddToQueue}
            leftSection={<ListPlus size={14} />}
            loading={isAddingToQueue}
            size="xs"
          >
            Queue
          </Button>
        </div>
        <button
          onClick={onClose}
          className="hover:opacity-70 transition-opacity flex-shrink-0 ml-2"
        >
          <X size={20} strokeWidth={3} className="sm:w-6 sm:h-6" />
        </button>
      </div>

      <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto pb-20 sm:pb-6">
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
          {/* Poster */}
          {content.poster_url && content.poster_url.trim() !== '' && (
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <img
                src={content.poster_url}
                alt={content.title}
                className="w-24 h-36 sm:w-32 sm:h-48 object-cover border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <div className="text-sm text-[rgb(var(--color-text-secondary))] mb-3">
                {year && <span className="font-bold">{year}</span>}
                {directors.length > 0 && (
                  <>
                    {' • Directed by '}
                    {directors.map((director, idx) => (
                      <span key={director.id}>
                        {idx > 0 && ', '}
                        <button
                          onClick={() => handlePersonClick(director.id)}
                          className="hover:underline font-bold"
                        >
                          {director.name}
                        </button>
                      </span>
                    ))}
                  </>
                )}
              </div>

              {/* Overview */}
              {content.overview && (
                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                  {content.overview}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Cast & Crew Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List className="border-b-2 border-gray-900 mb-4">
            <Tabs.Tab 
              value="cast" 
              className="font-semibold text-xs"
            >
              Cast
            </Tabs.Tab>
            <Tabs.Tab 
              value="crew" 
              className="font-semibold text-xs"
            >
              Crew
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="cast">
            {creditsLoading ? (
              <Center className="py-8">
                <Loader size="sm" />
              </Center>
            ) : credits?.cast && credits.cast.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {credits.cast.slice(0, 30).map((actor) => (
                  <div
                    key={actor.id}
                    className="flex items-center gap-2 sm:gap-3 p-2 border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm hover:bg-[rgb(var(--color-bg-elevated))] cursor-pointer transition-colors"
                    onClick={() => handlePersonClick(actor.id)}
                  >
                    {actor.profile_url && actor.profile_url.trim() !== '' ? (
                      <img
                        src={actor.profile_url}
                        alt={actor.name}
                        className="w-10 h-10 sm:w-12 sm:h-12 object-cover border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-[rgb(var(--color-text-secondary))] sm:w-5 sm:h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-xs sm:text-sm truncate">{actor.name}</p>
                      {actor.character && (
                        <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">{actor.character}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-4">No cast information available</p>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="crew">
            {creditsLoading ? (
              <Center className="py-8">
                <Loader size="sm" />
              </Center>
            ) : credits?.crew && credits.crew.length > 0 ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Object.entries(crewByDepartment).map(([dept, members]) => (
                  <div key={dept}>
                    <h3 className="text-xs font-semibold text-[rgb(var(--color-text-tertiary))] mb-2 sticky top-0 bg-[rgb(var(--color-bg-page))] py-1">
                      {dept}
                    </h3>
                    <div className="space-y-2">
                      {members.map((member) => (
                        <div
                          key={`${member.id}-${member.job}`}
                          className="flex items-center gap-3 p-2 border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm hover:bg-[rgb(var(--color-bg-elevated))] cursor-pointer transition-colors"
                          onClick={() => handlePersonClick(member.id)}
                        >
                          {member.profile_url && member.profile_url.trim() !== '' ? (
                            <img
                              src={member.profile_url}
                              alt={member.name}
                              className="w-10 h-10 sm:w-12 sm:h-12 object-cover border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 border border-[rgb(var(--color-border-default))] rounded-lg shadow-sm flex items-center justify-center flex-shrink-0">
                              <User size={18} className="text-[rgb(var(--color-text-secondary))] sm:w-5 sm:h-5" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-xs sm:text-sm truncate">{member.name}</p>
                            <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">{member.job}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-4">No crew information available</p>
            )}
          </Tabs.Panel>
        </Tabs>
      </div>

      {/* Sticky action bar at bottom (mobile only) */}
      <div className="sticky bottom-0 bg-[rgb(var(--color-bg-surface))] border-t-4 border-gray-900 p-4 sm:hidden">
        <div className="flex gap-2">
          <Button
            className="bg-teal-600 hover:bg-teal-700 text-white border-0 font-semibold hover:bg-gray-900 flex-1"
            onClick={onAddToLibrary}
            leftSection={<Plus size={16} />}
            loading={isAddingToLibrary}
            size="sm"
          >
            Add to Library
          </Button>
          <Button
            variant="outline"
            className="border-2 border-black font-semibold hover:bg-[rgb(var(--color-bg-elevated))] flex-1"
            onClick={onAddToQueue}
            leftSection={<ListPlus size={16} />}
            loading={isAddingToQueue}
            size="sm"
          >
            Add to Lineup
          </Button>
        </div>
      </div>
    </Modal>
  );
}

