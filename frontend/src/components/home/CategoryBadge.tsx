/**
 * Generic solid-fill category chip used to tag a row with a short, self-explanatory
 * label (e.g. "Almost done", "From backlog"). Category-agnostic — the caller supplies
 * the label and color class, so any home widget can reuse it.
 */
export function CategoryBadge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}
