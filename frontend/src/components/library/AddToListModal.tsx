import { useEffect, useMemo, useState } from 'react';
import { Modal, TextInput, Button, Group, ScrollArea, Checkbox, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Search, Tv } from 'lucide-react';
import { searchContent } from '../../api/content';
import type { LibraryItemUI } from '../../types/library.types';
import { itemKey, type CollectionItem } from '../../hooks/useCollections';

interface AddToListModalProps {
  opened: boolean;
  onClose: () => void;
  listName: string;
  libraryItems: LibraryItemUI[];
  /** itemKey()s already on the list, so they're hidden from the picker. */
  existingKeys: string[];
  onAdd: (items: CollectionItem[]) => void;
}

/** Library content → snapshot (only items with a tmdbId can be listed). */
function libraryToItem(i: LibraryItemUI): CollectionItem | null {
  if (i.content.tmdbId == null) return null;
  return {
    tmdbId: i.content.tmdbId,
    type: i.content.contentType === 'show' ? 'tv' : 'movie',
    title: i.content.title,
    posterUrl: i.content.posterUrl,
  };
}

/**
 * Pick titles to add to a list. Searches the user's **library** and **TMDB**,
 * so titles that aren't tracked yet can still be listed. Selections are returned
 * as self-contained {@link CollectionItem} snapshots.
 */
export function AddToListModal({ opened, onClose, listName, libraryItems, existingKeys, onAdd }: AddToListModalProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Map<string, CollectionItem>>(new Map());

  // Debounce the TMDB query so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const existing = useMemo(() => new Set(existingKeys), [existingKeys]);

  // Library candidates (snapshotted, deduped, already-listed removed).
  const libraryCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    const out: CollectionItem[] = [];
    for (const li of libraryItems) {
      const item = libraryToItem(li);
      if (!item) continue;
      const key = itemKey(item);
      if (existing.has(key) || seen.has(key)) continue;
      if (q && !item.title.toLowerCase().includes(q)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [libraryItems, existing, query]);

  const libraryKeys = useMemo(
    () => new Set(libraryItems.map(libraryToItem).filter(Boolean).map((i) => itemKey(i as CollectionItem))),
    [libraryItems]
  );

  // TMDB search — only once the user has typed something.
  const { data: tmdb, isFetching: tmdbLoading } = useQuery({
    queryKey: ['add-to-list-search', debounced],
    queryFn: () => searchContent(debounced, 1, false, 'tmdb'),
    enabled: opened && debounced.length > 1,
    staleTime: 60_000,
  });

  // TMDB results that aren't in the library and aren't already on the list.
  const tmdbCandidates = useMemo(() => {
    if (!tmdb) return [];
    const seen = new Set<string>();
    const out: CollectionItem[] = [];
    for (const r of tmdb.results) {
      if (r.tmdb_id == null) continue;
      const item: CollectionItem = { tmdbId: r.tmdb_id, type: r.media_type, title: r.title, posterUrl: r.poster_url };
      const key = itemKey(item);
      if (existing.has(key) || libraryKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out;
  }, [tmdb, existing, libraryKeys]);

  const toggle = (item: CollectionItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      const key = itemKey(item);
      if (next.has(key)) next.delete(key);
      else next.set(key, item);
      return next;
    });

  const close = () => {
    setSelected(new Map());
    setQuery('');
    setDebounced('');
    onClose();
  };

  const submit = () => {
    if (selected.size > 0) onAdd(Array.from(selected.values()));
    close();
  };

  const renderRow = (item: CollectionItem, fromLibrary: boolean) => {
    const key = itemKey(item);
    const checked = selected.has(key);
    return (
      <button
        key={key}
        type="button"
        onClick={() => toggle(item)}
        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-[rgb(var(--color-bg-elevated))] transition-colors"
      >
        <Checkbox checked={checked} readOnly tabIndex={-1} />
        <div className="flex-shrink-0 w-8 aspect-[2/3] rounded overflow-hidden bg-[rgb(var(--color-bg-elevated))]">
          {item.posterUrl ? (
            <img src={item.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="w-3.5 h-3.5 text-[rgb(var(--color-text-tertiary))]" />
            </div>
          )}
        </div>
        <span className="flex-1 text-sm text-[rgb(var(--color-text-primary))] truncate">{item.title}</span>
        {fromLibrary ? (
          <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">In library</span>
        ) : (
          <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
            {item.type === 'movie' ? 'Movie' : 'TV'}
          </span>
        )}
      </button>
    );
  };

  const nothingYet = libraryCandidates.length === 0 && tmdbCandidates.length === 0;

  return (
    <Modal opened={opened} onClose={close} title={`Add titles to "${listName}"`} centered size="lg">
      <TextInput
        placeholder="Search your library or all of TMDB…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<Search size={16} />}
        rightSection={tmdbLoading ? <Loader size={14} /> : null}
        mb="md"
        autoFocus
      />
      <ScrollArea h={380} type="auto">
        <div className="space-y-1">
          {libraryCandidates.length > 0 && (
            <>
              <p className="px-2 pt-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
                Your library
              </p>
              {libraryCandidates.map((item) => renderRow(item, true))}
            </>
          )}

          {tmdbCandidates.length > 0 && (
            <>
              <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">
                From TMDB
              </p>
              {tmdbCandidates.map((item) => renderRow(item, false))}
            </>
          )}

          {nothingYet && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))] py-8 text-center">
              {debounced.length > 1
                ? tmdbLoading
                  ? 'Searching…'
                  : 'No matches.'
                : query
                  ? 'No library matches — keep typing to search TMDB.'
                  : 'Search your library or all of TMDB to add titles.'}
            </p>
          )}
        </div>
      </ScrollArea>
      <Group justify="space-between" mt="md">
        <span className="text-sm text-[rgb(var(--color-text-secondary))]">{selected.size} selected</span>
        <Group gap="sm">
          <Button variant="subtle" color="gray" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0}>
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
