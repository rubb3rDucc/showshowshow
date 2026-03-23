import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { PlusIcon } from 'lucide-react';
import { getReviews, createReview } from '../api/reviews';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function groupByMonth(reviews: Awaited<ReturnType<typeof getReviews>>) {
  const groups: { label: string; reviews: typeof reviews }[] = [];
  const seen = new Map<string, number>();

  for (const review of reviews) {
    const label = format(new Date(review.created_at), 'MMMM yyyy');
    if (seen.has(label)) {
      groups[seen.get(label)!].reviews.push(review);
    } else {
      seen.set(label, groups.length);
      groups.push({ label, reviews: [review] });
    }
  }

  return groups;
}

export function Reviews() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: getReviews,
  });

  const createMutation = useMutation({
    mutationFn: createReview,
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      navigate(`/reviews/${review.id}`);
    },
  });

  const groups = groupByMonth(reviews);

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-[rgb(var(--color-text-primary))]">Reviews</h1>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgb(var(--color-accent))] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          <PlusIcon size={15} />
          New Entry
        </button>
      </div>

      {isLoading ? null : reviews.length === 0 ? (
        <p className="text-[rgb(var(--color-text-secondary))] text-sm">
          No entries yet. Click "New Entry" to start writing.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.label}>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-secondary))] mb-3">
                {group.label}
              </h2>
              <div className="space-y-2">
                {group.reviews.map((review) => {
                  const preview = review.body
                    ? stripHtml(review.body).slice(0, 120)
                    : null;
                  const dateLabel = format(new Date(review.created_at), 'MMM d');

                  return (
                    <button
                      key={review.id}
                      onClick={() => navigate(`/reviews/${review.id}`)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-[rgb(var(--color-border-subtle))] bg-[rgb(var(--color-bg-surface))] hover:border-[rgb(var(--color-border-default))] hover:bg-[rgb(var(--color-bg-elevated))] transition-colors"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="text-xs text-[rgb(var(--color-text-secondary))] shrink-0 w-12">
                          {dateLabel}
                        </span>
                        <span className="text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                          {review.title ?? 'Untitled'}
                        </span>
                      </div>
                      {preview && (
                        <p className="mt-1 pl-15 text-xs text-[rgb(var(--color-text-secondary))] line-clamp-1 ml-[60px]">
                          {preview}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
