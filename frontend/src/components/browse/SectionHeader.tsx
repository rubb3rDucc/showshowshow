import { ChevronRight } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  onSeeAll?: () => void;
}

export function SectionHeader({ title, icon, onSeeAll }: SectionHeaderProps) {
  if (onSeeAll) {
    // Fully clickable header
    return (
      <button
        onClick={onSeeAll}
        className="flex items-center justify-between w-full mb-4 px-4 md:px-0 group hover:opacity-70 transition-opacity bg-transparent"
      >
        <div className="flex items-center gap-2">
          {icon && <div className="text-gray-700">{icon}</div>}
          <h3 className="text-lg md:text-xl font-black uppercase tracking-wider text-gray-900">
            {title}
          </h3>
        <ChevronRight size={20} strokeWidth={3} className="text-gray-700" />
        </div>
      </button>
    );
  }

  // Non-clickable header (no onSeeAll)
  return (
    <div className="flex items-center gap-2 mb-4 px-4 md:px-0 bg-transparent">
      {icon && <div className="text-gray-700">{icon}</div>}
      <h3 className="text-lg md:text-xl font-black uppercase tracking-wider text-gray-900">
        {title}
      </h3>
    </div>
  );
}

