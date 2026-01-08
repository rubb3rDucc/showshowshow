import { Link } from 'wouter';

interface ComingUpProps {
  tomorrowCount: number;
}

export function ComingUp({ tomorrowCount }: ComingUpProps) {
  // Only show if there's something scheduled for tomorrow
  if (tomorrowCount === 0) {
    return null;
  }

  const itemText = tomorrowCount === 1 ? 'item' : 'items';

  return (
    <div className="mt-8">
      <Link href="/week">
        <span className="text-sm text-[rgb(var(--color-text-tertiary))] hover:text-[#646cff] cursor-pointer transition-colors">
          Tomorrow evening: {tomorrowCount} {itemText} →
        </span>
      </Link>
    </div>
  );
}
