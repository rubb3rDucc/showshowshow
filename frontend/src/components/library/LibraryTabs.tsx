import type { ReactNode } from 'react';

export type LibraryTab = 'library' | 'lists';

interface LibraryTabsProps {
  value: LibraryTab;
  onChange: (tab: LibraryTab) => void;
  counts?: Partial<Record<LibraryTab, number>>;
  /** Optional controls rendered right-aligned on the tabs row. */
  right?: ReactNode;
}

const TABS: { id: LibraryTab; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'lists', label: 'Lists' },
];

/** Quiet underline-style segmented control: Library / Lists. */
export function LibraryTabs({ value, onChange, counts, right }: LibraryTabsProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap border-b border-[rgb(var(--color-border-subtle))] mb-6">
      <div className="flex items-center gap-6">
        {TABS.map((tab) => {
          const active = value === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`-mb-px py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                active
                  ? 'border-[rgb(var(--color-text-primary))] text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))]'
              }`}
            >
              {tab.label}
              {count !== undefined && (
                <span className="ml-1.5 font-normal text-[rgb(var(--color-text-tertiary))]">{count}</span>
              )}
            </button>
          );
        })}
      </div>
      {right && <div className="flex items-center gap-3 pb-2">{right}</div>}
    </div>
  );
}
