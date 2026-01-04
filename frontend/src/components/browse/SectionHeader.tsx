import { Button } from '@mantine/core';

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, icon, onSeeAll }: SectionHeaderProps) {
    return (
    <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center gap-2">
          {icon && <div className="text-[rgb(var(--color-text-secondary))]">{icon}</div>}
          <h3 className="text-lg md:text-xl font-semibold tracking-tight text-[rgb(var(--color-text-primary))]">
            {title}
          </h3>
        </div>
      {onSeeAll && (
        <Button
          variant="subtle"
          size="xs"
          onClick={onSeeAll}
          className="font-semibold text-sm text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-elevated))]"
        >
          See All
        </Button>
      )}
    </div>
  );
}

