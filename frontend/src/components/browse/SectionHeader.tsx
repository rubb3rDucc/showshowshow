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
          {icon && <div className="text-gray-700">{icon}</div>}
          <h3 className="text-lg md:text-xl font-black uppercase tracking-wider text-gray-900">
            {title}
          </h3>
        </div>
      {onSeeAll && (
        <Button
          variant="subtle"
          size="xs"
          onClick={onSeeAll}
          className="font-black uppercase text-xs hover:bg-gray-100"
        >
          See All
        </Button>
      )}
    </div>
  );
}

