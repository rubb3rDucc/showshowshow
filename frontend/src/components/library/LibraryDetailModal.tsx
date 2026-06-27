import { useState, useEffect, useRef, useEffectEvent } from 'react';
import { Modal, Drawer, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { X, ListPlus, Trash2, ExternalLink } from 'lucide-react';
import type { LibraryItemUI, LibraryStatus } from '../../types/library.types';
import { getContentByTmdbId } from '../../api/content';
import { EpisodeTracker } from './EpisodeTracker';
import { Button } from '../common/Button';
import { StarRating } from '../common/StarRating';

interface LibraryDetailModalProps {
  item: LibraryItemUI | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: Partial<LibraryItemUI>) => void;
  onAddToQueue: (item: LibraryItemUI) => void;
  onRemove: (id: string) => void;
}

const STATUS_OPTIONS: { value: LibraryStatus; label: string }[] = [
  { value: 'watching', label: 'Watching' },
  { value: 'completed', label: 'Completed' },
  { value: 'plan_to_watch', label: 'Plan to watch' },
  { value: 'dropped', label: 'Dropped' },
];

/** Upgrade a TMDB image URL to full resolution; pass non-TMDB urls through. */
function toOriginal(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/\/t\/p\/w\d+\//, '/t/p/original/');
}

