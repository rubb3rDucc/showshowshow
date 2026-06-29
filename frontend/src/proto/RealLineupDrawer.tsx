import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Film, Tv, X, Search, Plus, ListVideo } from 'lucide-react';
import { TextInput, Switch } from '@mantine/core';
import { toast } from 'sonner';
import { LineupEpisodePicker, type EpisodeFilter } from './LineupEpisodePicker';
import {
  getQueue,
  removeFromQueue,
  addToQueue,
  searchContent,
  getContentByTmdbId,
  getContentByMalId,
  setQueueItemActive,
  updateQueueItem,
} from '../api/content';
import type { QueueItem, SearchResult } from '../types/api';

// "S2E5" / "12 episodes" / "Movie" — what this queue entry contributes to a generated night.
function queueMeta(item: QueueItem): string {
  if (item.content_type === 'movie') return 'Movie';
  if (item.season != null && item.episode != null) return `S${item.season}E${item.episode}`;
  if (item.number_of_episodes != null) return `${item.number_of_episodes} episodes`;
  return 'Show';
}

/**
 * Real-data lineup drawer: shows the user's actual backend queue — the same source
 * `/api/schedule/generate/queue` schedules from — so what's listed here is what
 * "Schedule it" will fill the timeline with. Read + remove for now; add/reorder later.
 */
