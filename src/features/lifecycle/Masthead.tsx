import { Sparkle } from 'lucide-react';
import { useConfig } from '@/config';

type Props = {
  folio?: string;
  build?: string;
};

export function Masthead({ folio = 'MGA-PAS / folio 29481', build = '0.1.0' }: Props) {
  const config = useConfig();
  return (
    <header
      className="hairline-b w-full"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2.5">
          <Sparkle
            size={15}
            strokeWidth={1.25}
            style={{ color: 'var(--color-accent)' }}
            aria-hidden
          />
          <span
            className="serif"
            style={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '-0.018em',
              color: 'var(--color-ink)',
            }}
          >
            {config.branding.productName}
          </span>
          <span
            className="ml-3 hidden sm:inline"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 12.5,
              color: 'var(--color-ink-mute)',
            }}
          >
            policy administration cockpit
          </span>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10.5,
            letterSpacing: '0.08em',
            color: 'var(--color-ink-mute)',
          }}
        >
          {folio} · build {build}
        </div>
      </div>
    </header>
  );
}
