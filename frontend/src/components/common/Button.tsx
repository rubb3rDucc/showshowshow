import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'default' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#646cff] text-white hover:bg-[#5158e0]',
  default:
    'border border-[rgb(var(--color-border-default))] bg-[rgb(var(--color-bg-surface))] text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:border-[rgb(var(--color-text-tertiary))]',
  ghost: 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-bg-page))]',
  danger: 'text-rose-500 hover:bg-rose-500/10',
};

/**
 * Quiet-utility button matching the Home dashboard styling (replaces Mantine <Button>
 * in the library/content modals so the accent + weight are consistent app-wide).
 */
export function Button({
  variant = 'default',
  leftIcon,
  onClick,
  disabled,
  loading,
  className = '',
  children,
}: {
  variant?: Variant;
  leftIcon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default ${VARIANTS[variant]} ${className}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : leftIcon}
      {children}
    </button>
  );
}
