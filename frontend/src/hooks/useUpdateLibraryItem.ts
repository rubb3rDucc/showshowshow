import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateLibraryItem } from '../api/library';
import type { LibraryItem, UpdateLibraryItemRequest } from '../types/library.types';

export interface UpdateLibraryItemVars {
  id: string;
  updates: UpdateLibraryItemRequest;
}

/**
 * Patch a library item (score, status, notes, …) and refresh the library caches.
 * Thin wrapper so the common update+invalidate flow lives in one place.
 */
export function useUpdateLibraryItem() {
  const queryClient = useQueryClient();

  return useMutation<LibraryItem, Error, UpdateLibraryItemVars>({
    mutationFn: ({ id, updates }) => updateLibraryItem(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      queryClient.invalidateQueries({ queryKey: ['library', 'stats'] });
    },
  });
}
