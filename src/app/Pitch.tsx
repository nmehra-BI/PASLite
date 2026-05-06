import { Hero, LifecycleRibbon, Masthead } from '@/features/lifecycle';

/**
 * The keynote view at #/pitch. Document-style layout for Lloyd's-grade
 * stills and screenshots: masthead + editorial hero + ribbon as a card.
 *
 * The cockpit at / is the working product. This route exists only so the
 * editorial framing can be captured cleanly without compromising the
 * workstation's chrome.
 */
export function Pitch() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <Masthead />
      <main>
        <Hero />
        <RibbonCard />
        <BackToCockpit />
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
            RanBerri · pitch view · 0.1.0
          </span>
        </div>
      </footer>
    </div>
  );
}

function RibbonCard() {
  return (
    <section className="mx-auto max-w-[1280px] px-8 pb-8">
      <div
        className="hairline-mid"
        style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-card)',
          padding: '20px 28px 22px',
        }}
      >
        <LifecycleRibbon />
      </div>
    </section>
  );
}

function BackToCockpit() {
  return (
    <section className="mx-auto max-w-[1280px] px-8 pb-12">
      <a
        href="#/"
        className="serif"
        style={{
          fontStyle: 'italic',
          fontSize: 13,
          color: 'var(--color-accent)',
          textDecoration: 'none',
          letterSpacing: '-0.005em',
        }}
      >
        &larr; open the cockpit
      </a>
    </section>
  );
}
