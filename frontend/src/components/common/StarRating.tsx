import { useState } from 'react';
import { Star } from 'lucide-react';

/**
 * Tap/click star rating with amber fill, matching the Home widgets' star styling.
 * `value` and `onChange` are in star units (1..count); clicking the current value clears it (0).
 */
export function StarRating({
  value,
  count = 10,
  onChange,
  size = 24,
}: {
  value: number;
  count?: number;
  onChange: (value: number) => void;
  size?: number;
}) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value;

  return (
    <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHovered(n)}
          onClick={() => onChange(n === value ? 0 : n)}
          aria-label={`Rate ${n} of ${count}`}
          className="p-0.5 cursor-pointer transition-colors"
        >
          <Star
            size={size}
            className={
              n <= active ? 'fill-amber-400 text-amber-400' : 'text-[rgb(var(--color-text-tertiary))]'
            }
          />
        </button>
      ))}
    </div>
  );
}
