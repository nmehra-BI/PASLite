import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: Props) {
  const padding = size === 'sm' ? 'px-2.5 py-1' : 'px-3 py-1.5';
  const base = `inline-flex items-center gap-1.5 ${padding} text-[13px] font-medium transition-colors`;
  const styles: Record<Variant, string> = {
    primary:
      'text-[var(--color-bg)] bg-[var(--color-ink)] hover:bg-[var(--color-ink-soft)]',
    secondary:
      'text-[var(--color-ink)] bg-[var(--color-surface)] hover:bg-[var(--color-sunken)] hairline',
    ghost: 'text-[var(--color-ink-soft)] hover:bg-[var(--color-sunken)]',
  };
  const radius = { borderRadius: 'var(--radius-button)' };
  return (
    <button {...rest} style={{ ...radius, ...rest.style }} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </button>
  );
}
