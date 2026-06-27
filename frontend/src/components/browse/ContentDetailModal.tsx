import { Modal } from '@mantine/core';
import { X, Plus, ListPlus, User, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { getContentCredits, type CrewMember } from '../../api/people';
import { Button } from '../common/Button';

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
  const [activeTab, setActiveTab] = useState<'cast' | 'crew'>('cast');

  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ['content-credits', content?.tmdb_id, content?.content_type],
    queryFn: () => getContentCredits(content!.tmdb_id, content!.content_type),
    enabled: isOpen && !!content,
  });

  if (!content) return null;

  const crewByDepartment =
    credits?.crew.reduce((acc, member) => {
      const dept = member.department || 'Other';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(member);
      return acc;
    }, {} as Record<string, CrewMember[]>) || {};

  const directors = crewByDepartment['Directing']?.filter((m) => m.job === 'Director') || [];
  const year = content.first_air_date?.split('-')[0] || content.release_date?.split('-')[0];

  const handlePersonClick = (personId: number) => {
    setLocation(`/people/${personId}`);
    onClose();
  };

  const avatar = (url: string | null | undefined, name: string) =>
    url && url.trim() !== '' ? (
      <img
        src={url}
        alt={name}
        className="w-10 h-10 sm:w-12 sm:h-12 object-cover border border-[rgb(var(--color-border-default))] rounded-lg flex-shrink-0"
      />
    ) : (
      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[rgb(var(--color-bg-elevated))] border border-[rgb(var(--color-border-default))] rounded-lg flex items-center justify-center flex-shrink-0">
        <User size={18} className="text-[rgb(var(--color-text-tertiary))]" />
      </div>
    );

  const loading = (
    <div className="flex justify-center py-8 text-[rgb(var(--color-text-tertiary))]">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="xl"
      padding={0}
      withCloseButton={false}
      classNames={{
        content: 'bg-[rgb(var(--color-bg-page))] rounded-lg shadow-xl max-w-[95vw] sm:max-w-xl',
        body: 'p-0',
      }}
    >
      {/* Header with actions (desktop) */}
      <div className="bg-[rgb(var(--color-bg-surface))] border-b border-[rgb(var(--color-border-subtle))] p-3 sm:p-4 flex justify-between items-center">
        <h2 className="truncate pr-2 flex-1 text-base font-medium text-[rgb(var(--color-text-primary))]">
          {content.title}
        </h2>
        <div className="hidden sm:flex gap-2 ml-4">
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            loading={isAddingToLibrary}
            onClick={onAddToLibrary}
          >
            Add
          </Button>
          <Button
            variant="default"
            leftIcon={<ListPlus size={14} />}
            loading={isAddingToQueue}
            onClick={onAddToQueue}
          >
            Queue
          </Button>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))] transition-colors flex-shrink-0 ml-2"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4 sm:p-6 max-h-[70vh] overflow-y-auto pb-20 sm:pb-6">
        {/* Title Section */}
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">
          {content.poster_url && content.poster_url.trim() !== '' && (
            <div className="flex-shrink-0 mx-auto sm:mx-0">
              <img
                src={content.poster_url}
                alt={content.title}
                className="w-24 h-36 sm:w-32 sm:h-48 object-cover border border-[rgb(var(--color-border-default))] rounded-lg"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="text-sm text-[rgb(var(--color-text-secondary))] mb-3">
              {year && <span className="font-medium text-[rgb(var(--color-text-primary))]">{year}</span>}
              {directors.length > 0 && (
                <>
                  {' · Directed by '}
                  {directors.map((director, idx) => (
                    <span key={director.id}>
                      {idx > 0 && ', '}
                      <button
                        onClick={() => handlePersonClick(director.id)}
                        className="hover:underline font-medium text-[rgb(var(--color-text-primary))]"
                      >
                        {director.name}
                      </button>
                    </span>
                  ))}
                </>
              )}
            </div>

            {content.overview && (
              <p className="text-sm text-[rgb(var(--color-text-secondary))] leading-relaxed">
                {content.overview}
              </p>
            )}
          </div>
        </div>

        {/* Cast & Crew Tabs */}
        <div className="flex gap-4 border-b border-[rgb(var(--color-border-subtle))] mb-4">
          {(['cast', 'crew'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 -mb-px text-xs font-medium capitalize border-b-2 transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'border-[#646cff] text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'cast' &&
          (creditsLoading ? (
            loading
          ) : credits?.cast && credits.cast.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {credits.cast.slice(0, 30).map((actor) => (
                <div
                  key={actor.id}
                  className="flex items-center gap-2 sm:gap-3 p-2 border border-[rgb(var(--color-border-default))] rounded-lg hover:bg-[rgb(var(--color-bg-elevated))] cursor-pointer transition-colors"
                  onClick={() => handlePersonClick(actor.id)}
                >
                  {avatar(actor.profile_url, actor.name)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate text-[rgb(var(--color-text-primary))]">
                      {actor.name}
                    </p>
                    {actor.character && (
                      <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">
                        {actor.character}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-4">
              No cast information available
            </p>
          ))}

        {activeTab === 'crew' &&
          (creditsLoading ? (
            loading
          ) : credits?.crew && credits.crew.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {Object.entries(crewByDepartment).map(([dept, members]) => (
                <div key={dept}>
                  <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-2 sticky top-0 bg-[rgb(var(--color-bg-page))] py-1">
                    {dept}
                  </h3>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={`${member.id}-${member.job}`}
                        className="flex items-center gap-3 p-2 border border-[rgb(var(--color-border-default))] rounded-lg hover:bg-[rgb(var(--color-bg-elevated))] cursor-pointer transition-colors"
                        onClick={() => handlePersonClick(member.id)}
                      >
                        {avatar(member.profile_url, member.name)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate text-[rgb(var(--color-text-primary))]">
                            {member.name}
                          </p>
                          <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">
                            {member.job}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--color-text-tertiary))] py-4">
              No crew information available
            </p>
          ))}
      </div>

      {/* Sticky action bar (mobile only) */}
      <div className="sticky bottom-0 bg-[rgb(var(--color-bg-surface))] border-t border-[rgb(var(--color-border-subtle))] p-4 sm:hidden">
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1"
            leftIcon={<Plus size={16} />}
            loading={isAddingToLibrary}
            onClick={onAddToLibrary}
          >
            Add to Library
          </Button>
          <Button
            variant="default"
            className="flex-1"
            leftIcon={<ListPlus size={16} />}
            loading={isAddingToQueue}
            onClick={onAddToQueue}
          >
            Add to Lineup
          </Button>
        </div>
      </div>
    </Modal>
  );
}
