import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { getLibrary, removeFromLibrary, addToLibrary } from '../../api/library';
import { useUpdateLibraryItem } from '../../hooks/useUpdateLibraryItem';
import { CategoryBadge } from './CategoryBadge';
import {
  buildNeedsYou,
  CATEGORY_META,
  NEEDS_YOU_VISIBLE,
  type NeedsYouItem,
} from '../../utils/needsYou.utils';
import type { LibraryItem } from '../../types/library.types';

function StarRating({ onRate }: { onRate: (score: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onRate(star * 2)}
          className="cursor-pointer p-0.5 transition-colors"
          aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
        >
          <Star
            size={18}
            className={
              star <= hovered
                ? 'fill-amber-400 text-amber-400'
                : 'text-[rgb(var(--color-text-tertiary))]'
            }
          />
        </button>
      ))}
    </div>
  );
}

function ActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex-shrink-0 text-xs font-medium px-3 py-2 rounded-md
        text-[rgb(var(--color-text-secondary))]
        border border-[rgb(var(--color-border-default))]
        hover:border-[rgb(var(--color-text-tertiary))]
        transition-colors cursor-pointer whitespace-nowrap"
    >
      {label}
    </button>
  );
}

function Row({
  entry,
  onNavigate,
  onRate,
  onDrop,
  onRemove,
}: {
  entry: NeedsYouItem;
  onNavigate: (contentId: string) => void;
  onRate: (item: LibraryItem, score: number) => void;
  onDrop: (item: LibraryItem) => void;
  onRemove: (item: LibraryItem) => void;
}) {
  const { libraryItem, kind } = entry;
  const { content } = libraryItem;

  return (
    <div
      className="flex items-center gap-3 py-2.5 cursor-pointer hover:bg-[rgb(var(--color-bg-page))] -mx-2 px-2 rounded transition-colors"
      onClick={() => onNavigate(content.id)}
    >
      <div className="flex-shrink-0 w-14 h-20 rounded overflow-hidden bg-[rgb(var(--color-border-default))]">
        {content.poster_url ? (
          <img src={content.poster_url} alt={content.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-base leading-snug font-medium text-[rgb(var(--color-text-primary))] truncate">
            {content.title}
          </span>
          <CategoryBadge label={CATEGORY_META[kind].badge} className={CATEGORY_META[kind].classes} />
        </div>
        <span className="text-sm text-[rgb(var(--color-text-secondary))] truncate block mt-0.5">
          {CATEGORY_META[kind].reason(libraryItem)}
        </span>
      </div>

      <div className="flex-shrink-0">
        {kind === 'rate' && <StarRating onRate={(score) => onRate(libraryItem, score)} />}
        {kind === 'drop' && <ActionButton label="Drop" onClick={() => onDrop(libraryItem)} />}
        {kind === 'remove' && <ActionButton label="Remove" onClick={() => onRemove(libraryItem)} />}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2.5 animate-pulse">
      <div className="flex-shrink-0 w-14 h-20 rounded bg-[rgb(var(--color-border-default))]" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-2/3 rounded bg-[rgb(var(--color-border-default))]" />
        <div className="h-3.5 w-1/3 rounded bg-[rgb(var(--color-border-default))]" />
      </div>
    </div>
  );
}

function Card({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="h-full bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))]">Needs you</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function NeedsYou() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const updateItem = useUpdateLibraryItem();

  const [actedIds, setActedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);

  const completedQuery = useQuery({
    queryKey: ['library', 'completed'],
    queryFn: () => getLibrary('completed', undefined, undefined, 1, 100),
    staleTime: 60_000,
  });
  const watchingQuery = useQuery({
    queryKey: ['library', 'watching'],
    queryFn: () => getLibrary('watching', undefined, undefined, 1, 100),
    staleTime: 60_000,
  });
  const backlogQuery = useQuery({
    queryKey: ['library', 'plan_to_watch'],
    queryFn: () => getLibrary('plan_to_watch', undefined, undefined, 1, 100),
    staleTime: 60_000,
  });

  const ranked = useMemo(
    () =>
      buildNeedsYou(
        completedQuery.data?.items ?? [],
        watchingQuery.data?.items ?? [],
        backlogQuery.data?.items ?? []
      ),
    [completedQuery.data, watchingQuery.data, backlogQuery.data]
  );

  const isLoading =
    completedQuery.data === undefined ||
    watchingQuery.data === undefined ||
    backlogQuery.data === undefined;

  const dismiss = (id: string) => setActedIds((prev) => new Set(prev).add(id));
  const restore = (id: string) =>
    setActedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

  const handleNavigate = (contentId: string) => setLocation(`/library?open=${contentId}`);

  const handleRate = (item: LibraryItem, score: number) => {
    dismiss(item.id);
    updateItem.mutate(
      { id: item.id, updates: { score } },
      {
        onSuccess: () => toast.success(`Rated “${item.content.title}”`),
        onError: (err) => {
          restore(item.id);
          toast.error(err.message || 'Could not save rating');
        },
      }
    );
  };

  const handleDrop = (item: LibraryItem) => {
    dismiss(item.id);
    updateItem.mutate(
      { id: item.id, updates: { status: 'dropped' } },
      {
        onSuccess: () =>
          toast.success(`Dropped “${item.content.title}”`, {
            action: {
              label: 'Undo',
              onClick: () =>
                updateItem.mutate(
                  { id: item.id, updates: { status: 'watching' } },
                  { onSuccess: () => restore(item.id) }
                ),
            },
          }),
        onError: (err) => {
          restore(item.id);
          toast.error(err.message || 'Could not drop');
        },
      }
    );
  };

  const handleRemove = (item: LibraryItem) => {
    dismiss(item.id);
    removeFromLibrary(item.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['library'] });
        toast.success(`Removed “${item.content.title}”`, {
          action: {
            label: 'Undo',
            onClick: () =>
              addToLibrary({ content_id: item.content_id, status: 'plan_to_watch' })
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: ['library'] });
                  restore(item.id);
                })
                .catch(() => toast.error('Could not undo')),
          },
        });
      })
      .catch((err) => {
        restore(item.id);
        toast.error(err.message || 'Could not remove');
      });
  };

  if (isLoading) {
    return (
      <Card>
        <div className="divide-y divide-[rgb(var(--color-border-default))]">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </Card>
    );
  }

  const visible = ranked.filter((e) => !actedIds.has(e.libraryItem.id));

  if (visible.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          You’re all caught up — nothing to rate or clean up.
        </p>
      </Card>
    );
  }

  // When there are more than fit, cycle through them in place (wrapping around).
  const canCycle = visible.length > NEEDS_YOU_VISIBLE;
  const shown = canCycle
    ? Array.from({ length: NEEDS_YOU_VISIBLE }, (_, i) => visible[(offset + i) % visible.length])
    : visible;

  const refreshAction = canCycle ? (
    <button
      onClick={() => setOffset((o) => (o + NEEDS_YOU_VISIBLE) % visible.length)}
      aria-label="Show more items"
      className="flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--color-text-tertiary))] hover:text-[#646cff] transition-colors cursor-pointer"
    >
      <RotateCw size={13} />
      More
    </button>
  ) : undefined;

  return (
    <Card action={refreshAction}>
      <div className="divide-y divide-[rgb(var(--color-border-default))]">
        {shown.map((entry) => (
          <Row
            key={entry.libraryItem.id}
            entry={entry}
            onNavigate={handleNavigate}
            onRate={handleRate}
            onDrop={handleDrop}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </Card>
  );
}