export function LibraryDetailModal({
  item,
  isOpen,
  onClose,
  onSave,
  onAddToQueue,
  onRemove,
}: LibraryDetailModalProps) {
  const theme = useMantineTheme();
  const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.md})`);
  const [, setLocation] = useLocation();

  const [status, setStatus] = useState<LibraryStatus>(item?.status || 'plan_to_watch');
  const [score, setScore] = useState<number | null>(item?.score || null);
  const [posterZoom, setPosterZoom] = useState(false);

  const onStatusChange = useEffectEvent((s: LibraryStatus) => setStatus(s));
  const onScoreChange = useEffectEvent((s: number | null) => setScore(s));

  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<{ status: LibraryStatus; score: number | null } | null>(null);

  // Reset form when the item changes
  useEffect(() => {
    if (item) {
      onStatusChange(item.status as LibraryStatus);
      onScoreChange(item.score || null);
      lastSavedRef.current = { status: item.status, score: item.score };
    }
  }, [item]);

  // Debounced autosave (status + score only — notes deprecated by reviews)
  useEffect(() => {
    if (!item) return;

    const next = { status, score };
    const last = lastSavedRef.current;
    const hasChanged = !last || last.status !== next.status || last.score !== next.score;
    if (!hasChanged) return;

    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    autoSaveTimeout.current = setTimeout(() => {
      onSave({ id: item.id, ...next });
      lastSavedRef.current = next;
    }, 300);

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [item, status, score, onSave]);

  const tmdbId = item?.content.tmdbId ?? null;
  const apiType: 'tv' | 'movie' = item?.content.contentType === 'movie' ? 'movie' : 'tv';

  // Pull backdrop + overview (not in the library payload) when we have a TMDB id
  const { data: fullContent } = useQuery({
    queryKey: ['content', apiType, tmdbId],
    queryFn: () => getContentByTmdbId(tmdbId!, apiType),
    enabled: isOpen && !!tmdbId,
    staleTime: 5 * 60_000,
  });

  if (!item) return null;

  const posterUrl = fullContent?.poster_url ?? item.content.posterUrl;
  const backdropUrl = fullContent?.backdrop_url ?? null;
  const overview = fullContent?.overview ?? item.content.description ?? null;
  const watched = item.progress?.episodesWatched ?? 0;
  const total = item.progress?.totalEpisodes ?? 0;
  const isShow = item.content.contentType === 'show';

  const handleRemove = () => {
    if (confirm('Remove this item from your library?')) {
      onRemove(item.id);
      onClose();
    }
  };

  const content = (
    <div className="bg-[rgb(var(--color-bg-page))] flex flex-col w-full">
      {/* ===== Cinematic hero ===== */}
      <div className="relative">
        <div className="absolute inset-0 overflow-hidden bg-gray-900">
          {backdropUrl ? (
            <img src={backdropUrl} alt="" aria-hidden className="w-full h-full object-cover object-center" />
          ) : posterUrl ? (
            <img
              src={posterUrl}
              alt=""
              aria-hidden
              className="w-full h-full object-cover object-center blur-2xl scale-110 opacity-70"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgb(var(--color-bg-page))] via-black/45 to-black/25" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
        >
          <X size={18} />
        </button>

        <div className="relative px-4 sm:px-6 pt-12 sm:pt-16 pb-5">
          <div className="flex gap-4 sm:gap-6 items-end">
            {/* Poster (click to zoom) */}
            <button
              onClick={() => posterUrl && setPosterZoom(true)}
              className="flex-shrink-0 group"
              aria-label="View full-size poster"
              disabled={!posterUrl}
            >
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={item.content.title}
                  className="w-28 sm:w-40 aspect-[2/3] object-cover rounded-lg shadow-2xl ring-1 ring-black/20 group-hover:ring-2 group-hover:ring-white/50 transition-all"
                />
              ) : (
                <div className="w-28 sm:w-40 aspect-[2/3] rounded-lg bg-gray-700 flex items-center justify-center text-gray-300 text-xs font-semibold">
                  NO POSTER
                </div>
              )}
            </button>

            {/* Identity */}
            <div className="flex-1 min-w-0 text-white pb-1 [text-shadow:0_2px_12px_rgba(0,0,0,0.7)]">
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight leading-tight break-words">
                {item.content.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
                <span className="px-1.5 py-0.5 border border-white/40 rounded text-xs font-semibold">
                  {isShow ? 'SHOW' : 'FILM'}
                </span>
                {isShow && total > 0 && (
                  <span>
                    {watched}/{total} ep
                  </span>
                )}
                {tmdbId && (
                  <button
                    onClick={() =>
                      setLocation(`/content/${apiType}/${tmdbId}?from=lib&cid=${item.contentId}`)
                    }
                    className="inline-flex items-center gap-1 font-semibold text-white hover:underline"
                  >
                    <ExternalLink size={14} /> View full page
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Body ===== */}
      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Synopsis */}
        {overview && (
          <p className="text-[15px] leading-relaxed text-[rgb(var(--color-text-primary))]">{overview}</p>
        )}

        {/* Status */}
        <div>
          <p className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-2">Status</p>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map((opt) => {
              const active = status === opt.value;
              return (
                <Button
                  key={opt.value}
                  variant={active ? 'primary' : 'default'}
                  onClick={() => setStatus(opt.value)}
                  className="w-full"
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Score */}
        <div>
          <p className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-2">Your score</p>
          <StarRating value={score ?? 0} count={10} onChange={(v) => setScore(v || null)} size={28} />
        </div>

        {/* Actions — labeled + spaced so a stray tap while rating doesn't hit a button.
            Kept near the top so they're discoverable without scrolling the episode list. */}
        <div className="pt-2 border-t border-[rgb(var(--color-border-subtle))]">
          <p className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-2">Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant="primary"
              leftIcon={<ListPlus size={16} />}
              onClick={() => onAddToQueue(item)}
              className="w-full"
            >
              Add to Lineup
            </Button>
            <Button
              variant="danger"
              leftIcon={<Trash2 size={16} />}
              onClick={handleRemove}
              className="w-full"
            >
              Remove from library
            </Button>
          </div>
        </div>

        {/* Episode tracker (shows) */}
        {isShow && (
          <div className="pt-1">
            <p className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-2">Episodes</p>
            <EpisodeTracker
              libraryItem={item}
              onEpisodeUpdate={(season, episode) =>
                onSave({ id: item.id, currentSeason: season, currentEpisode: episode })
              }
            />
          </div>
        )}
      </div>

      {/* Full-size poster lightbox */}
      <Modal
        opened={posterZoom}
        onClose={() => setPosterZoom(false)}
        withCloseButton={false}
        padding={0}
        size="auto"
        centered
        classNames={{ content: 'bg-transparent shadow-none', body: 'p-0' }}
      >
        {posterUrl && (
          <img
            src={toOriginal(posterUrl) ?? posterUrl}
            alt={item.content.title}
            onClick={() => setPosterZoom(false)}
            className="max-h-[90vh] w-auto rounded-lg cursor-zoom-out"
          />
        )}
      </Modal>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        opened={isOpen}
        onClose={onClose}
        position="bottom"
        size="auto"
        padding={0}
        withCloseButton={false}
        classNames={{
          content: 'bg-[rgb(var(--color-bg-page))]',
          body: 'p-0 flex flex-col w-full',
        }}
        styles={{
          content: {
            borderTopLeftRadius: '1rem',
            borderTopRightRadius: '1rem',
            maxWidth: '100%',
            maxHeight: '90vh',
          },
          body: { maxHeight: '90vh', overflowY: 'auto' },
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      size="auto"
      padding={0}
      centered
      withCloseButton={false}
      classNames={{ content: 'bg-[rgb(var(--color-bg-page))] shadow-xl', body: 'p-0 w-full' }}
      styles={{
        content: { width: '100%', maxWidth: '760px', maxHeight: '90vh' },
        body: { maxHeight: '90vh', overflowY: 'auto' },
      }}
    >
      {content}
    </Modal>
  );
}
