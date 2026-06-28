import { Grid3x3, Grid2x2, Square } from 'lucide-react';
import type { PosterSize } from '../../hooks/usePosterSize';

interface PosterSizeControlProps {
  value: PosterSize;
  onChange: (size: PosterSize) => void;
}

// Denser icon → smaller posters; single square → large posters.
const OPTIONS: { id: PosterSize; Icon: typeof Grid3x3; label: string }[] = [
  { id: 'sm', Icon: Grid3x3, label: 'Small posters' },
  { id: 'md', Icon: Grid2x2, label: 'Medium posters' },
  { id: 'lg', Icon: Square, label: 'Large posters' },
];

/** Quiet inline poster-size stepper (small / medium / large grid density). */
export function PosterSizeControl({ value, onChange }: PosterSizeControlProps) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Poster size">
      {OPTIONS.map(({ id, Icon, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`inline-flex items-center justify-center rounded transition-colors min-h-[44px] min-w-[44px] p-2 sm:min-h-0 sm:min-w-0 sm:p-1 ${
              active
                ? 'text-[rgb(var(--color-accent))]'
                : 'text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-primary))]'
            }`}
          >
            <Icon size={22} />
          </button>
        );
      })}
    </div>
  );
}
