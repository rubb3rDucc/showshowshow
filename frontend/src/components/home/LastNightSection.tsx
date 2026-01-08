import type { ScheduleItem } from '../../types/api';
import { ScheduleRow } from './ScheduleRow';
import { useWaveEffect } from '../../hooks/useWaveEffect';

interface LastNightSectionProps {
  items: ScheduleItem[];
  dateString: string;
}

/**
 * Format date for display (e.g., "Monday, January 6")
 */
function formatDateDisplay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function LastNightSection({ items, dateString }: LastNightSectionProps) {
  const wave = useWaveEffect();

  // Only show if there are unwatched items from yesterday
  if (items.length === 0) {
    return null;
  }

  const displayDate = formatDateDisplay(dateString);
  const sortedItems = items.sort(
    (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
  );

  return (
    <section className="mb-12">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-normal text-[rgb(var(--color-text-tertiary))]">
          Last night
        </h2>
        <span className="text-sm font-normal text-[rgb(var(--color-text-tertiary))]">
          {displayDate}
        </span>
      </div>

      {/* Schedule rows with wave effect */}
      <div
        className="space-y-0"
        onMouseLeave={wave.handleMouseLeave}
      >
        {sortedItems.map((item, idx) => (
          <div
            key={item.id}
            onMouseEnter={() => wave.handleMouseEnter(idx)}
          >
            <ScheduleRow
              item={item}
              {...wave.getItemProps(idx)}
            />
          </div>
        ))}
      </div>

      {/* Subtle separator */}
      <div className="mt-8 border-b border-[rgb(var(--color-border-subtle))]" />
    </section>
  );
}
