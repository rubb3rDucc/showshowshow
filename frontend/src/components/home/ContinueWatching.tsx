import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { getLibrary } from '../../api/library';
import { getQueue, removeFromQueue } from '../../api/content';
import { useAddToQueue, isAlreadyInQueueError } from '../../hooks/useAddToQueue';
import { buildUpNext, CATEGORY_META, UP_NEXT_VISIBLE, type UpNextItem } from '../../utils/upNext.utils';
import type { LibraryItem } from '../../types/library.types';
import type { QueueItem } from '../../types/api';

type LineupState = 'idle' | 'pending' | 'in-lineup';

function LineupButton({
  state,
  onAdd,
}: {
  state: LineupState;
  onAdd: () => void;
}) {
  if (state === 'in-lineup') {
    return (
      <span
        aria-label="In your lineup"
        className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-md
          bg-emerald-600 text-white whitespace-nowrap"
      >
        <Check size={13} />
        In lineup
      </span>
    );
  }

  if (state === 'pending') {
    return (
      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-md
        border border-[rgb(var(--color-border-default))] text-[rgb(var(--color-text-tertiary))] whitespace-nowrap">
        <Loader2 size={13} className="animate-spin" />
        Adding…
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-md
        text-[#646cff] border border-[#646cff]/40 hover:bg-[#646cff] hover:text-white
        transition-colors cursor-pointer whitespace-nowrap"
    >
      <Plus size={13} />
      Add to lineup
    </button>
  );
}

function Row({
  entry,
  lineupState,
  onNavigate,
  onAddToLineup,
}: {
  entry: UpNextItem;
  lineupState: LineupState;
  onNavigate: (contentId: string) => void;
  onAddToLineup: (item: LibraryItem) => void;
}) {
  const { libraryItem, category } = entry;
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
        <span className="text-base leading-snug font-medium text-[rgb(var(--color-text-primary))] truncate block">
          {content.title}
        </span>
        <span className="text-sm text-[rgb(var(--color-text-secondary))] truncate block mt-0.5">
          {CATEGORY_META[category].reason(libraryItem)}
        </span>
      </div>

      <LineupButton state={lineupState} onAdd={() => onAddToLineup(libraryItem)} />
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
        <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))]">Up next</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export function ContinueWatching() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const addToQueueMutation = useAddToQueue();

  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [offset, setOffset] = useState(0);

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
  const queueQuery = useQuery({
    queryKey: ['queue'],
    queryFn: getQueue,
    staleTime: 60_000,
  });

  const ranked = useMemo(
    () => buildUpNext(watchingQuery.data?.items ?? [], backlogQuery.data?.items ?? []),
    [watchingQuery.data, backlogQuery.data]
  );

  const queuedContentIds = useMemo(
    () => new Set((queueQuery.data ?? []).map((q) => q.content_id)),
    [queueQuery.data]
  );

  const isLoading = watchingQuery.data === undefined || backlogQuery.data === undefined;

  const handleNavigate = (contentId: string) => {
    setLocation(`/library?open=${contentId}`);
  };

  const setPending = (contentId: string, on: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(contentId);
      else next.delete(contentId);
      return next;
    });

  const handleUndo = (queueItem: QueueItem, contentId: string) => {
    removeFromQueue(queueItem.id)
      .then(() => {
        setAddedIds((prev) => {
          const next = new Set(prev);
          next.delete(contentId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ['queue'] });
        toast.success('Removed from lineup');
      })
      .catch(() => toast.error('Could not undo'));
  };

  const handleAddToLineup = (item: LibraryItem) => {
    const contentId = item.content_id;
    if (pendingIds.has(contentId) || addedIds.has(contentId) || queuedContentIds.has(contentId)) {
      return;
    }
    setPending(contentId, true);

    addToQueueMutation.mutate(
      { contentId },
      {
        onSuccess: (queueItem) => {
          setPending(contentId, false);
          setAddedIds((prev) => new Set(prev).add(contentId));
          toast.success('Added to lineup', {
            description: item.content.title,
            action: { label: 'Undo', onClick: () => handleUndo(queueItem, contentId) },
          });
        },
        onError: (err) => {
          setPending(contentId, false);
          if (isAlreadyInQueueError(err)) {
            setAddedIds((prev) => new Set(prev).add(contentId));
            toast.info('Already in your lineup');
          } else {
            toast.error(err.message || 'Could not add to lineup');
          }
        },
      }
    );
  };

  const lineupStateFor = (contentId: string): LineupState => {
    if (pendingIds.has(contentId)) return 'pending';
    if (addedIds.has(contentId) || queuedContentIds.has(contentId)) return 'in-lineup';
    return 'idle';
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

  if (ranked.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">
          Nothing queued up to watch.
        </p>
        <button
          onClick={() => setLocation('/search')}
          className="mt-2 text-sm font-medium text-[#646cff] hover:underline cursor-pointer"
        >
          Find something to watch
        </button>
      </Card>
    );
  }

  // When there are more suggestions than fit, cycle through them in place (wrapping around).
  const canCycle = ranked.length > UP_NEXT_VISIBLE;
  const visible = canCycle
    ? Array.from({ length: UP_NEXT_VISIBLE }, (_, i) => ranked[(offset + i) % ranked.length])
    : ranked;

  const refreshAction = canCycle ? (
    <button
      onClick={() => setOffset((o) => (o + UP_NEXT_VISIBLE) % ranked.length)}
      aria-label="Show more suggestions"
      className="flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--color-text-tertiary))] hover:text-[#646cff] transition-colors cursor-pointer"
    >
      <RotateCw size={13} />
      More
    </button>
  ) : undefined;

  return (
    <Card action={refreshAction}>
      <div className="divide-y divide-[rgb(var(--color-border-default))]">
        {visible.map((entry) => (
          <Row
            key={entry.libraryItem.id}
            entry={entry}
            lineupState={lineupStateFor(entry.libraryItem.content_id)}
            onNavigate={handleNavigate}
            onAddToLineup={handleAddToLineup}
          />
        ))}
      </div>

      <button
        onClick={() => setLocation('/library')}
        className="mt-2 text-xs font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors cursor-pointer"
      >
        View all in your library
      </button>
    </Card>
  );
}
