import type { ScheduleItem } from '../../types/api';
import { NowCard } from './NowCard';
import { ScheduleRow } from './ScheduleRow';
import { useWaveEffect } from '../../hooks/useWaveEffect';

interface TonightSectionProps {
  nowItem: ScheduleItem | null;
  earlierItems: ScheduleItem[];
  laterItems: ScheduleItem[];
  comingUpItems: ScheduleItem[];
  hasScheduleButNothingYet: boolean;
  dateString: string;
}

/**
 * Format date for display (e.g., "Tuesday, January 7")
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

export function TonightSection({
  nowItem,
  earlierItems,
  laterItems,
  comingUpItems,
  hasScheduleButNothingYet,
  dateString,
}: TonightSectionProps) {
  const displayDate = formatDateDisplay(dateString);
  const hasAnyContent = nowItem || laterItems.length > 0 || comingUpItems.length > 0 || earlierItems.length > 0;
  const comingUpWave = useWaveEffect();
  const earlierWave = useWaveEffect();
  const laterWave = useWaveEffect();

  return (
    <section className="mb-12">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="text-sm font-normal text-[rgb(var(--color-text-tertiary))]">
          Tonight
        </h2>
        <span className="text-sm font-normal text-[rgb(var(--color-text-tertiary))]">
          {displayDate}
        </span>
      </div>

      {/* Empty state */}
      {!hasAnyContent && (
        <div className="py-20 text-center">
          <p className="text-base text-[rgb(var(--color-text-secondary))]">
            Nothing planned.
          </p>
        </div>
      )}

      {/* "Coming up" state - schedule exists but nothing playing yet */}
      {hasScheduleButNothingYet && comingUpItems.length > 0 && (
        <>
          <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-4">
            Coming up
          </h3>
          <div
            className="space-y-0"
            onMouseLeave={comingUpWave.handleMouseLeave}
          >
            {comingUpItems.map((item, idx) => (
              <div
                key={item.id}
                onMouseEnter={() => comingUpWave.handleMouseEnter(idx)}
              >
                <ScheduleRow
                  item={item}
                  {...comingUpWave.getItemProps(idx)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* "Now" state - something is currently playing (or most recent past item) */}
      {nowItem && (
        <>
          {/* "Earlier" items - shows items before the now item */}
          {earlierItems.length > 0 && (
            <>
              <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-4">
                Earlier
              </h3>
              <div
                className="space-y-0"
                onMouseLeave={earlierWave.handleMouseLeave}
              >
                {earlierItems.map((item, idx) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => earlierWave.handleMouseEnter(idx)}
                  >
                    <ScheduleRow
                      item={item}
                      {...earlierWave.getItemProps(idx)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* "Now" section header - moved outside the card */}
          <h3 className={`text-xs font-medium text-[rgb(var(--color-text-tertiary))] mb-4 ${earlierItems.length > 0 ? 'mt-8' : ''}`}>
            Now
          </h3>
          <NowCard item={nowItem} />

          {/* "Later" items */}
          {laterItems.length > 0 && (
            <>
              <h3 className="text-xs font-medium text-[rgb(var(--color-text-tertiary))] mt-8 mb-4">
                Later
              </h3>
              <div
                className="space-y-0"
                onMouseLeave={laterWave.handleMouseLeave}
              >
                {laterItems.map((item, idx) => (
                  <div
                    key={item.id}
                    onMouseEnter={() => laterWave.handleMouseEnter(idx)}
                  >
                    <ScheduleRow
                      item={item}
                      {...laterWave.getItemProps(idx)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
