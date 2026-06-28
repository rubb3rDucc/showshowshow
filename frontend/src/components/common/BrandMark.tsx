interface BrandMarkProps {
  className?: string;
  /** Color of the final "Show" — lets the share card recolor the mark. */
  accent?: string;
}

/**
 * ShowShowShow wordmark lockup. Text-based (no SVG logo exists yet). The final
 * "Show" is accent-colored so the mark reads as branded, not plain text.
 */
export function BrandMark({ className = '', accent = '#646cff' }: BrandMarkProps) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      ShowShow<span style={{ color: accent }}>Show</span>
    </span>
  );
}
