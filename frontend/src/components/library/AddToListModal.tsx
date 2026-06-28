import { useEffect, useMemo, useState } from 'react';
import { Modal, TextInput, Button, Group, ScrollArea, Checkbox, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Search, Tv } from 'lucide-react';
import { toast } from 'sonner';
import { searchContent, getContentByTmdbId, getContentByMalId } from '../../api/content';
import type { LibraryItemUI } from '../../types/library.types';
import type { SearchResult } from '../../types/api';

interface AddToListModalProps {
  opened: boolean;
  onClose: () => void;
  listName: string;
  libraryItems: LibraryItemUI[];
  /** content_ids already on the list, hidden from the picker. */
  existingContentIds: string[];
  /** Receives resolved content_ids (titles are cached-on-add to get them). */
  onAdd: (contentIds: string[]) => void;
}

/**
 * A pickable candidate. `resolve()` returns the `content.id` to add — directly
 * for library items, or by caching the title (TMDB/Jikan) for search results.
 */
type Candidate = {
  key: string;
  title: string;
  posterUrl: string | null;
  badge: string;
  /** content_id if already known (library item or cached search result), for the existing-check. */
  knownContentId: string | null;
  resolve: () => Promise<string>;
};

function libraryCandidate(i: LibraryItemUI): Candidate {
  return {
    key: `lib:${i.contentId}`,
    title: i.content.title,
    posterUrl: i.content.posterUrl,
    badge: 'In library',
    knownContentId: i.contentId,
    resolve: async () => i.contentId,
  };
}

function searchCandidate(r: SearchResult): Candidate | null {
  if (r.mal_id != null && r.data_source === 'jikan') {
    return {
      key: `mal:${r.mal_id}`,
      title: r.title,
      posterUrl: r.poster_url,
      badge: 'Anime',
      knownContentId: r.cached_id,
      resolve: async () => (await getContentByMalId(r.mal_id as number)).id,
    };
  }
  if (r.tmdb_id != null) {
    return {
      key: `tmdb:${r.tmdb_id}`,
      title: r.title,
      posterUrl: r.poster_url,
      badge: r.content_type === 'movie' ? 'Movie' : 'TV',
      knownContentId: r.cached_id,
      resolve: async () => (await getContentByTmdbId(r.tmdb_id as number, r.content_type)).id,
    };
  }
  return null;
}

/**
 * Pick titles to add to a list. Searches the user's **library**, **TMDB**, and
 * **Jikan/anime** (run in parallel). On Add, each selection is resolved to a
 * `content.id` (caching the title if needed), then handed up as content_ids.
 */
