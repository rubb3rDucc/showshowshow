import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { PlusIcon, Trash2 } from 'lucide-react';
import { generateText } from '@tiptap/react';
import { getReviews, createReview } from '../api/reviews';
import type { Review } from '../api/reviews';
import { useDeleteReview } from '../hooks/useDeleteReview';
import { reviewEditorExtensions } from '../lib/reviewEditorExtensions';

interface MonthGroup {
  key: string;        // 'yyyy-MM'
  monthLabel: string; // 'March'
  reviews: Review[];
}

interface YearGroup {
  year: string;       // '2026'
  months: MonthGroup[];
}

function groupByYearAndMonth(reviews: Review[]): YearGroup[] {
  const yearMap = new Map<string, Map<string, MonthGroup>>();

  for (const review of reviews) {
    const date = new Date(review.created_at);
    const year = format(date, 'yyyy');
    const key = format(date, 'yyyy-MM');
    const monthLabel = format(date, 'MMMM');

    if (!yearMap.has(year)) yearMap.set(year, new Map());
    const months = yearMap.get(year)!;

    if (!months.has(key)) {
      months.set(key, { key, monthLabel, reviews: [] });
    }
    months.get(key)!.reviews.push(review);
  }

  return Array.from(yearMap.entries()).map(([year, months]) => ({
    year,
    months: Array.from(months.values()),
  }));
}

function EntryCard({ review, onClick }: { review: Review; onClick: () => void }) {
  const dateLabel = format(new Date(review.created_at), 'MMM d');
  const preview = review.body ? generateText(review.body, reviewEditorExtensions) : null;

  return (
    <button
      onClick={onClick}
      className="w-44 shrink-0 text-left p-4 rounded-lg border border-[rgb(var(--color-border-subtle))] bg-[rgb(var(--color-bg-surface))] hover:border-[rgb(var(--color-border-default))] hover:bg-[rgb(var(--color-bg-elevated))] transition-colors flex flex-col gap-2"
    >
      <span className="text-xs text-[rgb(var(--color-text-secondary))]">{dateLabel}</span>
      <span className="text-sm font-medium text-[rgb(var(--color-text-primary))] line-clamp-2 leading-snug">
        {review.title ?? 'Untitled'}
      </span>
      {preview && (
        <span className="text-xs text-[rgb(var(--color-text-secondary))] line-clamp-2 leading-snug">
          {preview}
        </span>
      )}
    </button>
  );
}

function MonthSection({
  group,
  isOpen,
  onToggle,
  onCardClick,
  onDelete,
}: {
  group: MonthGroup;
  isOpen: boolean;
  onToggle: () => void;
  onCardClick: (id: string) => void;
    onDelete: (id: string) => void;
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 py-2 group"
      >
        <span className={`text-4xl font-bold lowercase tracking-tight leading-none transition-colors shrink-0 ${
          isOpen
            ? 'text-[rgb(var(--color-text-primary))]'
            : 'text-[rgb(var(--color-text-secondary))] group-hover:text-[rgb(var(--color-text-primary))]'
        }`}>
          {group.monthLabel}
        </span>
        <div className="flex-1 border-t border-[rgb(var(--color-border-subtle))]" />
      </button>

      {/* Accordion via CSS grid trick */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isOpen ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.3s ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="flex gap-3 pt-4 pb-6 overflow-x-auto">
            {group.reviews.map((review) => (
              <div key={review.id} className='relative group/card'>
                <EntryCard
                  review={review}
                  onClick={() => onCardClick(review.id)}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(review.id);
                  }}
                  className="absolute top-2 right-2 p-1 rounded opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100 text-[rgb(var(--color-text-secondary))] hover:text-red-400 hover:bg-[rgb(var(--color-bg-elevated))] transition-all"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Reviews() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set([currentMonthKey])
  );

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: getReviews,
  });

  const confirmDelete = useDeleteReview();

  const createMutation = useMutation({
    mutationFn: createReview,
    onSuccess: (review) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      navigate(`/reviews/${review.id}`);
    },
  });

  const yearGroups = groupByYearAndMonth(reviews);

  function toggleMonth(key: string) {
    if (key === currentMonthKey) return;
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="px-8 py-10">
      {/* Page header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-lg font-semibold text-[rgb(var(--color-text-primary))]">Reviews</h1>
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
          {yearGroups.map((yearGroup) => (
            <div key={yearGroup.year}>
              <p className="text-xs font-medium tracking-widest text-[rgb(var(--color-text-secondary))] mb-3">
                {yearGroup.year}
              </p>
              <div className="space-y-1">
                {yearGroup.months.map((group) => (
                  <MonthSection
                    key={group.key}
                    group={group}
                    isOpen={expandedMonths.has(group.key)}
                    onToggle={() => toggleMonth(group.key)}
                    onCardClick={(id) => navigate(`/reviews/${id}`)}
                    onDelete={confirmDelete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
