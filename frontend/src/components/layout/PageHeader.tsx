import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  /** Small label above the title (e.g. "Your Lineup"). Optional. */
  eyebrow?: string;
  /** Main page title. */
  title: string;
  /** Optional supporting line below the title. */
  subtitle?: string;
  /** Optional controls rendered on the right (buttons, menus). */
  actions?: ReactNode;
  /** Optional quiet "back" link rendered above the title. */
  backLink?: { label: string; onClick: () => void };
  /** Extra classes appended to the header wrapper. */
  className?: string;
}

/**
 * Canonical page header used across top-level pages so titles, spacing, and
 * typography stay consistent. Follows the "quiet utility" pattern: a small
 * secondary-color eyebrow, then a clean primary title, with optional subtitle
 * and a right-aligned actions slot for page-level controls.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  backLink,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {backLink && (
        <button
          type="button"
          onClick={backLink.onClick}
          className="inline-flex items-center gap-1 mb-3 text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] transition-colors cursor-pointer"
        >
          <ArrowLeft size={15} />
          {backLink.label}
        </button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-medium tracking-tight text-[rgb(var(--color-text-secondary))] mb-1">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[rgb(var(--color-text-primary))]">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
