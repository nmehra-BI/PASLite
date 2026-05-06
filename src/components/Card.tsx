import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  tone?: 'surface' | 'sunken';
};

export function Card({ children, className = '', tone = 'surface' }: Props) {
  const bg = tone === 'sunken' ? 'var(--color-sunken)' : 'var(--color-surface)';
  return (
    <div
      className={`hairline ${className}`}
      style={{
        background: bg,
        borderRadius: 'var(--radius-card)',
      }}
    >
      {children}
    </div>
  );
}
