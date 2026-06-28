import { useCallback, useEffect, useState } from 'react';

/**
 * PROTOTYPE-ONLY local store for Library "Lists" (collections).
 * Persisted to localStorage; there is no backend yet. This whole hook is a
 * throwaway layer to be replaced by `/api/lists` (T3-2). Do not build real
 * features on this shape without the backend.
 */

/**
 * A list entry is a self-contained content SNAPSHOT, not a reference to a
 * library row — so titles that aren't in the user's library (added via TMDB
 * search) still render, and every entry stays addressable by `{ tmdbId, type }`.
 * That addressability is what later lets a list feed the scheduler / be cached.
 */
export interface CollectionItem {
  tmdbId: number;
  type: 'tv' | 'movie';
  title: string;
  posterUrl: string | null;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  ranked: boolean;
  items: CollectionItem[];
  createdAt: number;
}

/** Stable identity for a list entry (used for dedupe, removal, dnd ids). */
export function itemKey(item: Pick<CollectionItem, 'tmdbId' | 'type'>): string {
  return `${item.type}:${item.tmdbId}`;
}

// Bumped to v2 for the snapshot item model (v1 stored library content-id refs).
const STORAGE_KEY = 'ssss:collections:prototype:v2';

function load(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Collection[]) : [];
  } catch {
    return [];
  }
}

// new Date()/Math.random() are fine here (browser runtime, not a workflow script).
function newId(): string {
  return `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>(() => load());

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
    } catch {
      // ignore quota / serialization errors in the prototype
    }
  }, [collections]);

  const update = useCallback(
    (id: string, fn: (c: Collection) => Collection) =>
      setCollections((prev) => prev.map((c) => (c.id === id ? fn(c) : c))),
    []
  );

  const createList = useCallback((name: string, ranked: boolean, description?: string): Collection => {
    const list: Collection = {
      id: newId(),
      name: name.trim() || 'Untitled list',
      description: description?.trim() || undefined,
      ranked,
      items: [],
      createdAt: Date.now(),
    };
    setCollections((prev) => [...prev, list]);
    return list;
  }, []);

  const renameList = useCallback((id: string, name: string) => update(id, (c) => ({ ...c, name: name.trim() || c.name })), [update]);
  const setDescription = useCallback((id: string, description: string) => update(id, (c) => ({ ...c, description: description.trim() || undefined })), [update]);
  const deleteList = useCallback((id: string) => setCollections((prev) => prev.filter((c) => c.id !== id)), []);
  const setRanked = useCallback((id: string, ranked: boolean) => update(id, (c) => ({ ...c, ranked })), [update]);

  const addItems = useCallback(
    (id: string, items: CollectionItem[]) =>
      update(id, (c) => {
        const have = new Set(c.items.map(itemKey));
        const fresh = items.filter((it) => !have.has(itemKey(it)));
        return { ...c, items: [...c.items, ...fresh] };
      }),
    [update]
  );

  const removeItem = useCallback(
    (id: string, key: string) => update(id, (c) => ({ ...c, items: c.items.filter((it) => itemKey(it) !== key) })),
    [update]
  );

  const reorderItems = useCallback(
    (id: string, keys: string[]) =>
      update(id, (c) => {
        const byKey = new Map(c.items.map((it) => [itemKey(it), it]));
        const next = keys.map((k) => byKey.get(k)).filter((it): it is CollectionItem => Boolean(it));
        // Keep any items not present in `keys` (defensive) appended in original order.
        const seen = new Set(keys);
        for (const it of c.items) if (!seen.has(itemKey(it))) next.push(it);
        return { ...c, items: next };
      }),
    [update]
  );

  /**
   * Seed a couple of example lists from real library content the first time the
   * page loads with data, so the prototype looks populated. No-op if any lists exist.
   */
  const seedIfEmpty = useCallback((sample: CollectionItem[]) => {
    if (sample.length === 0) return;
    setCollections((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: newId(),
          name: 'Comfort shows',
          description: 'The ones I put on when I just want to relax.',
          ranked: false,
          items: sample.slice(0, 6),
          createdAt: Date.now(),
        },
        {
          id: newId(),
          name: 'Top 10 this year',
          description: 'My favourites so far, ranked.',
          ranked: true,
          items: sample.slice(0, Math.min(10, sample.length)),
          createdAt: Date.now() + 1,
        },
      ];
    });
  }, []);

  return { collections, createList, renameList, setDescription, deleteList, setRanked, addItems, removeItem, reorderItems, seedIfEmpty };
}
