import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteReview } from '../api/reviews';

const CONFIRM_MESSAGE = "Delete this review? This can't be undone.";

export function useDeleteReview(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: string) => deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      options?.onSuccess?.();
    },
  });

  return (id: string) => {
    if (!confirm(CONFIRM_MESSAGE)) return;
    mutation.mutate(id);
  };
}
