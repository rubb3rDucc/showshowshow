import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Check, X, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { searchContent } from '../../api/content';
import { getLibrary, removeFromLibrary } from '../../api/library';
import { useAddToLibrary, isAlreadyInLibraryError } from '../../hooks/useAddToLibrary';
import type { SearchResult } from '../../types/api';
import type { LibraryStatus } from '../../types/library.types';

const MAX_RESULTS = 6;

function resultKey(r: SearchResult): string {
  return `${r.tmdb_id ?? r.mal_id}-${r.content_type}`;
}

/** Debounce a rapidly-changing value (e.g. a search box) by `delay` ms. */
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PosterThumb({ url, title }: { url: string | null; title: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={title}
        className="w-10 h-14 object-cover rounded-sm flex-shrink-0 bg-[rgb(var(--color-bg-page))]"
      />
    );
  }
  return (
    <div className="w-10 h-14 rounded-sm flex-shrink-0 bg-[rgb(var(--color-bg-page))] border border-[rgb(var(--color-border-subtle))] flex items-center justify-center text-[10px] text-[rgb(var(--color-text-tertiary))]">
      no art
    </div>
  );
}

type AddState = 'idle' | 'pending' | 'added';

function ResultRow({
  item,
  state,
  removable,
  onOpen,
  onAdd,
  onRemove,
}: {
  item: SearchResult;
  state: AddState;
  removable: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const year = item.release_date ? item.release_date.slice(0, 4) : null;
  const typeLabel = item.content_type === 'tv' ? 'TV' : 'Movie';
  const isAnime = item.data_source === 'jikan';

  return (
    <div
      onClick={onOpen}
      className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded transition-colors cursor-pointer hover:bg-[rgb(var(--color-bg-page))]"
    >
      <PosterThumb url={item.poster_url} title={item.title} />
      <div className="flex-1 min-w-0">
        <div className="text-[15px] leading-snug font-medium text-[rgb(var(--color-text-primary))] truncate">
          {item.title}
        </div>
        <div className="text-xs text-[rgb(var(--color-text-secondary))] truncate mt-0.5">
          {year ? `${year} · ` : ''}
          {isAnime ? 'Anime' : typeLabel}
        </div>
      </div>
      <AddButton item={item} state={state} removable={removable} onAdd={onAdd} onRemove={onRemove} />
    </div>
  );
}

function AddButton({
  item,
  state,
  removable,
  onAdd,
  onRemove,
}: {
  item: SearchResult;
  state: AddState;
  removable: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (state === 'pending') {
    return (
      <span className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-[rgb(var(--color-bg-page))] text-[rgb(var(--color-text-tertiary))]">
        <Loader2 size={18} className="animate-spin" />
      </span>
    );
  }

  if (state === 'added') {
    // Removable: a check that turns into a red ✕ on hover (desktop) and removes on tap (mobile).
    if (removable) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${item.title} from library`}
          className="group flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
            bg-emerald-600 text-white hover:bg-red-600 transition-colors cursor-pointer"
        >
          <Check size={18} className="group-hover:hidden" />
          <X size={18} className="hidden group-hover:block" />
        </button>
      );
    }
    return (
      <span
        aria-label={`${item.title} in library`}
        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-600 text-white"
      >
        <Check size={18} />
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
      aria-label={`Add ${item.title} to library`}
      className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
        bg-[rgb(var(--color-bg-page))] text-[rgb(var(--color-text-secondary))]
        hover:bg-[#646cff] hover:text-white transition-colors cursor-pointer"
    >
      <Plus size={18} />
    </button>
  );
}

export function SearchWidget() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query.trim(), 300);
  const enabled = debouncedQuery.length >= 2;

  const [status, setStatus] = useState<LibraryStatus>('plan_to_watch');
  // resultKey -> library item id (null when added but the id isn't known yet).
  const [addedItemIds, setAddedItemIds] = useState<Map<string, string | null>>(new Map());
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());

  const addMutation = useAddToLibrary();

  // Live search. TMDB-only here for fast, predictable results; anime is reachable via the
  // "Search all results" handoff, which exposes the Jikan source toggle. (The 'auto' source is
  // anime-first and would suppress TMDB matches whenever any anime matches the query.)
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['home-search', debouncedQuery],
    queryFn: () => searchContent(debouncedQuery, 1, false, 'tmdb'),
    enabled,
    staleTime: 60_000,
  });

  // Lightweight library index so already-saved (cached) results render as "in library".
  const { data: libraryData } = useQuery({
    queryKey: ['library', 'quick-add-index'],
    queryFn: () => getLibrary(undefined, undefined, undefined, 1, 100),
    staleTime: 60_000,
  });
  const libraryByContentId = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of libraryData?.items ?? []) map.set(item.content_id, item.id);
    return map;
  }, [libraryData]);

  const results = useMemo(() => (data?.results ?? []).slice(0, MAX_RESULTS), [data]);

  const addStateFor = (item: SearchResult): AddState => {
    const key = resultKey(item);
    if (pendingKeys.has(key)) return 'pending';
    const inLibrary = item.cached_id ? libraryByContentId.has(item.cached_id) : false;
    if (addedItemIds.has(key) || inLibrary) return 'added';
    return 'idle';
  };

  // The library item id for an added result, if we can resolve one (needed to remove it).
  const libraryItemIdFor = (item: SearchResult): string | null => {
    const fromAdded = addedItemIds.get(resultKey(item));
    if (fromAdded) return fromAdded;
    if (item.cached_id) return libraryByContentId.get(item.cached_id) ?? null;
    return null;
  };

  const markAdded = (key: string, id: string | null) =>
    setAddedItemIds((prev) => new Map(prev).set(key, id));

  const clearAdded = (key: string) =>
    setAddedItemIds((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });

  const setPending = (key: string, on: boolean) =>
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const handleAdd = (item: SearchResult) => {
    if (addStateFor(item) !== 'idle') return;
    const key = resultKey(item);
    setPending(key, true);

    addMutation.mutate(
      { result: item, status },
      {
        onSuccess: (libraryItem) => {
          setPending(key, false);
          markAdded(key, libraryItem.id);
          toast.success(`Added “${item.title}”`, {
            description:
              status === 'watching' ? 'Marked as watching' : 'Saved to your backlog',
            action: { label: 'Undo', onClick: () => handleRemove(item) },
          });
          inputRef.current?.focus();
        },
        onError: (err) => {
          setPending(key, false);
          if (isAlreadyInLibraryError(err)) {
            markAdded(key, null);
            toast.info(`“${item.title}” is already in your library`);
          } else {
            toast.error(err.message || 'Could not add to library');
          }
        },
      }
    );
  };

  const handleRemove = (item: SearchResult) => {
    const id = libraryItemIdFor(item);
    if (!id) {
      toast.error('Could not find this item to remove');
      return;
    }
    const key = resultKey(item);
    setPending(key, true);

    removeFromLibrary(id)
      .then(() => {
        setPending(key, false);
        clearAdded(key);
        queryClient.invalidateQueries({ queryKey: ['library'] });
        toast.success(`Removed “${item.title}”`, {
          action: { label: 'Undo', onClick: () => handleAdd(item) },
        });
        inputRef.current?.focus();
      })
      .catch(() => {
        setPending(key, false);
        toast.error('Could not remove from library');
      });
  };

  const goToFullSearch = () => {
    setLocation(`/search?q=${encodeURIComponent(debouncedQuery)}`);
  };

  const handleOpen = (item: SearchResult) => {
    if (item.tmdb_id) {
      setLocation(`/content/${item.content_type}/${item.tmdb_id}`);
    }
  };

  const showResults = enabled;

  return (
    <div className="bg-[rgb(var(--color-bg-surface))] border border-[rgb(var(--color-border-default))] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))]">
          Quick add
        </h3>
        <StatusToggle value={status} onChange={setStatus} />
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))] pointer-events-none"
        />
        {isFetching ? (
          <Loader2
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-tertiary))] animate-spin"
          />
        ) : null}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a show or movie..."
          aria-label="Search a show or movie to add to your library"
          className="w-full pl-10 pr-10 py-2.5 text-base
            bg-[rgb(var(--color-bg-page))]
            border border-[rgb(var(--color-border-default))]
            rounded-md
            text-[rgb(var(--color-text-primary))]
            placeholder:text-[rgb(var(--color-text-tertiary))]
            focus:outline-none focus:border-[#646cff]
            transition-colors"
        />
      </div>

      {showResults && (
        <div className="mt-2">
          {isError ? (
            <div className="py-4 text-center">
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                Couldn’t load results.
              </p>
              <div className="mt-2 flex items-center justify-center gap-4">
                <button
                  onClick={() => refetch()}
                  className="text-sm font-medium text-[#646cff] hover:underline cursor-pointer"
                >
                  Try again
                </button>
                <button
                  onClick={goToFullSearch}
                  className="text-sm font-medium text-[rgb(var(--color-text-tertiary))] hover:text-[#646cff] transition-colors cursor-pointer"
                >
                  Open full search
                </button>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">
                {isFetching ? 'Searching…' : 'No quick matches'}
              </p>
              {!isFetching && (
                <button
                  onClick={goToFullSearch}
                  className="mt-2 inline-flex items-center gap-1 py-1 text-sm font-medium text-[#646cff] hover:underline cursor-pointer"
                >
                  Search all results for “{debouncedQuery}”
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-[rgb(var(--color-border-subtle))]">
                {results.map((item) => (
                  <ResultRow
                    key={resultKey(item)}
                    item={item}
                    state={addStateFor(item)}
                    removable={libraryItemIdFor(item) !== null}
                    onOpen={() => handleOpen(item)}
                    onAdd={() => handleAdd(item)}
                    onRemove={() => handleRemove(item)}
                  />
                ))}
              </div>
              <button
                onClick={goToFullSearch}
                className="mt-1 w-full inline-flex items-center justify-center gap-1 py-2.5 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[#646cff] transition-colors cursor-pointer"
              >
                Not seeing it? Search all results
                <ArrowRight size={15} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusToggle({
  value,
  onChange,
}: {
  value: LibraryStatus;
  onChange: (s: LibraryStatus) => void;
}) {
  const options: { value: LibraryStatus; label: string }[] = [
    { value: 'plan_to_watch', label: 'Plan' },
    { value: 'watching', label: 'Watching' },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Add as"
      className="flex items-center rounded-md border border-[rgb(var(--color-border-default))] p-0.5 gap-0.5"
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`text-xs font-medium px-2.5 py-1 rounded transition-colors cursor-pointer ${
              selected
                ? 'bg-[#646cff] text-white'
                : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
