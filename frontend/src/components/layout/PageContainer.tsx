import type { ReactNode } from 'react';

const WIDTHS = {
  /** Default content width for list/grid pages. */
  standard: 'max-w-7xl',
  /** Narrower column for form-style pages (e.g. Settings). */
  narrow: 'max-w-4xl',
} as const;

interface PageContainerProps {
  children: ReactNode;
  /** Content max-width. Defaults to the standard content width. */
  width?: keyof typeof WIDTHS;
  /** Extra classes appended to the inner content wrapper. */
  className?: string;
}

/**
 * Canonical page frame: owns the page background, centered max-width, and the
 * standard padding rhythm so every page sits in the identical frame. Pairs with
 * PageHeader. Padding follows the Home / lineup pages as the guideline.
 */
export function PageContainer({
  children,
  width = 'standard',
  className = '',
}: PageContainerProps) {
  return (
    <div className="min-h-screen bg-[rgb(var(--color-bg-page))]">
      <div className={`mx-auto ${WIDTHS[width]} px-4 md:px-6 lg:px-8 py-8 ${className}`}>
        {children}
      </div>
    </div>
  );
}
