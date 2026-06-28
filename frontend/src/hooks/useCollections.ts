import { useCallback, useEffect, useState } from 'react';

/**
 * PROTOTYPE-ONLY local store for Library "Lists" (collections).
 * Persisted to localStorage; there is no backend yet. This whole hook is a
 * throwaway layer to be replaced by `/api/lists` (T3-2). Do not build real
 * features on this shape without the backend.
 */
export interface Collection {
  id: string;
  name: string;
  description?: string;
  ranked: boolean;
  itemContentIds: string[];
  createdAt: number;
}

const STORAGE_KEY = 'ssss:collections:prototype:v1';

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
      itemContentIds: [],
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
    (id: string, contentIds: string[]) =>
      update(id, (c) => ({
        ...c,
        itemContentIds: [...c.itemContentIds, ...contentIds.filter((cid) => !c.itemContentIds.includes(cid))],
      })),
    [update]
  );

  const removeItem = useCallback(
    (id: string, contentId: string) =>
      update(id, (c) => ({ ...c, itemContentIds: c.itemContentIds.filter((cid) => cid !== contentId) })),
    [update]
  );

  const reorderItems = useCallback((id: string, contentIds: string[]) => update(id, (c) => ({ ...c, itemContentIds: contentIds })), [update]);

  /**
   * Seed a couple of example lists from real library content the first time the
   * page loads with data, so the prototype looks populated. No-op if any lists exist.
   */
  const seedIfEmpty = useCallback((sampleContentIds: string[]) => {
    if (sampleContentIds.length === 0) return;
    setCollections((prev) => {
      if (prev.length > 0) return prev;
      const comfort = sampleContentIds.slice(0, 6);
      const ranked = sampleContentIds.slice(0, Math.min(10, sampleContentIds.length));
      return [
        {
          id: newId(),
          name: 'Comfort shows',
          description: 'The ones I put on when I just want to relax.',
          ranked: false,
          itemContentIds: comfort,
          createdAt: Date.now(),
        },
        {
          id: newId(),
          name: 'Top 10 this year',
          description: 'My favourites so far, ranked.',
          ranked: true,
          itemContentIds: ranked,
          createdAt: Date.now() + 1,
        },
      ];
    });
  }, []);

  return { collections, createList, renameList, setDescription, deleteList, setRanked, addItems, removeItem, reorderItems, seedIfEmpty };
}
