export interface SeasonTab {
  key: string | number;
  label: string;
  /** Tooltip, e.g. the episode count */
  title?: string;
}

interface SeasonTabsProps {
  tabs: SeasonTab[];
  activeKey: string | number;
  onSelect: (key: string | number) => void;
}

/**
 * Season chips shared by the episode tracker (seasons within one title) and the
 * anime season picker (seasons that are separate entries).
 */
export function SeasonTabs({ tabs, activeKey, onSelect }: SeasonTabsProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => {
        const active = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(tab.key)}
            aria-current={active ? 'true' : undefined}
            title={tab.title}
            className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
              active
                ? 'bg-[#646cff] text-white border-[#646cff]'
                : 'border-[rgb(var(--color-border-default))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:border-[rgb(var(--color-text-tertiary))]'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