export function RealLineupDrawer({
  episodeFilters,
  onFilterChange,
}: {
  episodeFilters?: Record<string, EpisodeFilter>;
  onFilterChange?: (contentId: string, filter: EpisodeFilter | undefined) => void;
} = {}) {
  const queryClient = useQueryClient();
  const queue = useQuery({ queryKey: ['queue'], queryFn: getQueue, staleTime: 30000 });
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (queueItemId: string) => removeFromQueue(queueItemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
    onError: () => toast.error('Could not remove from lineup'),
  });

  // Toggle whether an item is scheduled (stays in the lineup either way).
  const activeMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setQueueItemActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'] }),
    onError: () => toast.error('Could not update that item'),
  });

  // Per-show scheduler flags (include-watched, order, resume). Optimistic so toggles feel
  // instant and don't refetch/flicker the whole lineup.
  const settingsMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof updateQueueItem>[1] }) =>
      updateQueueItem(id, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['queue'] });
      const prev = queryClient.getQueryData<QueueItem[]>(['queue']);
      queryClient.setQueryData<QueueItem[]>(['queue'], (old) =>
        old?.map((it) => (it.id === id ? { ...it, ...patch } : it))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['queue'], ctx.prev);
      toast.error('Could not update that setting');
    },
  });

  const items = queue.data ?? [];

  // --- Quick-add: search content, cache-on-demand, then add to the queue ---
  const [q, setQ] = useState('');
  const search = useQuery({
    queryKey: ['search', q],
    queryFn: () => searchContent(q, 1, false, 'tmdb'),
    enabled: q.trim().length >= 3,
    staleTime: 60000,
  });

  const inQueueTmdb = new Set(items.map((i) => i.tmdb_id).filter(Boolean));
  const results = (search.data?.results ?? [])
    .filter((r) => !(r.tmdb_id && inQueueTmdb.has(r.tmdb_id)))
    .slice(0, 5);

  const addMutation = useMutation({
    // Search results may not be cached yet — resolve to a real content_id first.
    mutationFn: async (result: SearchResult) => {
      let contentId = result.cached_id;
      if (!contentId) {
        if (result.mal_id && result.data_source === 'jikan') {
          contentId = (await getContentByMalId(result.mal_id)).id;
        } else if (result.tmdb_id) {
          contentId = (await getContentByTmdbId(result.tmdb_id, result.content_type)).id;
        }
      }
      if (!contentId) throw new Error('Could not resolve content');
      return addToQueue({ content_id: contentId });
    },
    onSuccess: (_data, result) => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success(`Added ${result.title} to your lineup`);
      setQ('');
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : '';
      toast.error(/already|exist|duplicate|conflict/i.test(msg) ? 'Already in your lineup' : 'Could not add to lineup');
    },
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
          Your lineup · {items.length} title{items.length === 1 ? '' : 's'}
        </h3>
        <span className="text-xs text-[rgb(var(--color-text-tertiary))] text-right">
          What "Schedule it" pulls from
        </span>
      </div>

      {/* Quick-add: search + add to the real queue without leaving the page */}
      <div className="relative mb-2">
        <TextInput
          size="sm"
          placeholder="Quick-add a show or movie to your lineup…"
          leftSection={<Search size={15} />}
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
        />
        {results.length > 0 && (
          <div className="absolute z-20 left-0 right-0 mt-1 rounded-lg border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))] shadow-lg overflow-hidden">
            {results.map((r) => (
              <button
                key={`${r.data_source ?? 'tmdb'}-${r.tmdb_id ?? r.mal_id}-${r.content_type}`}
                onClick={() => addMutation.mutate(r)}
                disabled={addMutation.isPending}
                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[rgb(var(--color-bg-elevated))] text-left disabled:opacity-50"
              >
                <div className="w-10 h-14 rounded-md overflow-hidden bg-[rgb(var(--color-bg-elevated))] flex-shrink-0">
                  {r.poster_url && <img src={r.poster_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-tertiary))]">
                    {r.content_type === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                    {r.content_type === 'movie' ? 'Movie' : 'Show'}
                    {r.release_date && <span>· {r.release_date.slice(0, 4)}</span>}
                  </p>
                </div>
                <Plus size={16} className="text-[#646cff] flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {queue.isLoading ? (
        <p className="text-sm text-[rgb(var(--color-text-tertiary))]">Loading your lineup…</p>
      ) : queue.isError ? (
        <p className="text-sm text-[rgb(var(--color-text-tertiary))]">Could not load your lineup (are you signed in?).</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-tertiary))]">
          Your lineup is empty — add shows from Search or your Library, then they'll schedule here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {items.map((item) => {
            const active = item.is_active !== false;
            return (
              <div
                key={item.id}
                className="flex gap-3 p-2.5 rounded-lg border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))]"
                style={{ opacity: active ? 1 : 0.55 }}
              >
                <div className="w-10 h-14 rounded-md flex-shrink-0 overflow-hidden bg-[rgb(var(--color-bg-elevated))]">
                  {item.poster_url && (
                    <img src={item.poster_url} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate min-w-0">{item.title ?? 'Untitled'}</p>
                    <button
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={removeMutation.isPending}
                      title="Remove from lineup"
                      aria-label="Remove from lineup"
                      className="-mt-0.5 -mr-0.5 flex-shrink-0 text-[rgb(var(--color-text-tertiary))] hover:text-red-500 hover:bg-red-50 rounded p-1 transition-colors disabled:opacity-50"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <p className="text-xs text-[rgb(var(--color-text-tertiary))] flex items-center gap-1">
                    {item.content_type === 'movie' ? <Film size={12} /> : <Tv size={12} />}
                    {queueMeta(item)}
                  </p>
                  <div className="mt-0.5 flex items-center gap-3 flex-wrap">
                    <Switch
                      size="xs"
                      checked={active}
                      onChange={(e) => activeMutation.mutate({ id: item.id, isActive: e.currentTarget.checked })}
                      label={active ? 'Scheduling' : "Won't schedule"}
                      labelPosition="left"
                      classNames={{ label: 'text-xs text-[rgb(var(--color-text-tertiary))]' }}
                    />
                    {onFilterChange && item.content_type !== 'movie' && (
                      <button
                        onClick={() => setOpenPicker(item.content_id)}
                        className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:text-[#646cff] ${
                          episodeFilters?.[item.content_id] ? 'text-[#646cff]' : 'text-[rgb(var(--color-text-secondary))]'
                        }`}
                      >
                        <ListVideo size={13} />
                        {episodeFilters?.[item.content_id] ? 'Episodes · custom' : 'Episodes'}
                      </button>
                    )}
                  </div>
                  {/* Per-show scheduler flags */}
                  <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
                    <Flag
                      checked={item.include_watched ?? false}
                      onChange={(v) => settingsMutation.mutate({ id: item.id, patch: { include_watched: v } })}
                      label="Watched"
                    />
                    {item.content_type !== 'movie' && (
                      <>
                        <Flag
                          checked={(item.episode_order ?? 'shuffle') === 'sequential'}
                          onChange={(v) => settingsMutation.mutate({ id: item.id, patch: { episode_order: v ? 'sequential' : 'shuffle' } })}
                          label="In order"
                        />
                        <Flag
                          checked={item.resume_from_last_watched ?? false}
                          onChange={(v) => settingsMutation.mutate({ id: item.id, patch: { resume_from_last_watched: v } })}
                          label="Resume"
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {(() => {
            const pick = items.find((i) => i.content_id === openPicker);
            if (!pick || !onFilterChange) return null;
            return (
              <LineupEpisodePicker
                opened
                onClose={() => setOpenPicker(null)}
                contentId={pick.content_id}
                title={pick.title ?? 'Show'}
                value={episodeFilters?.[pick.content_id]}
                onChange={(filter) => onFilterChange(pick.content_id, filter)}
              />
            );
          })()}
        </div>
      )}
    </section>
  );
}

// Compact per-show on/off flag used on each lineup card.
function Flag({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch
      size="xs"
      checked={checked}
      onChange={(e) => onChange(e.currentTarget.checked)}
      label={label}
      labelPosition="left"
      classNames={{ label: 'text-xs text-[rgb(var(--color-text-tertiary))]' }}
    />
  );
}
