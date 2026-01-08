import { Link } from 'wouter';

export function PlanAffordance() {
  return (
    <div className="mt-12 text-right">
      <Link href="/lineup">
        <span className="text-sm text-[rgb(var(--color-text-tertiary))] hover:text-[#646cff] cursor-pointer transition-colors">
          + Plan something
        </span>
      </Link>
    </div>
  );
}
