import {
  Canvas,
  Hero,
  LifecycleRibbon,
  Masthead,
} from '@/features/lifecycle';

export function App() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Masthead />
      <main>
        <Hero />
        <LifecycleRibbon />
        <Canvas />
      </main>
      <footer
        className="hairline-t mx-auto max-w-[1280px] px-8 py-6"
        style={{ marginTop: 40 }}
      >
        <div className="flex items-center justify-between">
          <span
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 12,
              color: 'var(--color-ink-mute)',
            }}
          >
            Audit trail as the spine.
          </span>
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              letterSpacing: '0.06em',
              color: 'var(--color-ink-faint)',
            }}
          >
            RanBerri · MGA-PAS · 0.1.0
          </span>
        </div>
      </footer>
    </div>
  );
}
