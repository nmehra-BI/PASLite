export function Hero() {
  return (
    <section className="mx-auto max-w-[1280px] px-8 pb-10 pt-14">
      <div className="grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-8">
          <div
            className="eyebrow mb-5"
            style={{ color: 'var(--color-ink-mute)' }}
          >
            MGA · UK waste &amp; recycling · capacity-bound
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 'clamp(36px, 5vw, 56px)',
              lineHeight: 1.05,
              letterSpacing: '-0.022em',
              fontWeight: 400,
              color: 'var(--color-ink)',
              margin: 0,
            }}
          >
            The underwriter&rsquo;s{' '}
            <em
              style={{
                fontStyle: 'italic',
                color: 'var(--color-accent)',
                fontWeight: 400,
              }}
            >
              cockpit
            </em>
            , not another orchestration layer.
          </h1>
          <p
            className="prose-editorial mt-6 max-w-[58ch]"
            style={{ color: 'var(--color-ink-soft)' }}
          >
            One canvas per risk. AI proposes in the margin. Excel sealed
            underneath. Audit trail as the spine.
          </p>
        </div>

        <aside className="col-span-12 lg:col-span-4 lg:pl-6">
          <div
            className="hairline-l h-full pl-6"
            style={{
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--color-ink-mute)',
            }}
          >
            <p className="m-0">
              Built for the bind decision &mdash; the moment a slip becomes a
              policy, recorded with the evidence that justified it.
            </p>
            <p className="m-0 mt-3" style={{ fontStyle: 'normal' }}>
              <span
                className="eyebrow"
                style={{ color: 'var(--color-ink-faint)' }}
              >
                a note from the team
              </span>
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
