import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addToQueue } from '../api/content';
import type { QueueItem } from '../types/api';

export interface AddToQueueVars {
  contentId: string;
}

/**
 * Add an already-cached library item to the user's queue (the scheduling "lineup").
 *
 * Library items already carry a `content_id`, so unlike search results this needs no
 * cache-then-add resolution — it calls addToQueue directly and refreshes the queue cache.
 */
export function useAddToQueue() {
  const queryClient = useQueryClient();

  return useMutation<QueueItem, Error, AddToQueueVars>({
    mutationFn: ({ contentId }) => addToQueue({ content_id: contentId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

/** True when an add failure is really a "this is already in your lineup" conflict. */
export function isAlreadyInQueueError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already|exist|duplicate|conflict/i.test(message);
}
