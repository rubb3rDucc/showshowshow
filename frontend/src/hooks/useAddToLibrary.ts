import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getContentByMalId, getContentByTmdbId } from '../api/content';
import { addToLibrary } from '../api/library';
import type { SearchResult } from '../types/api';
import type { LibraryItem, LibraryStatus } from '../types/library.types';

export interface AddToLibraryVars {
  result: SearchResult;
  /** Defaults to 'plan_to_watch' — quick-capture lands in the backlog unless overridden. */
  status?: LibraryStatus;
}

/**
 * Resolve a search result to a cached content_id, then add it to the library.
 *
 * Search results are not cached, so a result must first be cached via TMDB/Jikan
 * (which returns a stable content_id) before it can be written to the library.
 * Centralizes the cache-then-add flow that the search page open-codes per action.
 */
export function useAddToLibrary() {
  const queryClient = useQueryClient();

  return useMutation<LibraryItem, Error, AddToLibraryVars>({
    mutationFn: async ({ result, status = 'plan_to_watch' }) => {
      let contentId = result.cached_id;

      if (!contentId) {
        if (result.mal_id && result.data_source === 'jikan') {
          const content = await getContentByMalId(result.mal_id);
          contentId = content.id;
        } else if (result.tmdb_id) {
          const content = await getContentByTmdbId(result.tmdb_id, result.content_type);
          contentId = content.id;
        } else {
          throw new Error('No valid content id for this result');
        }
      }

      return addToLibrary({ content_id: contentId, status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
    },
  });
}

/** True when an add failure is really a "this is already in your library" conflict. */
export function isAlreadyInLibraryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already|exist|duplicate|conflict/i.test(message);
}