export function AddToListModal({ opened, onClose, listName, libraryItems, existingContentIds, onAdd }: AddToListModalProps) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<Map<string, Candidate>>(new Map());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const existing = useMemo(() => new Set(existingContentIds), [existingContentIds]);
  const notListed = (c: Candidate) => !(c.knownContentId && existing.has(c.knownContentId));

  const libraryCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return libraryItems
      .filter((i) => i.content.tmdbId != null || i.content.title) // any library item is fine
      .map(libraryCandidate)
      .filter(notListed)
      .filter((c) => (q ? c.title.toLowerCase().includes(q) : true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryItems, query, existing]);

  const searchEnabled = opened && debounced.length > 1;
  const { data: tmdb, isFetching: tmdbLoading } = useQuery({
    queryKey: ['add-to-list', 'tmdb', debounced],
    queryFn: () => searchContent(debounced, 1, false, 'tmdb'),
    enabled: searchEnabled,
    staleTime: 60_000,
  });
  const { data: jikan, isFetching: jikanLoading } = useQuery({
    queryKey: ['add-to-list', 'jikan', debounced],
    queryFn: () => searchContent(debounced, 1, false, 'jikan'),
    enabled: searchEnabled,
    staleTime: 60_000,
  });

  // De-dup search results against the library (by key) + already-listed.
  const libraryKeys = useMemo(() => new Set(libraryCandidates.map((c) => c.key)), [libraryCandidates]);
  const toSection = (resp: typeof tmdb) => {
    const out: Candidate[] = [];
    const seen = new Set<string>();
    for (const r of resp?.results ?? []) {
      const c = searchCandidate(r);
      if (!c || seen.has(c.key) || libraryKeys.has(c.key) || !notListed(c)) continue;
      seen.add(c.key);
      out.push(c);
    }
    return out;
  };
  const tmdbCandidates = useMemo(() => toSection(tmdb), [tmdb, libraryKeys, existing]); // eslint-disable-line react-hooks/exhaustive-deps
  const jikanCandidates = useMemo(() => toSection(jikan), [jikan, libraryKeys, existing]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (c: Candidate) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.key)) next.delete(c.key);
      else next.set(c.key, c);
      return next;
    });

  const close = () => {
    setSelected(new Map());
    setQuery('');
    setDebounced('');
    onClose();
  };

  const submit = async () => {
    if (selected.size === 0) return close();
    setBusy(true);
    try {
      const contentIds = await Promise.all(Array.from(selected.values()).map((c) => c.resolve()));
      onAdd([...new Set(contentIds)]);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add some titles');
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (c: Candidate) => {
    const checked = selected.has(c.key);
    return (
      <button
        key={c.key}
        type="button"
        onClick={() => toggle(c)}
        className="w-full flex items-center gap-3 py-2 px-2 rounded-lg text-left hover:bg-[rgb(var(--color-bg-elevated))] transition-colors"
      >
        <Checkbox checked={checked} readOnly tabIndex={-1} />
        <div className="flex-shrink-0 w-8 aspect-[2/3] rounded overflow-hidden bg-[rgb(var(--color-bg-elevated))]">
          {c.posterUrl ? (
            <img src={c.posterUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="w-3.5 h-3.5 text-[rgb(var(--color-text-tertiary))]" />
            </div>
          )}
        </div>
        <span className="flex-1 text-sm text-[rgb(var(--color-text-primary))] truncate">{c.title}</span>
        <span className="flex-shrink-0 text-[10px] uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">{c.badge}</span>
      </button>
    );
  };

  const section = (label: string) => (
    <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-tertiary))]">{label}</p>
  );
  const searching = tmdbLoading || jikanLoading;
  const nothing = libraryCandidates.length === 0 && tmdbCandidates.length === 0 && jikanCandidates.length === 0;

  return (
    <Modal opened={opened} onClose={close} title={`Add titles to "${listName}"`} centered size="lg">
      <TextInput
        placeholder="Search your library, TMDB, or anime…"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        leftSection={<Search size={16} />}
        rightSection={searching ? <Loader size={14} /> : null}
        mb="md"
        autoFocus
      />
      <ScrollArea h={380} type="auto">
        <div className="space-y-1">
          {libraryCandidates.length > 0 && (
            <>
              {section('Your library')}
              {libraryCandidates.map(renderRow)}
            </>
          )}
          {tmdbCandidates.length > 0 && (
            <>
              {section('Movies & TV')}
              {tmdbCandidates.map(renderRow)}
            </>
          )}
          {jikanCandidates.length > 0 && (
            <>
              {section('Anime')}
              {jikanCandidates.map(renderRow)}
            </>
          )}
          {nothing && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))] py-8 text-center">
              {debounced.length > 1
                ? searching
                  ? 'Searching…'
                  : 'No matches.'
                : query
                  ? 'No library matches — keep typing to search TMDB + anime.'
                  : 'Search your library, TMDB, or anime to add titles.'}
            </p>
          )}
        </div>
      </ScrollArea>
      <Group justify="space-between" mt="md">
        <span className="text-sm text-[rgb(var(--color-text-secondary))]">{selected.size} selected</span>
        <Group gap="sm">
          <Button variant="subtle" color="gray" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={selected.size === 0 || busy} leftSection={busy ? <Loader size={14} /> : null}>
            Add {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </Group>
      </Group>
    </Modal>
  );
}
