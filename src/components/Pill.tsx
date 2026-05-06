import type { ReactNode } from 'react';

type Tone = 'neutral' | 'info' | 'warn' | 'danger' | 'success' | 'accent';

const tones: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: 'var(--color-ink-soft)', bg: 'var(--color-sunken)' },
  info: { fg: 'var(--color-info)', bg: 'var(--color-info-bg)' },
  warn: { fg: 'var(--color-warn)', bg: 'var(--color-warn-bg)' },
  danger: { fg: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
  success: { fg: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  accent: { fg: 'var(--color-accent)', bg: 'rgba(201, 99, 66, 0.08)' },
};

type Props = {
  tone?: Tone;
  mono?: boolean;
  children: ReactNode;
};

export function Pill({ tone = 'neutral', mono = false, children }: Props) {
  const t = tones[tone];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-[1px] text-[10.5px] ${mono ? 'mono' : ''}`}
      style={{
        color: t.fg,
        background: t.bg,
        borderRadius: 'var(--radius-pill)',
        letterSpacing: mono ? '0.06em' : '0',
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
