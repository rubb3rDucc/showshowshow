import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLists,
  getList,
  createList as apiCreateList,
  updateList as apiUpdateList,
  deleteList as apiDeleteList,
  addListItems,
  removeListItem,
  reorderListItems,
  type ListSummaryAPI,
  type ListItemAPI,
  type ListDetailAPI,
} from '../api/lists';

/**
 * Backend-backed Lists/Collections store (TanStack Query over `/api/lists`).
 * Items reference `content.id` (cross-source), so TMDB and Jikan/anime titles
 * are handled identically. Replaces the old localStorage prototype store; the
 * method names are kept so existing consumers barely change.
 */

/** A list item, resolved from the content table. Identity = `contentId`. */
export interface CollectionItem {
  contentId: string;
  title: string;
  posterUrl: string | null;
  type: 'show' | 'movie';
  tmdbId: number | null;
  malId: number | null;
  dataSource: 'tmdb' | 'jikan' | 'anilist' | 'kitsu';
}

/** Stable identity for a list entry (dnd id / dedupe / removal). */
export function itemKey(item: Pick<CollectionItem, 'contentId'>): string {
  return item.contentId;
}

/** A list summary for the overview (count + sample posters; no full items). */
export interface Collection {
  id: string;
  name: string;
  description?: string;
  ranked: boolean;
  itemCount: number;
  posters: string[];
}

function toCollection(l: ListSummaryAPI): Collection {
  return {
    id: l.id,
    name: l.name,
    description: l.description ?? undefined,
    ranked: l.ranked,
    itemCount: l.item_count,
    posters: l.posters,
  };
}

function toItem(i: ListItemAPI): CollectionItem {
  return {
    contentId: i.content_id,
    title: i.title,
    posterUrl: i.poster_url,
    type: i.content_type,
    tmdbId: i.tmdb_id,
    malId: i.mal_id,
    dataSource: i.data_source,
  };
}

export function useCollections() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['lists'], queryFn: getLists });
  const collections: Collection[] = (data ?? []).map(toCollection);

  const invalidateAll = () => qc.invalidateQueries({ queryKey: ['lists'] });

  const createMut = useMutation({
    mutationFn: (v: { name: string; ranked: boolean; description?: string }) =>
      apiCreateList({ name: v.name, ranked: v.ranked, description: v.description }),
    onSuccess: invalidateAll,
  });

  const updateMut = useMutation({
    mutationFn: (v: { id: string; input: { name?: string; description?: string | null; ranked?: boolean } }) =>
      apiUpdateList(v.id, v.input),
    onSuccess: (_d, v) => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['lists', v.id] });
    },
  });

  const deleteMut = useMutation({ mutationFn: (id: string) => apiDeleteList(id), onSuccess: invalidateAll });

  const addMut = useMutation({
    mutationFn: (v: { id: string; contentIds: string[] }) => addListItems(v.id, v.contentIds),
    onSuccess: (_d, v) => {
      invalidateAll();
      qc.invalidateQueries({ queryKey: ['lists', v.id] });
    },
  });

  // Optimistic removal so the tile vanishes immediately.
  const removeMut = useMutation({
    mutationFn: (v: { id: string; contentId: string }) => removeListItem(v.id, v.contentId),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['lists', v.id] });
      const prev = qc.getQueryData<ListDetailAPI>(['lists', v.id]);
      if (prev) {
        qc.setQueryData<ListDetailAPI>(['lists', v.id], {
          ...prev,
          items: prev.items.filter((i) => i.content_id !== v.contentId),
        });
      }
      return { prev };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['lists', v.id], ctx.prev);
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ['lists', v.id] });
      invalidateAll();
    },
  });

  // Optimistic reorder so drag-drop doesn't snap back during the round-trip.
  const reorderMut = useMutation({
    mutationFn: (v: { id: string; contentIds: string[] }) => reorderListItems(v.id, v.contentIds),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ['lists', v.id] });
      const prev = qc.getQueryData<ListDetailAPI>(['lists', v.id]);
      if (prev) {
        const byId = new Map(prev.items.map((i) => [i.content_id, i]));
        const items = v.contentIds
          .map((cid, idx) => {
            const it = byId.get(cid);
            return it ? { ...it, position: idx } : undefined;
          })
          .filter((i): i is ListItemAPI => Boolean(i));
        qc.setQueryData<ListDetailAPI>(['lists', v.id], { ...prev, items });
      }
      return { prev };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['lists', v.id], ctx.prev);
    },
    onSettled: (_d, _e, v) => qc.invalidateQueries({ queryKey: ['lists', v.id] }),
  });

  return {
    collections,
    isLoading,
    createList: async (name: string, ranked: boolean, description?: string): Promise<Collection> =>
      toCollection(await createMut.mutateAsync({ name, ranked, description })),
    renameList: (id: string, name: string) => updateMut.mutate({ id, input: { name } }),
    setDescription: (id: string, description: string) => updateMut.mutate({ id, input: { description } }),
    setRanked: (id: string, ranked: boolean) => updateMut.mutate({ id, input: { ranked } }),
    deleteList: (id: string) => deleteMut.mutate(id),
    addItems: (id: string, contentIds: string[]) => addMut.mutate({ id, contentIds }),
    removeItem: (id: string, contentId: string) => removeMut.mutate({ id, contentId }),
    reorderItems: (id: string, contentIds: string[]) => reorderMut.mutate({ id, contentIds }),
  };
}

/** Fetch a single list's ordered items (enabled only when a list is open). */
export function useListItems(listId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['lists', listId],
    queryFn: () => getList(listId as string),
    enabled: !!listId,
  });
  return { items: (data?.items ?? []).map(toItem), isLoading };
}
